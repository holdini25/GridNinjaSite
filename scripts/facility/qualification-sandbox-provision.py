#!/usr/bin/env python3
"""One reviewed disposable-runner trial; fixed paths/policy, no browser launch.

All privileged writes are new files below ROOT or the one unique PROFILE_PATH.
The caller must run this exact reviewed helper with the fixed Python interpreter.
There is no package install, policy replacement, sysctl write, arbitrary command,
or removal of distribution/evidence. Stop uses only verified owned pidfds.
A failed/uncertain cleanup needs VM disposal.
"""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import platform
import re
import selectors
import signal
import stat
import subprocess
import sys
import time
import zipfile

VERSION = "155.0.8059.79"
ROOT = Path("/var/lib/gridninja-cft")
VERSION_ROOT = ROOT / VERSION
DISTRIBUTION = VERSION_ROOT / "chrome-linux64"
BINARY = DISTRIBUTION / "chrome"
ARCHIVE = ROOT / "chrome-linux64.zip"
STATE = ROOT / "trial-state.json"
PROFILE_NAME = "gridninja-cft-155"
PROFILE_PATH = Path("/etc/apparmor.d") / PROFILE_NAME
PROFILE = ("abi <abi/4.0>,\ninclude <tunables/global>\n\n"
           "profile gridninja-cft-155 /var/lib/gridninja-cft/155.0.8059.79/chrome-linux64/chrome flags=(unconfined) {\n"
           "  userns,\n}\n").encode()
ARCHIVE_SHA = "bcd9a79130d7e44d70f93be87042e9bcee7fe0f0b3898e06b8c9bed5fb619dcd"
BINARY_SHA = "58957d0e74a9073626131018aabf17d97318227cca9b5dbdf5dee16345f2d211"
SCHEMA = "gridninja-sandbox-proof.v1"
MAX_LOG = 1024 * 1024
MAX_ARCHIVE = 300 * 1024 * 1024
MAX_UNPACKED = 1024 * 1024 * 1024
MAX_ENTRIES = 4096
ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LANG": "C", "LC_ALL": "C"}
FORBIDDEN_FLAGS = {"--no-sandbox", "--disable-namespace-sandbox", "--disable-seccomp-filter-sandbox",
                   "--disable-gpu-sandbox", "--single-process", "--no-zygote"}


class Refusal(Exception):
    pass


def require(ok, code):
    if not ok:
        raise Refusal(code)


def bounded_read(path, limit=65536):
    with open(path, "rb") as stream:
        value = stream.read(limit + 1)
    require(len(value) <= limit, "read-cap-exceeded")
    return value


def sha_bytes(value):
    return hashlib.sha256(value).hexdigest()


def executed_helper_sha():
    value = globals().get("__verified_helper_sha256__")
    require(isinstance(value, str) and re.fullmatch(r"[a-f0-9]{64}", value) is not None, "verified-bootstrap-required")
    return value


def sha_file(path):
    digest = hashlib.sha256()
    total = 0
    with open(path, "rb") as stream:
        while True:
            block = stream.read(1024 * 1024)
            if not block:
                return digest.hexdigest()
            total += len(block)
            require(total <= MAX_UNPACKED, "file-size-limit")
            digest.update(block)


def command(argv, timeout=10, cap=MAX_LOG):
    """Bounded reads only except exact parser add/remove, selected by caller."""
    intent = command_intent(argv)
    proc = subprocess.Popen(argv, shell=False, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, env=ENV, cwd="/", start_new_session=True)
    child_fd = os.pidfd_open(proc.pid)
    sel = selectors.DefaultSelector()
    output = {"out": bytearray(), "err": bytearray()}
    for key, stream in (("out", proc.stdout), ("err", proc.stderr)):
        os.set_blocking(stream.fileno(), False)
        sel.register(stream, selectors.EVENT_READ, key)
    deadline = time.monotonic() + timeout
    failure = None
    try:
        while sel.get_map() or proc.poll() is None:
            if time.monotonic() >= deadline:
                failure = "command-timeout"
                break
            for item, _ in sel.select(0.05):
                block = os.read(item.fd, 65536)
                if not block:
                    sel.unregister(item.fileobj)
                    continue
                output[item.data].extend(block)
                if len(output[item.data]) > (cap if item.data == "out" else 8192):
                    failure = "command-output-limit"
                    break
            if failure:
                break
    except BaseException:
        failure = "command-interrupted"
        raise
    finally:
        if failure:
            try:
                signal.pidfd_send_signal(child_fd, signal.SIGKILL)
            except ProcessLookupError:
                pass
        try:
            proc.wait(timeout=2)
        except subprocess.TimeoutExpired:
            failure = "command-closure-unknown"
        else:
            exclusive_json(ROOT / (intent + "-closed.json"), {"directChildClosed": True, "returnCode": proc.returncode})
        sel.close()
        proc.stdout.close()
        proc.stderr.close()
        os.close(child_fd)
    require(not failure, failure or "command-failed")
    require(proc.returncode == 0, "command-nonzero")
    return bytes(output["out"])


def pending_command_intents():
    names = sorted(path.name for path in ROOT.iterdir() if re.fullmatch(r"command-intent-[0-9]{3}\.json", path.name))
    require(len(names) <= 32, "command-intent-count-limit")
    pending = []
    for name in names:
        secure_metadata(ROOT / name, False)
        closed = ROOT / (name.removesuffix(".json") + "-closed.json")
        if not closed.exists():
            pending.append(name)
        else:
            secure_metadata(closed, False)
            value = json.loads(bounded_read(closed, 8192))
            require(value.get("directChildClosed") is True and type(value.get("returnCode")) is int, "invalid-command-closure-receipt")
    return pending


def command_intent(argv):
    require(not pending_command_intents(), "previous-command-closure-unknown")
    for index in range(32):
        name = "command-intent-" + str(index).zfill(3)
        path = ROOT / (name + ".json")
        if not path.exists():
            operation = "kernel-journal-read" if argv[0] == "/usr/bin/journalctl" else "parser-names" if "--names" in argv else "parser-add" if "--add" in argv else "parser-remove" if "--remove" in argv else None
            require(operation is not None, "unexpected-external-command")
            exclusive_json(path, {"operation": operation, "argvSha256": sha_bytes(json.dumps(argv).encode()), "startedEpochMs": round(time.time() * 1000)})
            return name
    raise Refusal("command-intent-count-limit")


