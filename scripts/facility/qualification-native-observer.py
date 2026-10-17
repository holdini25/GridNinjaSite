#!/usr/bin/env python3
"""Pinned browser preparation and passive native-sandbox observation.

Only prepare writes a new distribution/state below ROOT. All other actions are
read-only. No command execution, policy access beyond scalar identity/revision,
profile enumeration, signalling, environment dumping or network access.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import platform
import re
import signal
import stat
import sys
import time
import zipfile

VERSION = "155.0.8059.79"
ROOT = Path("/var/lib/gridninja-cft")
VERSION_ROOT = ROOT / VERSION
DISTRIBUTION = VERSION_ROOT / "chrome-linux64"
BINARY = DISTRIBUTION / "chrome"
ARCHIVE = ROOT / "chrome-linux64.zip"
STATE = ROOT / "native-state.json"
ARCHIVE_SHA = "bcd9a79130d7e44d70f93be87042e9bcee7fe0f0b3898e06b8c9bed5fb619dcd"
BINARY_SHA = "58957d0e74a9073626131018aabf17d97318227cca9b5dbdf5dee16345f2d211"
SCHEMA = "gridninja-native-sandbox.v1"
MAX_LOG = 1024 * 1024
MAX_ARCHIVE = 300 * 1024 * 1024
MAX_UNPACKED = 1024 * 1024 * 1024
MAX_ENTRIES = 4096
FORBIDDEN_FLAGS = {"--no-sandbox", "--disable-namespace-sandbox", "--disable-seccomp-filter-sandbox",
                   "--disable-gpu-sandbox", "--single-process", "--no-zygote"}
NAMESPACES = ("user", "pid", "net", "mnt")

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


def validate_mounts(mounts):
    roots = [row for row in mounts if row["target"] == "/"]
    require(len(roots) == 1, "ambiguous-root-mount")
    root = roots[0]
    require(root["root"] == "/" and "rw" in root["options"], "unexpected-root-mount")
    for row in mounts:
        if row is root:
            continue
        require(not contains_path(row["target"], str(ROOT))
                and not contains_path(str(ROOT), row["target"]), "protected-mount-overlay")
        if row["device"] == root["device"]:
            require(not contains_path(row["root"], str(ROOT))
                    and not contains_path(str(ROOT), row["root"]), "protected-mount-alias")
    return {"rootMountId": root["id"], "rootDevice": root["device"],
            "rootFilesystem": root["fstype"], "protectedAliasCount": 0}


def scalar_fact(path, kind="number", optional=True, revision=False):
    """Fresh fd and one read: AppArmor revisions are event-like, not EOF streams."""
    try:
        if revision:
            fd = os.open(path, os.O_RDONLY | os.O_CLOEXEC | os.O_NONBLOCK)
            try:
                raw = os.read(fd, 257)
            finally:
                os.close(fd)
            require(len(raw) <= 256, "scalar-size-limit")
        else:
            raw = bounded_read(path, 256)
    except FileNotFoundError:
        require(optional, "required-context-absent")
        return {"status": "absent"}
    # Permission failures are surfaced as a fixed code by main, allowing one
    # read-only sudo observation without treating unreadability as absence.
    text = raw.decode("utf-8", "strict").rstrip("\n")
    if kind == "number":
        require(re.fullmatch(r"[0-9]{1,20}", text), "scalar-number-invalid")
        value = int(text)
    elif kind == "bool":
        require(text in {"Y", "N", "yes", "no"}, "scalar-boolean-invalid")
        value = text in {"Y", "yes"}
    else:
        require(text and len(text) <= 255 and all(32 <= ord(c) < 127 for c in text), "scalar-text-invalid")
        value = text
    return {"status": "present", "value": value}


def read_label(pid):
    text = bounded_read(f"/proc/{pid}/attr/current", 8192).decode("utf-8", "strict").rstrip("\n")
    require(text and len(text) <= 8191 and all(32 <= ord(c) < 127 for c in text), "process-label-invalid")
    mode = "unconfined" if text == "unconfined" else None
    match = re.search(r" \((enforce|complain|unconfined|kill|prompt)\)$", text)
    if match:
        mode = match[1]
    return text, mode


def read_namespaces(pid):
    out = {}
    for name in NAMESPACES:
        value = os.readlink(f"/proc/{pid}/ns/{name}")
        require(re.fullmatch(name + r":\[[1-9][0-9]*\]", value), "namespace-identity-invalid")
        out[name] = value
    return out


def process_stat(pid):
    raw = bounded_read(f"/proc/{pid}/stat", 8192).decode("utf-8", "strict")
    require(raw.startswith(str(pid) + " (") and ") " in raw, "process-stat-invalid")
    fields = raw[raw.rfind(") ") + 2:].split()
    require(len(fields) >= 20 and fields[0] in "RSDZTWXIPt", "process-stat-invalid")
    require(all(re.fullmatch(r"[0-9]+", fields[i]) for i in (1, 2, 3, 19)), "process-stat-invalid")
    return {"pid": pid, "ppid": int(fields[1]), "pgrp": int(fields[2]), "session": int(fields[3]),
            "startTicks": fields[19], "state": fields[0]}


def parse_status(raw):
    keys = {"Uid", "Gid", "NSpid", "NoNewPrivs", "Seccomp", "Seccomp_filters", "CapEff"}
    values = {}
    for line in raw.decode("utf-8", "strict").splitlines():
        name, sep, val = line.partition(":")
        if sep and name in keys:
            require(name not in values, "duplicate-process-status")
            values[name] = val.strip()
    require(keys <= values.keys(), "process-status-incomplete")
    for key in ("Uid", "Gid"):
        require(re.fullmatch(r"[0-9]+(?:\s+[0-9]+){3}", values[key]), "process-owner-invalid")
        values[key] = [int(x) for x in values[key].split()]
    require(re.fullmatch(r"[0-9]+(?:\s+[0-9]+)*", values["NSpid"]), "process-nspid-invalid")
    values["NSpid"] = [int(x) for x in values["NSpid"].split()]
    for key in ("NoNewPrivs", "Seccomp", "Seccomp_filters"):
        require(re.fullmatch(r"[0-9]{1,8}", values[key]), "process-restriction-unknown")
        values[key] = int(values[key])
    require(re.fullmatch(r"[a-fA-F0-9]{1,32}", values["CapEff"]), "process-capabilities-unknown")
    return values


def read_map(pid, kind):
    lines = bounded_read(f"/proc/{pid}/{kind}_map", 4096).decode().splitlines()
    require(0 < len(lines) <= 8 and all(re.fullmatch(r"\s*[0-9]+\s+[0-9]+\s+[0-9]+\s*", x) for x in lines), "namespace-map-invalid")
    values = [[int(x) for x in line.split()] for line in lines]
    require(all(row[2] > 0 for row in values), "namespace-map-invalid")
    return values


def process_context(item, runner_uid, browser=False):
    pid, start = process_identity(item)
    before = process_stat(pid)
    require(before["startTicks"] == start and before["state"] not in {"Z", "X"}, "process-identity-changed")
    executable = os.readlink(f"/proc/{pid}/exe")
    raw_argv = bounded_read(f"/proc/{pid}/cmdline", 131072)
    require(raw_argv.endswith(b"\0") and raw_argv != b"\0", "process-argv-invalid")
    argv = raw_argv[:-1].decode("utf-8", "strict").split("\0")
    status = parse_status(bounded_read(f"/proc/{pid}/status", 16384))
    require(status["Uid"] == [runner_uid] * 4 and runner_uid > 0, "unexpected-process-owner")
    require(len(set(status["Gid"])) == 1, "unexpected-process-group-owner")
    label, mode = read_label(pid)
    namespaces = read_namespaces(pid)
    uid_map, gid_map = read_map(pid, "uid"), read_map(pid, "gid")
    role = "runner"
    if browser:
        require(executable in {str(BINARY), str(DISTRIBUTION / "chrome_crashpad_handler")}, "unexpected-process-executable")
        secure_metadata(Path(executable), False)
        require(not any(arg.split("=", 1)[0] in FORBIDDEN_FLAGS for arg in argv), "sandbox-disabling-argument")
        types = [arg[7:] for arg in argv if arg.startswith("--type=")]
        require(len(types) <= 1, "ambiguous-process-type")
        role = "crashpad" if executable.endswith("/chrome_crashpad_handler") else "browser"
        if types:
            require(types[0] in {"renderer", "zygote", "gpu-process", "utility"}, "unexpected-process-type")
            role = types[0]
    executable_stat = os.stat(f"/proc/{pid}/exe")
    executable_sha = sha_file(f"/proc/{pid}/exe")
    if executable == str(BINARY):
        require(executable_sha == BINARY_SHA, "running-binary-hash-mismatch")
    after = process_stat(pid)
    require(all(before[key] == after[key] for key in ("pid", "ppid", "pgrp", "session", "startTicks")), "process-identity-or-parent-changed")
    require(after["state"] not in {"Z", "X"}, "process-exited-during-observation")
    require(os.readlink(f"/proc/{pid}/exe") == executable
            and bounded_read(f"/proc/{pid}/cmdline", 131072) == raw_argv
            and read_label(pid) == (label, mode) and read_namespaces(pid) == namespaces,
            "process-context-changed")
    repeated = parse_status(bounded_read(f"/proc/{pid}/status", 16384))
    require(repeated == status and read_map(pid, "uid") == uid_map and read_map(pid, "gid") == gid_map,
            "process-restrictions-changed")
    return {**before, "uid": runner_uid, "gid": status["Gid"][0], "role": role,
            "executable": executable, "executableDevice": executable_stat.st_dev,
            "executableInode": executable_stat.st_ino, "binarySha256": executable_sha,
            "argvSha256": sha_bytes(raw_argv), "label": label, "labelMode": mode,
            "namespaces": namespaces, "uidMap": uid_map, "gidMap": gid_map,
            **{key: status[key] for key in ("NSpid", "NoNewPrivs", "Seccomp", "Seccomp_filters", "CapEff")}}


def stable_context(row):
    # Process scheduling state is expected to change; executable/identity,
    # namespace, policy label, argv, owners and restrictions are not.
    return {key: value for key, value in row.items() if key != "state"}


def host_facts():
    require(platform.system() == "Linux" and platform.machine() == "x86_64", "unsupported-execution-host")
    os_release = bounded_read("/etc/os-release", 8192).decode()
    require(re.search(r'^ID=ubuntu$', os_release, re.M)
            and re.search(r'^VERSION_ID="26\.04"$', os_release, re.M), "unexpected-os")
    controls = {name: scalar_fact(path) for name, path in {
        "apparmorUserns": "/proc/sys/kernel/apparmor_restrict_unprivileged_userns",
        "unprivilegedUserns": "/proc/sys/kernel/unprivileged_userns_clone",
        "maxUserNamespaces": "/proc/sys/user/max_user_namespaces"}.items()}
    enabled = scalar_fact("/sys/module/apparmor/parameters/enabled", "bool")
    lsm = scalar_fact("/sys/kernel/security/lsm", "text", optional=False)
    require(all(re.fullmatch(r"[a-z_]{1,32}", x) for x in lsm["value"].split(",")), "lsm-names-invalid")
    apparmor = "apparmor" in lsm["value"].split(",")
    require(not apparmor or enabled == {"status": "present", "value": True}, "apparmor-context-inconsistent")
    prefix = "/sys/kernel/security/apparmor/"
    policy = {name: scalar_fact(prefix + file, kind, optional=not apparmor, revision=revision)
              for name, file, kind, revision in (
                  ("namespaceName", ".ns_name", "text", False),
                  ("namespaceLevel", ".ns_level", "number", False),
                  ("namespaceStacked", ".ns_stacked", "bool", False),
                  ("stacked", ".stacked", "bool", False),
                  ("revision", "policy/revision", "number", True))}
    mounts = validate_mounts(parse_mounts(bounded_read("/proc/self/mountinfo", MAX_LOG)))
    return {"kernel": platform.release(), "architecture": "x86_64", "os": "ubuntu26.04",
            "osReleaseSha256": sha_bytes(os_release.encode()), "controls": controls,
            "protectedAncestors": [secure_metadata(Path(p), True) for p in ("/", "/var", "/var/lib")],
            "apparmorEnabled": enabled, "lsm": lsm, "policyContext": policy,
            "mounts": mounts, "observerLabel": read_label("self")[0],
            "observerNamespaces": read_namespaces("self")}


def installation_closure():
    """Scan executable identities only; shared natural labels are irrelevant."""
    entries = [p for p in Path("/proc").iterdir() if p.name.isdigit()]
    require(len(entries) <= 32768, "process-scan-limit")
    matches, unknown = 0, 0
    for directory in entries:
        try:
            before = process_stat(int(directory.name))
            try:
                executable = os.readlink(directory / "exe")
            except FileNotFoundError:
                cmdline = bounded_read(directory / "cmdline", 131072)
                require(not cmdline or before["state"] == "Z", "live-executable-unknown")
                executable = ""
            after = process_stat(int(directory.name))
            require(before["startTicks"] == after["startTicks"], "process-scan-identity-changed")
            matches += int(contains_path(str(ROOT), executable.removesuffix(" (deleted)")))
        except FileNotFoundError:
            continue
        except PermissionError:
            raise
        except (Refusal, OSError):
            unknown += 1
    require(matches == 0 and unknown == 0, "installation-process-closure-unproven")
    return {"matchingInstallationProcesses": matches, "unknownProcesses": unknown,
            "scannedProcessCount": len(entries)}


def read_request(stream):
    raw = stream.read(131073)
    require(len(raw) <= 131072, "request-size-limit")
    value = json.loads(raw)
    require(isinstance(value, dict) and value.get("schemaVersion") == SCHEMA, "request-schema-invalid")
    require(re.fullmatch(r"[a-f0-9]{40}", str(value.get("headSha", "")))
            and re.fullmatch(r"[1-9][0-9]{0,19}", str(value.get("runId", ""))), "request-run-invalid")
    require(type(value.get("runnerUid")) is int and 0 < value["runnerUid"] < 65536, "request-uid-invalid")
    process_identity(value.get("caller"))
    return value


def prepare(value):
    require(os.geteuid() == 0, "root-required-for-prepare")
    require(not os.path.lexists(ROOT), "installation-collision")
    for path in (Path("/"), Path("/var"), Path("/var/lib")):
        secure_metadata(path, True)
    host = host_facts()
    caller = process_context(value["caller"], value["runnerUid"])
    require(caller["namespaces"] == host["observerNamespaces"], "runner-observer-namespace-mismatch")
    installation_closure()
    archive_path = Path(value.get("archivePath", ""))
    require(archive_path.is_absolute(), "archive-path-invalid")
    fd = os.open(archive_path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, "rb") as source:
        info = os.fstat(source.fileno())
        require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and 0 < info.st_size <= MAX_ARCHIVE, "archive-source-invalid")
        ROOT.mkdir(mode=0o755)
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
        for info in archive_entries(archive):
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
    require(host_facts() == host, "host-context-changed-during-prepare")
    require(stable_context(process_context(value["caller"], value["runnerUid"])) == stable_context(caller),
            "runner-context-changed-during-prepare")
    state = {"schemaVersion": SCHEMA, "headSha": value["headSha"], "runId": str(value["runId"]),
             "runnerUid": value["runnerUid"], "helperSha256": executed_helper_sha(),
             "preparedEpochMs": round(time.time() * 1000), "chromeVersion": VERSION,
             "chromePath": str(BINARY), "binarySha256": BINARY_SHA, "archiveSha256": ARCHIVE_SHA,
             "host": host, "callerContext": stable_context(caller), "inventory": inventory,
             "attachmentCollisionStatus": "NOT_DETERMINED", "insertionTrialStatus": "NOT_ATTEMPTED"}
    exclusive_json(STATE, state)
    return {"stateSha256": sha_file(STATE), "chromePath": str(BINARY), "binarySha256": BINARY_SHA,
            "archiveSha256": ARCHIVE_SHA, "currentHostFacts": host, "callerContext": caller,
            "inventoryEntryCount": inventory["entryCount"], "inventorySha256": inventory["sha256"],
            "securityPolicyChanged": False}


def read_state(value):
    for path in (ROOT, VERSION_ROOT, DISTRIBUTION):
        secure_metadata(path, True)
    secure_metadata(STATE, False)
    state = json.loads(bounded_read(STATE, MAX_LOG))
    require(state["schemaVersion"] == SCHEMA and state["headSha"] == value["headSha"]
            and state["runId"] == str(value["runId"]) and state["runnerUid"] == value["runnerUid"], "state-binding-mismatch")
    require(state["helperSha256"] == executed_helper_sha(), "helper-binding-mismatch")
    require(state["binarySha256"] == BINARY_SHA and state["archiveSha256"] == ARCHIVE_SHA, "state-pin-mismatch")
    require(process_identity(state["callerContext"]) == process_identity(value["caller"]), "caller-identity-mismatch")
    return state


def checked_context(value, full_inventory=True):
    state = read_state(value)
    host = host_facts()
    require(host == state["host"], "host-security-context-changed")
    caller = stable_context(process_context(value["caller"], state["runnerUid"]))
    require(caller == state["callerContext"], "runner-context-changed")
    if full_inventory:
        require(protected_inventory() == state["inventory"], "protected-distribution-changed")
    else:
        require(sha_file(BINARY) == BINARY_SHA, "binary-hash-mismatch")
    return state, host, caller


def context(value):
    state, host, caller = checked_context(value)
    return {"baselineSha256": sha_file(STATE), "currentHostFacts": host, "callerContext": caller,
            "inventorySha256": state["inventory"]["sha256"], "namespaceControlsUnchanged": True,
            **installation_closure()}


def assert_process_tree(rows, root, caller):
    by_pid = {row["pid"]: row for row in rows}
    require(len(by_pid) == len(rows), "duplicate-attested-process")
    require(root["ppid"] == caller["pid"], "browser-root-parent-mismatch")
    for row in rows:
        if row["pid"] == root["pid"]:
            continue
        parent, seen = row["ppid"], set()
        while parent in by_pid and parent != root["pid"] and parent not in seen:
            seen.add(parent)
            parent = by_pid[parent]["ppid"]
        require(parent == root["pid"], "process-not-current-owned-descendant")


def assert_renderer(row, root, runner_uid):
    require(row["role"] == "renderer" and row["executable"] == str(BINARY)
            and row["binarySha256"] == BINARY_SHA and row["uid"] == runner_uid, "renderer-identity-invalid")
    require(row["NoNewPrivs"] == 1 and row["Seccomp"] == 2 and row["Seccomp_filters"] > 0
            and int(row["CapEff"], 16) == 0, "renderer-kernel-sandbox-missing")
    require(all(row["namespaces"][name] != root["namespaces"][name] for name in ("user", "pid", "net")),
            "renderer-namespace-not-isolated")
    require(len(row["uidMap"]) == 1 and row["uidMap"][0][1:] == [runner_uid, 1], "renderer-user-map-invalid")
    require(len(row["gidMap"]) == 1 and row["gidMap"][0][1:] == [row["gid"], 1], "renderer-group-map-invalid")
    require(len(row["NSpid"]) > len(root["NSpid"]) and row["NSpid"][0] == row["pid"], "renderer-pid-map-invalid")


def attest(value):
    state, host, caller = checked_context(value, full_inventory=False)
    items = value.get("ownedProcesses")
    require(isinstance(items, list) and 0 < len(items) <= 64, "attest-process-list-invalid")
    root_id = process_identity({"pid": value.get("rootPid"), "startTicks": value.get("rootStartTicks")})
    require(root_id in [process_identity(item) for item in items], "attest-root-missing")
    rows = [process_context(item, state["runnerUid"], browser=True) for item in items]
    root = next(row for row in rows if row["pid"] == root_id[0])
    require(root["role"] == "browser" and root["argvSha256"] == value.get("expectedArgvSha256"), "browser-root-identity-invalid")
    require(root["namespaces"] == caller["namespaces"], "browser-root-namespace-not-runner")
    assert_process_tree(rows, root, caller)
    renderer_pids = value.get("rendererPids")
    require(isinstance(renderer_pids, list) and 0 < len(renderer_pids) <= 32
            and all(type(pid) is int for pid in renderer_pids) and len(set(renderer_pids)) == len(renderer_pids), "renderer-list-invalid")
    by_pid = {row["pid"]: row for row in rows}
    for pid in renderer_pids:
        require(pid in by_pid, "renderer-process-missing")
        assert_renderer(by_pid[pid], root, state["runnerUid"])
    require(host_facts() == host, "host-context-changed-during-attestation")
    for row in rows:
        after = process_stat(row["pid"])
        require(all(after[key] == row[key] for key in ("pid", "ppid", "pgrp", "session", "startTicks"))
                and after["state"] not in {"Z", "X"}, "attested-tree-changed")
        require(read_label(row["pid"])[0] == row["label"] and read_namespaces(row["pid"]) == row["namespaces"],
                "attested-context-changed")
    return {"processes": rows, "callerContext": caller, "currentHostFacts": host,
            "rootNamespaces": caller["namespaces"], "rendererPids": renderer_pids,
            "observedRendererSandbox": True}


def closure(value):
    state, host, caller = checked_context(value)
    items = value.get("ownedProcesses", [])
    require(isinstance(items, list) and len(items) <= 256, "closure-process-list-invalid")
    if items:
        closed_identities(items)
    result = installation_closure()
    return {**result, "allObservedIdentitiesGone": True, "observedIdentityCount": len(items),
            "inventorySha256": state["inventory"]["sha256"], "binarySha256": BINARY_SHA,
            "namespaceControlsUnchanged": True, "currentHostFacts": host, "callerContext": caller}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=("prepare", "context", "attest", "closure"))
    args = parser.parse_args()
    value = None
    try:
        executed_helper_sha()
        require(sys.platform == "linux", "linux-required")
        os.umask(0o022)
        signal.signal(signal.SIGALRM, lambda *_: (_ for _ in ()).throw(Refusal("helper-deadline")))
        signal.alarm(120 if args.action == "prepare" else 60)
        value = read_request(sys.stdin.buffer)
        result = {"status": "PASS", "action": args.action, "headSha": value["headSha"], "runId": str(value["runId"]),
                  "schemaVersion": SCHEMA, **globals()[args.action](value),
                  "attachmentCollisionStatus": "NOT_DETERMINED", "insertionTrialStatus": "NOT_ATTEMPTED"}
        encoded = json.dumps(result, separators=(",", ":"), ensure_ascii=True).replace("#", "\\u0023")
        require(len(encoded.encode()) < 131072, "output-limit")
        print(encoded)
    except BaseException as error:
        code = str(error) if isinstance(error, Refusal) and re.fullmatch(r"[a-z0-9-]{1,80}", str(error)) else "permission-denied" if isinstance(error, PermissionError) else "unexpected-operation-failure"
        print(json.dumps({"status": "FAIL", "action": args.action, "code": code,
                          "headSha": value.get("headSha") if isinstance(value, dict) else None,
                          "runId": str(value.get("runId")) if isinstance(value, dict) else None,
                          "attachmentCollisionStatus": "NOT_DETERMINED", "insertionTrialStatus": "NOT_ATTEMPTED"}))
        return 1
    finally:
        signal.alarm(0)
    return 0


if __name__ == "__main__":
    sys.exit(main())