def secure_metadata(path, directory=None):
    st = os.lstat(path)
    require(not stat.S_ISLNK(st.st_mode), "symlink-rejected")
    require(st.st_uid == 0 and st.st_gid == 0, "not-root-owned")
    require(st.st_mode & 0o6022 == 0, "unsafe-mode")
    require(stat.S_ISDIR(st.st_mode) or stat.S_ISREG(st.st_mode), "special-file-rejected")
    if directory is not None:
        require(stat.S_ISDIR(st.st_mode) == directory, "wrong-file-type")
    if stat.S_ISREG(st.st_mode):
        require(st.st_nlink == 1, "hardlink-rejected")
    attrs = os.listxattr(path, follow_symlinks=False)
    require(not {"system.posix_acl_access", "system.posix_acl_default"}.intersection(attrs), "extended-acl-rejected")
    require("security.capability" not in attrs, "file-capability-rejected")
    return {"path": str(path), "uid": st.st_uid, "gid": st.st_gid,
            "mode": oct(stat.S_IMODE(st.st_mode)), "device": st.st_dev, "inode": st.st_ino,
            "type": "directory" if stat.S_ISDIR(st.st_mode) else "file", "extendedAcl": False}


def invocation_lock(action):
    """Nonblocking lock spans all privileged operations, including failure paths."""
    if action == "prepare":
        require(not os.path.lexists(ROOT), "installation-or-profile-collision")
        for path in (Path("/"), Path("/var"), Path("/var/lib")):
            secure_metadata(path, True)
        validate_mounts(parse_mounts(bounded_read("/proc/self/mountinfo", MAX_LOG)))
        ROOT.mkdir(mode=0o755)
    secure_metadata(ROOT, True)
    path = ROOT / "invocation.lock"
    flags = os.O_RDWR | os.O_NOFOLLOW
    if action == "prepare":
        flags |= os.O_CREAT | os.O_EXCL
    fd = os.open(path, flags, 0o600)
    try:
        secure_metadata(path, False)
        require(stat.S_IMODE(os.fstat(fd).st_mode) == 0o600, "invocation-lock-mode")
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise Refusal("another-helper-still-active") from None
        if action != "export":
            require(not pending_command_intents(), "previous-command-closure-unknown")
        return fd
    except BaseException:
        os.close(fd)
        raise


def unescape_mount(value):
    return re.sub(r"\\([0-7]{3})", lambda match: chr(int(match[1], 8)), value)


def parse_mounts(raw):
    mounts = []
    for line in raw.decode("utf-8", "strict").splitlines():
        left, sep, right = line.partition(" - ")
        fields, other = left.split(), right.split()
        require(bool(sep) and len(fields) >= 6 and len(other) >= 3, "mount-parse-failed")
        mounts.append({"id": int(fields[0]), "device": fields[2], "root": unescape_mount(fields[3]),
                       "target": unescape_mount(fields[4]), "options": fields[5].split(","), "fstype": other[0]})
    require(0 < len(mounts) <= 1024, "mount-count-limit")
    return mounts


def contains_path(parent, child):
    return child == parent or child.startswith(parent.rstrip("/") + "/")


def validate_mounts(mounts):
    roots = [row for row in mounts if row["target"] == "/"]
    require(len(roots) == 1, "ambiguous-root-mount")
    root = roots[0]
    require(root["root"] == "/" and root["fstype"] == "ext4" and "rw" in root["options"], "unexpected-root-mount")
    protected = [str(ROOT), str(PROFILE_PATH)]
    for row in mounts:
        if row is root:
            continue
        require(not any(contains_path(row["target"], path) or contains_path(path, row["target"]) for path in protected), "protected-mount-overlay")
        if row["device"] == root["device"]:
            require(not any(contains_path(row["root"], path) or contains_path(path, row["root"]) for path in protected), "protected-mount-alias")
    return {"rootMountId": root["id"], "rootDevice": root["device"], "rootFilesystem": root["fstype"],
            "mountCount": len(mounts), "protectedAliasCount": 0}


def expand_braces(pattern):
    """Conservative finite AppArmor attachment expansion, not a policy parser."""
    values = [pattern]
    for _ in range(8):
        changed, next_values = False, []
        for value in values:
            match = re.search(r"\{([^{}]*)\}", value)
            if match:
                require("," in match[1], "unknown-attachment-syntax")
                next_values.extend(value[:match.start()] + item + value[match.end():] for item in match[1].split(","))
                changed = True
            else:
                next_values.append(value)
        require(len(next_values) <= 128, "attachment-expansion-limit")
        values = list(dict.fromkeys(next_values))
        if not changed:
            require(all("{" not in v and "}" not in v for v in values), "unknown-attachment-syntax")
            return values
    raise Refusal("attachment-depth-limit")


def attachment_may_match(attachment, path):
    require(attachment not in {"", "<unknown>"}, "unknown-attachment")
    require("@" not in attachment and "\\" not in attachment and "\x00" not in attachment, "unknown-attachment-syntax")
    if not attachment.startswith(("/", "{")):
        # The kernel exports the profile name when there is no path attachment.
        require(not any(c in attachment for c in "*?[]{}"), "unknown-attachment-syntax")
        return False
    for value in expand_braces(attachment):
        # Prefix disjointness is conclusive; unknown bracket syntax on an
        # overlapping prefix stops rather than approximating it as safe.
        prefix = re.split(r"[\*?\[]", value, maxsplit=1)[0]
        if not path.startswith(prefix):
            continue
        require("[" not in value and "]" not in value, "unknown-attachment-syntax")
        regex = re.escape(value).replace(r"\*", ".*").replace(r"\?", ".")
        if re.fullmatch(regex, path):
            return True
    return False


def profile_snapshot(expected=False):
    loaded = bounded_read("/sys/kernel/security/apparmor/profiles", 262144).decode().splitlines()
    require(0 < len(loaded) <= 1024, "profile-count-limit")
    require(all(re.fullmatch(r".+ \((enforce|complain|unconfined|kill|prompt)\)", row) for row in loaded), "profile-list-parse")
    named = [row for row in loaded if row.startswith(PROFILE_NAME + " (")]
    require(named == ([PROFILE_NAME + " (unconfined)"] if expected else []), "profile-name-collision-or-missing")
    base = Path("/sys/kernel/security/apparmor/policy/profiles")
    pending = list(base.iterdir())
    count, target = 0, None
    records = []
    while pending:
        directory = pending.pop()
        require(directory.is_dir() and not directory.is_symlink(), "profile-tree-unexpected")
        count += 1
        require(count <= 1024, "profile-count-limit")
        name = bounded_read(directory / "name", 8192).decode().strip()
        mode = bounded_read(directory / "mode", 128).decode().strip()
        attach = bounded_read(directory / "attach", 8192).decode().strip()
        if name == PROFILE_NAME:
            require(expected and attach == str(BINARY) and mode == "unconfined", "wrong-candidate-attachment")
            target = {"name": name, "attachment": attach, "mode": mode}
        else:
            require(not attachment_may_match(attach, str(BINARY)), "conflicting-attachment")
            records.append(sha_bytes((name + "\0" + mode + "\0" + attach).encode()))
        child = directory / "profiles"
        if child.exists():
            pending.extend(child.iterdir())
    require(count == len(loaded), "profile-snapshot-incomplete")
    require(bool(target) == expected, "candidate-profile-observation-missing")
    return {"loadedCount": len(loaded), "attachmentCount": count, "target": target,
            "otherAttachmentsSha256": sha_bytes(json.dumps(sorted(records)).encode()),
            "noPotentialCandidateAttachmentConflicts": True}


TUNABLE_VALUE_CHARACTERS = r"[A-Za-z0-9_/.@{}\[\]*?+,~^=:\-$\s\"']"
KNOWN_TUNABLE_PATHS = {
    "alias", "apparmorfs", "dovecot", "etc", "global", "home", "home.d/site.local", "kernelvars",
    "multiarch", "multiarch.d/site.local", "proc", "run", "securityfs", "share", "sys", "system", "xdg-user-dirs",
}


def validate_tunable_text(raw, source_path=None):
    """Permit assignments and in-tree includes only; no aliases/rule blocks."""
    for line_number, original in enumerate(raw.decode("utf-8", "strict").splitlines(), 1):
        unexpected = []
        try:
            line = original.strip()
            if not line or (line.startswith("#") and not re.match(r"#\s*include\b", line)):
                continue
            include = re.fullmatch(r"#?\s*include(?:\s+if\s+exists)?\s+<(tunables/[A-Za-z0-9_./-]+)>\s*(?:#.*)?", line)
            if include:
                require(".." not in PurePosixPath(include[1]).parts, "tunable-include-escape")
                continue
            assignment = re.fullmatch(r"@\{[A-Za-z0-9_]+\}\s*\+?=\s*([^#]+)(?:#.*)?", line)
            require(assignment is not None, "tunable-non-assignment-content")
            # The literal colon is present in Ubuntu's pci_bus assignment; it
            # changes no directive grammar or included file boundary.
            unexpected = sorted({ord(char) for char in assignment[1] if not re.fullmatch(TUNABLE_VALUE_CHARACTERS, char)})
            require(not unexpected, "tunable-assignment-unknown-syntax")
        except Refusal as error:
            relative = None
            if source_path is not None:
                try:
                    relative = str(Path(source_path).relative_to("/etc/apparmor.d/tunables"))
                except ValueError:
                    pass
            error.tunable_diagnostic = {
                "fileRelativePath": relative if relative in KNOWN_TUNABLE_PATHS else "unrecognized-tunable",
                "sourcePathSha256": sha_bytes(str(source_path).encode()) if source_path is not None else None,
                "fileSha256": sha_bytes(raw), "fileBytes": len(raw), "lineNumber": line_number,
                "lineSha256WithoutLineEnding": sha_bytes(original.encode()),
                "unexpectedCharacterCodePoints": unexpected[:8], "additionalUnexpectedCodePoints": max(0, len(unexpected) - 8),
                "rawContentsSuppressed": True,
            }
            raise


def host_facts(expected=False):
    require(platform.system() == "Linux" and platform.machine() == "x86_64" and os.geteuid() == 0, "unsupported-execution-host")
    controls = {}
    for name, path in {"apparmorUserns": "/proc/sys/kernel/apparmor_restrict_unprivileged_userns",
                       "unprivilegedUserns": "/proc/sys/kernel/unprivileged_userns_clone",
                       "maxUserNamespaces": "/proc/sys/user/max_user_namespaces"}.items():
        raw = bounded_read(path, 64).decode().strip()
        require(re.fullmatch(r"[0-9]{1,12}", raw) is not None, "namespace-control-unknown")
        controls[name] = int(raw)
    require(controls["apparmorUserns"] == 1 and controls["unprivilegedUserns"] == 1 and controls["maxUserNamespaces"] > 0, "unexpected-namespace-controls")
    require(bounded_read("/sys/module/apparmor/parameters/enabled", 64).strip() == b"Y", "apparmor-not-enabled")
    lsm = bounded_read("/sys/kernel/security/lsm", 8192).decode().strip().split(",")
    require("apparmor" in lsm and all(re.fullmatch(r"[a-z_]{1,32}", item) for item in lsm), "lsm-unknown")
    require(bounded_read("/proc/self/attr/current", 128).strip() == b"unconfined", "unexpected-helper-profile")
    os_release = bounded_read("/etc/os-release", 8192).decode()
    require(re.search(r'^ID=ubuntu$', os_release, re.M) and re.search(r'^VERSION_ID="24\.04"$', os_release, re.M), "unexpected-os")
    shared = [secure_metadata(Path(p), True) for p in ("/", "/var", "/var/lib", "/etc", "/etc/apparmor.d")]
    mounts_raw = bounded_read("/proc/self/mountinfo", MAX_LOG)
    mounts = validate_mounts(parse_mounts(mounts_raw))
    secure_metadata(Path("/etc/apparmor.d/abi"), True)
    secure_metadata(Path("/etc/apparmor.d/abi/4.0"), False)
    secure_metadata(Path("/etc/apparmor.d/tunables"), True)
    secure_metadata(Path("/etc/apparmor.d/tunables/global"), False)
    policy_inputs = []
    for base in (Path("/etc/apparmor.d/tunables"), Path("/etc/apparmor.d/abi")):
        for directory, dirs, files in os.walk(base, followlinks=False):
            dirs.sort()
            for path in [Path(directory)] + [Path(directory) / name for name in sorted(dirs + files)]:
                metadata = secure_metadata(path)
                if metadata["type"] == "file":
                    metadata["sha256"] = sha_file(path)
                    if base.name == "tunables":
                        validate_tunable_text(bounded_read(path, 65536), path)
                policy_inputs.append(metadata)
                require(len(policy_inputs) <= MAX_ENTRIES, "policy-input-count-limit")
    profiles = profile_snapshot(expected)
    return {"kernel": platform.release(), "architecture": "x86_64", "os": "ubuntu24.04", "controls": controls,
            "apparmorEnabled": True, "lsmNames": lsm, "sharedAncestors": shared, "mounts": mounts,
            "mountSnapshotSha256": sha_bytes(mounts_raw), "profiles": profiles,
            "policyInputsSha256": sha_bytes(json.dumps(sorted(policy_inputs, key=lambda item: item["path"]), sort_keys=True).encode()),
            "policyInputCount": len(policy_inputs)}


def archive_entries(archive):
    infos = archive.infolist()
    require(0 < len(infos) <= MAX_ENTRIES, "archive-entry-count")
    names, total = set(), 0
    for info in infos:
        name = info.filename
        path = PurePosixPath(name)
        require(name and not name.startswith("/") and "\\" not in name and "\x00" not in name,
                "archive-unsafe-name")
        require(all(part not in {"", ".", ".."} for part in name.rstrip("/").split("/")), "archive-unsafe-name")
        require(path.parts[0] == "chrome-linux64" and len(name) <= 256 and name not in names, "archive-unsafe-name")
        require(re.fullmatch(r"[A-Za-z0-9._/+-]+", name) is not None, "archive-unexpected-name")
        names.add(name)
        mode = info.external_attr >> 16
        kind = stat.S_IFMT(mode)
        require(kind in ({0, stat.S_IFDIR} if info.is_dir() else {0, stat.S_IFREG}), "archive-special-entry")
        require(mode & 0o6000 == 0 and not info.flag_bits & 1, "archive-privileged-or-encrypted")
        total += info.file_size
        require(info.file_size <= 512 * 1024 * 1024 and total <= MAX_UNPACKED, "archive-unpacked-limit")
    require("chrome-linux64/chrome" in names, "archive-missing-chrome")
    return infos


def protected_inventory():
    paths = [ROOT, VERSION_ROOT, DISTRIBUTION]
    for directory, dirs, files in os.walk(DISTRIBUTION, followlinks=False):
        paths.extend(Path(directory) / name for name in sorted(dirs + files))
    require(len(paths) <= MAX_ENTRIES + 3, "distribution-entry-limit")
    rows = []
    for path in sorted(set(paths)):
        row = secure_metadata(path)
        if row["type"] == "file":
            row["sha256"] = sha_file(path)
            row["bytes"] = os.lstat(path).st_size
        rows.append(row)
    require(sha_file(BINARY) == BINARY_SHA, "binary-hash-mismatch")
    require(os.lstat(BINARY).st_mode & 0o111 == 0o111, "binary-not-executable")
    return {"entries": rows, "entryCount": len(rows), "sha256": sha_bytes(json.dumps(rows, sort_keys=True).encode())}


def exclusive_json(path, value):
    encoded = (json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n").encode()
    require(len(encoded) <= MAX_LOG, "evidence-size-limit")
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o644)
    with os.fdopen(fd, "wb") as stream:
        stream.write(encoded)
        stream.flush()
        os.fsync(stream.fileno())


def read_state(args):
    secure_metadata(ROOT, True)
    secure_metadata(STATE, False)
    value = json.loads(bounded_read(STATE, MAX_LOG))
    require(value["headSha"] == args.head and value["runId"] == args.run_id, "state-run-mismatch")
    require(value["binarySha256"] == BINARY_SHA and value["profileSha256"] == sha_bytes(PROFILE), "state-pin-mismatch")
    require(value["helperSha256"] == executed_helper_sha(), "executed-helper-source-changed")
    require(value["helperSha256"] == sha_file(Path(__file__).resolve()), "helper-file-source-changed")
    return value


def request(args):
    path = Path(args.request)
    require(path.is_absolute() and path.name.endswith(".json"), "request-path-invalid")
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, "rb") as stream:
        require(stat.S_ISREG(os.fstat(stream.fileno()).st_mode), "request-not-regular")
        raw = stream.read(131073)
    require(len(raw) <= 131072, "request-size-limit")
    value = json.loads(raw)
    require(value.get("schemaVersion") == SCHEMA and value.get("headSha") == args.head
            and str(value.get("runId")) == args.run_id, "request-binding-mismatch")
    return value, sha_bytes(raw)


def process_stat(pid):
    raw = bounded_read(f"/proc/{pid}/stat", 8192).decode()
    fields = raw[raw.rfind(")") + 2:].split()
    require(len(fields) >= 20 and fields[0] in "RSDZTWXIPt", "process-stat-invalid")
    return {"pid": pid, "ppid": int(fields[1]), "pgrp": int(fields[2]), "session": int(fields[3]), "startTicks": fields[19], "state": fields[0]}


def process_identity(item):
    require(isinstance(item, dict) and type(item.get("pid")) is int and 1 < item["pid"] < 4194304, "invalid-process-id")
    start = str(item.get("startTicks"))
    require(re.fullmatch(r"[0-9]{1,20}", start) is not None, "invalid-start-time")
    return item["pid"], start


def closed_identities(items):
    require(isinstance(items, list) and 0 < len(items) <= 256, "invalid-process-list")
    for item in items:
        pid, start = process_identity(item)
        try:
            current = process_stat(pid)
        except FileNotFoundError:
            continue
        require(current["startTicks"] != start, "observed-process-still-present")


def global_closure():
    """Read-only scan; never kill unowned or uncertain processes."""
    matches_binary, matches_profile, unknown = 0, 0, 0
    pids = [entry for entry in Path("/proc").iterdir() if entry.name.isdigit()]
    require(len(pids) <= 32768, "process-scan-limit")
    for directory in pids:
        try:
            before = process_stat(int(directory.name))
            try:
                executable = os.readlink(directory / "exe")
            except FileNotFoundError:
                # Kernel threads/zombies have no executable. A live non-kernel
                # process with a missing executable is not silently ignored.
                cmdline = bounded_read(directory / "cmdline", 131072)
                require(not cmdline or before["state"] == "Z", "live-executable-unknown")
                status = bounded_read(directory / "status", 16384).decode()
                if not cmdline and re.search(r"^Kthread:\s+1$", status, re.M):
                    require(process_stat(int(directory.name))["startTicks"] == before["startTicks"], "kernel-thread-identity-changed")
                    continue
                executable = ""
            label = bounded_read(directory / "attr/current", 8192).decode().strip()
            after = process_stat(int(directory.name))
            if before["startTicks"] != after["startTicks"]:
                unknown += 1
                continue
            matches_binary += int(contains_path(str(ROOT), executable.removesuffix(" (deleted)")))
            matches_profile += int(any(part == PROFILE_NAME or part.startswith((PROFILE_NAME + " (", PROFILE_NAME + "//")) for part in label.split("//&")))
        except FileNotFoundError:
            continue
        except (PermissionError, Refusal, OSError):
            unknown += 1
    require(matches_binary == 0 and matches_profile == 0 and unknown == 0, "global-process-closure-unproven")
    return {"matchingInstallationProcesses": 0, "matchingProfileProcesses": 0, "unknownProcesses": 0,
            "scannedProcesses": len(pids), "allObservedIdentitiesGone": True}


def prepare(args):
    require(set(path.name for path in ROOT.iterdir()) == {"invocation.lock"}
            and not os.path.lexists(PROFILE_PATH), "installation-or-profile-collision")
    host = host_facts(False)
    global_closure()
    archive_path = Path(args.archive)
    require(archive_path.is_absolute(), "archive-path-invalid")
    fd = os.open(archive_path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, "rb") as source:
        info = os.fstat(source.fileno())
        require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and 0 < info.st_size <= MAX_ARCHIVE, "archive-source-invalid")
        VERSION_ROOT.mkdir(mode=0o755)
        archive_fd = os.open(ARCHIVE, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        with os.fdopen(archive_fd, "wb") as destination:
            total = 0
            while True:
                block = source.read(1024 * 1024)
                if not block:
                    break
                total += len(block)
                require(total <= MAX_ARCHIVE, "archive-source-limit")
                destination.write(block)
            destination.flush()
            os.fsync(destination.fileno())
    require(sha_file(ARCHIVE) == ARCHIVE_SHA, "archive-hash-mismatch")
    with zipfile.ZipFile(ARCHIVE) as archive:
        infos = archive_entries(archive)
        for info in infos:
            dest = VERSION_ROOT / info.filename
            for parent in reversed(dest.parents):
                if parent == VERSION_ROOT or VERSION_ROOT in parent.parents:
                    if not parent.exists():
                        parent.mkdir(mode=0o755)
                    secure_metadata(parent, True)
            if info.is_dir():
                if not dest.exists():
                    dest.mkdir(mode=0o755)
                continue
            mode = 0o755 if (info.external_attr >> 16) & 0o111 else 0o644
            out_fd = os.open(dest, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, mode)
            with os.fdopen(out_fd, "wb") as target, archive.open(info) as source:
                count = 0
                while True:
                    block = source.read(1024 * 1024)
                    if not block:
                        break
                    count += len(block)
                    require(count <= info.file_size, "archive-entry-size-mismatch")
                    target.write(block)
                require(count == info.file_size, "archive-entry-size-mismatch")
    inventory = protected_inventory()
    state = {"headSha": args.head, "runId": args.run_id, "runnerUid": args.runner_uid,
             "helperSha256": executed_helper_sha(),
             "preparedEpochMs": round(time.time() * 1000), "chromeVersion": VERSION, "chromePath": str(BINARY),
             "binarySha256": BINARY_SHA, "archiveSha256": ARCHIVE_SHA, "profileSha256": sha_bytes(PROFILE),
             "host": host, "inventory": inventory, "status": "PREPARED_NO_POLICY_LOADED"}
    exclusive_json(STATE, state)
    return {"stateSha256": sha_file(STATE), "chromePath": str(BINARY), "binarySha256": BINARY_SHA,
            "archiveSha256": ARCHIVE_SHA, "host": host, "inventoryEntryCount": inventory["entryCount"],
            "inventorySha256": inventory["sha256"], "policyLoaded": False}


def validate_baseline(value, state, now_ms):
    require(value.get("phase") == "baseline" and value.get("outcome") == "DENIED_BASELINE_CLOSED", "baseline-not-denied-and-closed")
    require(str(value.get("runAttempt")) == "1" and value.get("chromeVersion") == VERSION
            and value.get("chromePath") == str(BINARY) and value.get("binarySha256") == BINARY_SHA, "baseline-browser-mismatch")
    require(value.get("directChildClosed") is True and value.get("closure", {}).get("allObservedIdentitiesGone") is True, "baseline-closure-unproven")
    start, end = value.get("startedEpochMs"), value.get("endedEpochMs")
    require(type(start) is int and type(end) is int and state["preparedEpochMs"] <= start <= end <= now_ms
            and end - start <= 90000 and now_ms - end <= 60000, "baseline-time-window-invalid")
    items = value.get("ownedProcesses")
    require(isinstance(items, list) and 0 < len(items) <= 256, "baseline-process-list-invalid")
    root = {"pid": value.get("rootPid"), "startTicks": value.get("rootStartTicks")}
    root_identity = process_identity(root)
    require(root_identity in [process_identity(item) for item in items], "baseline-root-missing")
    return start, end, items


def attributed_denials(raw, start_ms, end_ms, items):
    ids = {process_identity(item)[0] for item in items}
    matches = []
    for line in raw.decode("utf-8", "strict").splitlines():
        row = json.loads(line)
        stamp = int(row.get("__REALTIME_TIMESTAMP", "0")) // 1000
        message = row.get("MESSAGE", "")
        require(isinstance(message, str), "journal-message-invalid")
        fields = {}
        for match in re.finditer(r'(\w+)=(?:"([^"]*)"|(\S+))', message):
            fields[match[1]] = match[2] if match[2] is not None else match[3]
        if not (start_ms <= stamp <= end_ms + 1000 and fields.get("apparmor") == "DENIED"
                and fields.get("operation") == "userns_create" and fields.get("class") == "namespace"
                and fields.get("profile") == "unconfined"
                and fields.get("comm") == "chrome" and fields.get("pid", "").isdigit()):
            continue
        pid = int(fields["pid"])
        if pid in ids:
            matches.append({"pid": pid, "epochMs": stamp, "operation": "userns_create", "result": "DENIED",
                            "profile": "unconfined", "comm": "chrome", "rawRecordSha256": sha_bytes(line.encode())})
    require(0 < len(matches) <= 64, "attributed-userns-denial-not-established")
    return matches


def unchanged_protection(state, expected):
    host = host_facts(expected)
    require(host["controls"] == state["host"]["controls"], "namespace-controls-changed")
    require(host["mountSnapshotSha256"] == state["host"]["mountSnapshotSha256"], "mounts-changed")
    require(host["policyInputsSha256"] == state["host"]["policyInputsSha256"], "parser-policy-inputs-changed")
    require(host["profiles"]["otherAttachmentsSha256"] == state["host"]["profiles"]["otherAttachmentsSha256"], "unrelated-profiles-changed")
    inventory = protected_inventory()
    require(inventory == state["inventory"], "distribution-protection-or-content-changed")
    return host


def activate(args):
    state = read_state(args)
    require(not os.path.lexists(PROFILE_PATH) and not os.path.lexists(ROOT / "activation.json"), "activation-collision")
    before = unchanged_protection(state, False)
    value, receipt_sha = request(args)
    now_ms = round(time.time() * 1000)
    start, end, items = validate_baseline(value, state, now_ms)
    closed_identities(items)
    closure = global_closure()
    raw = command(["/usr/bin/journalctl", "--kernel", "--boot", "--no-pager", "--output=json",
                   "--since=@" + str(start // 1000), "--until=@" + str((end + 1999) // 1000)], timeout=10)
    denials = attributed_denials(raw, start, end, items)
    # Recheck immediately before the only policy write. No profile replacement.
    require(not os.path.lexists(PROFILE_PATH), "profile-path-collision")
    secure_metadata(PROFILE_PATH.parent, True)
    profile_snapshot(False)
    global_closure()
    fd = os.open(PROFILE_PATH, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o644)
    with os.fdopen(fd, "wb") as stream:
        stream.write(PROFILE)
        stream.flush()
        os.fsync(stream.fileno())
    secure_metadata(PROFILE_PATH, False)
    require(bounded_read(PROFILE_PATH) == PROFILE, "profile-bytes-mismatch")
    names = command(["/usr/sbin/apparmor_parser", "--names", "--skip-kernel-load", "--skip-cache", "--jobs=0", str(PROFILE_PATH)], timeout=15, cap=65536)
    require(names.decode().splitlines() == [PROFILE_NAME], "offline-profile-set-not-exact")
    exclusive_json(ROOT / "activation-intent.json", {"headSha": args.head, "runId": args.run_id,
                   "profileSha256": sha_bytes(PROFILE), "baselineReceiptSha256": receipt_sha, "denials": denials})
    command(["/usr/sbin/apparmor_parser", "--add", "--skip-cache", "--jobs=0", str(PROFILE_PATH)], timeout=15, cap=65536)
    after = unchanged_protection(state, True)
    receipt = {"headSha": args.head, "runId": args.run_id, "profileName": PROFILE_NAME,
               "profilePath": str(PROFILE_PATH), "profileSha256": sha_bytes(PROFILE),
               "baselineReceiptSha256": receipt_sha, "attributedDenials": denials,
               "offlineProfileNames": [PROFILE_NAME], "tunablesAssignmentsAndIncludesOnly": True,
               "namespaceControlsUnchanged": before["controls"] == after["controls"],
               "closureBeforeActivation": closure, "profileObservation": after["profiles"], "policyLoaded": True}
    exclusive_json(ROOT / "activation.json", receipt)
    return receipt


def read_active(state):
    secure_metadata(ROOT / "activation.json", False)
    secure_metadata(PROFILE_PATH, False)
    require(bounded_read(PROFILE_PATH) == PROFILE, "profile-bytes-mismatch")
    require(not os.path.lexists(ROOT / "finalized.json"), "trial-already-finalized")
    # Full distribution hashing is performed before/after each launch phase via
    # closure; live attestation hashes the exact pinned executable only.
    require(sha_file(BINARY) == BINARY_SHA, "binary-hash-mismatch")
    profile_snapshot(True)


def attest_process(item, runner_uid):
    pid, start = process_identity(item)
    row = process_stat(pid)
    require(row["startTicks"] == start, "process-identity-changed")
    executable = os.readlink(f"/proc/{pid}/exe")
    require(executable in {str(BINARY), str(DISTRIBUTION / "chrome_crashpad_handler")}, "unexpected-process-executable")
    secure_metadata(Path(executable), False)
    raw_argv = bounded_read(f"/proc/{pid}/cmdline", 131072)
    argv = raw_argv.decode().rstrip("\x00").split("\x00")
    require(not any(arg.split("=", 1)[0] in FORBIDDEN_FLAGS for arg in argv), "sandbox-disabling-argument")
    status = {}
    for line in bounded_read(f"/proc/{pid}/status", 16384).decode().splitlines():
        name, _, val = line.partition(":")
        if name in {"Uid", "Gid", "NSpid", "NoNewPrivs", "Seccomp", "Seccomp_filters", "CapEff"}:
            status[name] = val.strip()
    uid_values = [int(x) for x in status["Uid"].split()]
    require(uid_values == [runner_uid] * 4, "unexpected-process-owner")
    role = "crashpad" if executable.endswith("/chrome_crashpad_handler") else "browser"
    types = [arg[7:] for arg in argv if arg.startswith("--type=")]
    require(len(types) <= 1, "ambiguous-process-type")
    if types:
        require(types[0] in {"renderer", "zygote", "gpu-process", "utility"}, "unexpected-process-type")
        role = types[0]
    label = bounded_read(f"/proc/{pid}/attr/current", 8192).decode().strip()
    require(label in {PROFILE_NAME, PROFILE_NAME + " (unconfined)", "unconfined"}, "unexpected-process-profile")
    require(executable != str(BINARY) or label.startswith(PROFILE_NAME), "chrome-profile-not-attached")
    namespaces = {name: os.readlink(f"/proc/{pid}/ns/{name}") for name in ("user", "pid", "net", "mnt")}
    maps = {}
    for name in ("uid", "gid"):
        lines = bounded_read(f"/proc/{pid}/{name}_map", 4096).decode().splitlines()
        require(0 < len(lines) <= 8, "namespace-map-invalid")
        maps[name + "Map"] = [[int(x) for x in line.split()] for line in lines]
        require(all(len(line) == 3 and all(x >= 0 for x in line) for line in maps[name + "Map"]), "namespace-map-invalid")
    require(process_stat(pid)["startTicks"] == start, "process-identity-changed")
    for field in ("NoNewPrivs", "Seccomp", "Seccomp_filters"):
        require(re.fullmatch(r"[0-9]{1,8}", status.get(field, "")), "process-restriction-unknown")
    require(re.fullmatch(r"[a-f0-9]{1,32}", status.get("CapEff", "")), "process-capabilities-unknown")
    return {**row, "uid": runner_uid, "role": role, "executable": executable, "label": label,
            "argvSha256": sha_bytes(raw_argv), "NSpid": [int(x) for x in status.get("NSpid", "").split()],
            "binarySha256": BINARY_SHA if executable == str(BINARY) else sha_file(executable),
            "NoNewPrivs": int(status["NoNewPrivs"]), "Seccomp": int(status["Seccomp"]),
            "Seccomp_filters": int(status["Seccomp_filters"]), "CapEff": status["CapEff"], "namespaces": namespaces, **maps}


def attest(args):
    state = read_state(args)
    read_active(state)
    value, receipt_sha = request(args)
    items = value.get("ownedProcesses")
    require(isinstance(items, list) and 0 < len(items) <= 64, "attest-process-list-invalid")
    root_id = process_identity({"pid": value.get("rootPid"), "startTicks": value.get("rootStartTicks")})
    require(root_id in [process_identity(item) for item in items], "attest-root-missing")
    rows = [attest_process(item, state["runnerUid"]) for item in items]
    root = next(row for row in rows if row["pid"] == root_id[0])
    require(root["role"] == "browser" and root["pgrp"] == root["pid"] and root["session"] == root["pid"], "attest-root-ownership-invalid")
    by_pid = {row["pid"]: row for row in rows}
    require(len(by_pid) == len(rows), "attest-duplicate-process")
    for row in rows:
        if row is root:
            continue
        parent, seen = row["ppid"], set()
        while parent in by_pid and parent != root["pid"] and parent not in seen:
            seen.add(parent)
            parent = by_pid[parent]["ppid"]
        require(parent == root["pid"] or (row["pgrp"] == root["pid"] and row["session"] == root["pid"]), "attest-process-not-owned-tree")
    return {"processes": rows, "rootNamespaces": {name: os.readlink("/proc/self/ns/" + name) for name in ("user", "pid", "net", "mnt")},
            "rootUid": state["runnerUid"], "profileName": PROFILE_NAME, "requestSha256": receipt_sha}


def closure(args):
    state = read_state(args)
    expected = (ROOT / "activation.json").exists()
    unchanged_protection(state, expected)
    if args.request:
        value, _ = request(args)
        closed_identities(value.get("ownedProcesses"))
    return {**global_closure(), "policyLoaded": expected, "binarySha256": BINARY_SHA,
            "inventorySha256": state["inventory"]["sha256"], "namespaceControlsUnchanged": True}


def gate(args):
    state = read_state(args)
    read_active(state)
    result = closure(args)
    require(result["policyLoaded"] is True, "matrix-policy-not-active")
    return {**result, "profileName": PROFILE_NAME, "profileSha256": sha_bytes(PROFILE), "fullProtectionReverified": True}


def stop(args):
    """Signal only receipt-owned exact PID/start identities through pidfds."""
    state = read_state(args)
    value, receipt_sha = request(args)
    items = value.get("ownedProcesses")
    require(isinstance(items, list) and 0 < len(items) <= 256, "stop-process-list-invalid")
    root = process_identity({"pid": value.get("rootPid"), "startTicks": value.get("rootStartTicks")})
    require(root in [process_identity(item) for item in items], "stop-root-missing")
    fds, gone, term_count, kill_count = [], 0, 0, 0
    try:
        # Validate the whole set before sending any signal. A receipt alone is
        # never authority to kill a different executable, user, or reused PID.
        for item in items:
            pid, start = process_identity(item)
            try:
                fd = os.pidfd_open(pid)
            except ProcessLookupError:
                gone += 1
                continue
            try:
                current = process_stat(pid)
                if current["startTicks"] != start:
                    os.close(fd)
                    gone += 1
                    continue
                executable = os.readlink(f"/proc/{pid}/exe")
                require(executable in {str(BINARY), str(DISTRIBUTION / "chrome_crashpad_handler")}, "stop-executable-mismatch")
                uid = re.search(r"^Uid:\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)$", bounded_read(f"/proc/{pid}/status", 16384).decode(), re.M)
                require(uid and [int(x) for x in uid.groups()] == [state["runnerUid"]] * 4, "stop-owner-mismatch")
                label = bounded_read(f"/proc/{pid}/attr/current", 8192).decode().strip()
                allowed = {PROFILE_NAME, PROFILE_NAME + " (unconfined)"}
                if not (ROOT / "activation-intent.json").exists() or executable.endswith("/chrome_crashpad_handler"):
                    allowed.add("unconfined")
                require(label in allowed, "stop-profile-mismatch")
                require(process_stat(pid)["startTicks"] == start, "stop-identity-changed")
                fds.append(fd)
            except FileNotFoundError:
                os.close(fd)
                gone += 1
            except BaseException:
                os.close(fd)
                raise
        for fd in fds:
            try:
                signal.pidfd_send_signal(fd, signal.SIGTERM)
                term_count += 1
            except ProcessLookupError:
                pass
        selector = selectors.DefaultSelector()
        try:
            for fd in fds:
                selector.register(fd, selectors.EVENT_READ)
            end = time.monotonic() + 1
            while selector.get_map() and time.monotonic() < end:
                for key, _ in selector.select(min(0.05, max(0, end - time.monotonic()))):
                    selector.unregister(key.fd)
            for fd in list(selector.get_map()):
                try:
                    signal.pidfd_send_signal(fd, signal.SIGKILL)
                    kill_count += 1
                except ProcessLookupError:
                    pass
            end = time.monotonic() + 1
            while selector.get_map() and time.monotonic() < end:
                for key, _ in selector.select(min(0.05, max(0, end - time.monotonic()))):
                    selector.unregister(key.fd)
            require(not selector.get_map(), "owned-process-exit-unconfirmed")
        finally:
            selector.close()
    finally:
        for fd in fds:
            os.close(fd)
    # pidfd readiness confirms exit, not parent reaping or global closure. The
    # proof caller still must await its direct child and call closure.
    return {"requestSha256": receipt_sha, "alreadyGoneOrReused": gone, "termSignals": term_count,
            "killSignals": kill_count, "capturedProcessesExited": True, "globalClosureStillRequired": True,
            "ownershipBasis": "reviewed-caller-historical-tree-plus-current-pidfd-start-executable-uid-label"}


def export(args):
    state = read_state(args)
    documents = {"trial-state.json": state}
    for name in ("activation-intent.json", "activation.json", "finalized.json"):
        path = ROOT / name
        if path.exists():
            secure_metadata(path, False)
            documents[name] = json.loads(bounded_read(path, MAX_LOG))
    for path in sorted(ROOT.glob("command-intent-*.json")):
        require(re.fullmatch(r"command-intent-[0-9]{3}(?:-closed)?\.json", path.name), "unexpected-command-record")
        secure_metadata(path, False)
        documents[path.name] = json.loads(bounded_read(path, 8192))
    # The complete root inventory is retained locally and copied as a reviewed
    # evidence artifact; only hashes/counts are printed to Actions logs.
    return {"documents": documents, "profileFileRetained": PROFILE_PATH.exists(), "rootStateSha256": sha_file(STATE),
            "pendingCommandClosures": pending_command_intents()}


def finalize(args):
    state = read_state(args)
    require(not os.path.lexists(ROOT / "finalized.json"), "already-finalized")
    if not (ROOT / "activation-intent.json").exists():
        return {**global_closure(), "policyLoaded": False, "cleanup": "no-policy-load-attempted"}
    # An interrupted add may have succeeded even without activation.json.
    # Only an exact observed profile and our retained intent establish ownership.
    secure_metadata(ROOT / "activation-intent.json", False)
    intent = json.loads(bounded_read(ROOT / "activation-intent.json"))
    require(intent["headSha"] == args.head and intent["runId"] == args.run_id and intent["profileSha256"] == sha_bytes(PROFILE), "cleanup-intent-mismatch")
    unchanged_protection(state, True)
    secure_metadata(PROFILE_PATH, False)
    require(bounded_read(PROFILE_PATH) == PROFILE, "cleanup-profile-changed")
    closed = global_closure()
    command(["/usr/sbin/apparmor_parser", "--remove", "--skip-cache", "--jobs=0", str(PROFILE_PATH)], timeout=15, cap=65536)
    after = host_facts(False)
    require(after["controls"] == state["host"]["controls"], "cleanup-controls-changed")
    result = {**closed, "policyLoaded": False, "cleanup": "unique-owned-profile-unloaded-files-retained",
              "profileFileRetained": True, "distributionRetained": True, "namespaceControlsUnchanged": True}
    exclusive_json(ROOT / "finalized.json", result)
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=("prepare", "activate", "attest", "closure", "gate", "stop", "finalize", "export"))
    parser.add_argument("--archive")
    parser.add_argument("--request")
    parser.add_argument("--head", required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--runner-uid", type=int)
    args = parser.parse_args()
    lock_fd = None
    try:
        require(re.fullmatch(r"[0-9a-f]{40}", args.head) and re.fullmatch(r"[0-9]{1,20}", args.run_id), "invalid-run-identity")
        executed_helper_sha()
        require(os.geteuid() == 0 and sys.platform == "linux", "root-linux-required")
        require((args.action == "prepare") == bool(args.archive), "invalid-archive-argument")
        require(args.action not in {"activate", "attest", "stop"} or bool(args.request), "missing-request")
        require(args.action != "prepare" or (type(args.runner_uid) is int and 0 < args.runner_uid < 65536), "invalid-runner-uid")
        os.umask(0o022)
        signal.signal(signal.SIGALRM, lambda *_: (_ for _ in ()).throw(Refusal("helper-deadline")))
        signal.alarm(180 if args.action == "prepare" else 60)
        lock_fd = invocation_lock(args.action)
        result = globals()[args.action](args)
        result = {"status": "PASS", "action": args.action, "headSha": args.head, "runId": args.run_id, **result}
        encoded = json.dumps(result, separators=(",", ":"), ensure_ascii=True).replace("#", "\\u0023")
        require(len(encoded.encode()) < 131072, "public-output-limit")
        print(encoded)
    except BaseException as error:
        code = str(error) if isinstance(error, Refusal) and re.fullmatch(r"[a-z0-9-]{1,80}", str(error)) else "unexpected-operation-failure"
        result = {"status": "FAIL", "action": args.action, "code": code, "disposalRequiredIfPolicyOrClosureUncertain": True}
        if isinstance(error, Refusal) and hasattr(error, "tunable_diagnostic"):
            result["tunableDiagnostic"] = error.tunable_diagnostic
        print(json.dumps(result))
        return 1
    finally:
        if lock_fd is not None:
            os.close(lock_fd)
        signal.alarm(0)
    return 0


if __name__ == "__main__":
    sys.exit(main())
