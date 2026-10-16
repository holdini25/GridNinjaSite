#!/usr/bin/env python3
"""Read-only, bounded AppArmor attachment inventory. Never a qualification gate.

No arguments, external commands, policy queries, or writes other than stdout.
The one intentional policy magic link is opened once; all policy traversal uses
held directory descriptors, O_NOFOLLOW, fixed field names, and one AAFS device.
"""
import contextlib
import ctypes
import errno
import hashlib
import json
import os
import re
import signal
import stat
import sys
import time
import unicodedata

POLICY = "/sys/kernel/security/apparmor/policy"
AAFS_MAGIC = 0x5A3C69F0
MAX_TEXT = 8192
MAX_PROFILES = 1024
MAX_NAMESPACES = 128
MAX_DEPTH = 32
MAX_RELEVANT = 128
MAX_RAW = 16 * 1024 * 1024
MAX_RAW_TOTAL = 64 * 1024 * 1024
MAX_OUTPUT = 240 * 1024  # Reserve 16 KiB for the unprivileged workflow envelope.
MAX_SECONDS = 30
TARGET = "/var/lib/gridninja-cft/155.0.8059.79/chrome-linux64/chrome"
TARGET_NAME = "gridninja-cft-155"
FIELDS = {"name", "mode", "attach", "sha256", "revision", "abi", "compressed_size"}
RAW_FIELDS = {"raw_data": "raw_data", "raw_abi": "abi", "raw_sha256": "sha256"}
MODES = {"enforce", "complain", "unconfined", "kill", "prompt"}


class Incomplete(Exception):
    pass


def need(ok, code):
    if not ok:
        raise Incomplete(code)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode()


def identity(st):
    return {"device": st.st_dev, "inode": st.st_ino, "mode": stat.S_IMODE(st.st_mode),
            "uid": st.st_uid, "gid": st.st_gid, "size": st.st_size,
            "mtimeNs": getattr(st, "st_mtime_ns", 0), "ctimeNs": getattr(st, "st_ctime_ns", 0)}


def component(value):
    need(isinstance(value, str) and value not in {"", ".", ".."} and
         "/" not in value and "\0" not in value and len(os.fsencode(value)) <= 255,
         "invalid-component")
    return value


def text_fact(data, disclose=False):
    """Retain byte identity even when exact text cannot be safely disclosed."""
    out = {"bytes": len(data), "sha256": sha(data)}
    if not disclose:
        return out
    try:
        value = data.decode("utf-8", "strict")
    except UnicodeDecodeError:
        return dict(out, suppressed="invalid-utf8")
    body = value[:-1] if value.endswith("\n") else value
    if any(unicodedata.category(c).startswith("C") or unicodedata.category(c) in {"Zl", "Zp"}
           for c in body):
        return dict(out, suppressed="control-characters")
    # No promise of exhaustive secret detection. Be conservative for arbitrary
    # loaded names, including bearer strings, URIs with userinfo, and long tokens.
    if (re.search(r"(?i)(password|passwd|secret|token|api[_-]?key|authorization|bearer|credential)\s*[:= ]", body)
            or re.search(r"[A-Za-z][A-Za-z0-9+.-]*://[^/\s]*@", body)
            or re.search(r"(?:gh[pousr]_|github_pat_|AKIA|ASIA|sk-)[A-Za-z0-9_-]{8,}", body)
            or re.search(r"[A-Za-z0-9_+=-]{40,}", body)
            or "-----BEGIN" in body):
        return dict(out, suppressed="credential-like")
    out["text"] = value
    return out


def attachment_kind(data):
    try:
        value = data.decode("utf-8", "strict")
    except UnicodeDecodeError:
        return "invalid-utf8"
    normalized = value.strip()
    if normalized == "":
        return "empty"
    if normalized == "<unknown>":
        return "unknown-sentinel"
    return "display-present"


def empty_representation(data):
    if data == b"":
        return "zero-bytes"
    if data == b"\n":
        return "kernel-newline-only"
    return "whitespace-only" if attachment_kind(data) == "empty" else "not-empty"


def raw_target(link, depth, final):
    """Parse kernel-generated links; never resolve arbitrary symlink paths."""
    need(1 <= depth <= MAX_DEPTH, "raw-link-depth")
    prefix = "../../" * depth + "raw_data/"
    need(link.startswith(prefix), "raw-link-escape")
    tail = link[len(prefix):]
    match = re.fullmatch(r"([0-9]{1,20})/(raw_data|abi|sha256)", tail)
    need(match is not None and match.group(2) == final, "raw-link-target")
    return match.group(1)


def error_code(exc):
    if isinstance(exc, Incomplete):
        return str(exc)
    return {errno.ENOENT: "absent", errno.EACCES: "denied", errno.EPERM: "denied",
            errno.EAGAIN: "would-block", errno.ELOOP: "unexpected-symlink",
            errno.ENOTDIR: "unexpected-type"}.get(getattr(exc, "errno", None), "read-error")


class KernelFS:
    def __init__(self, clock=time.monotonic):
        self.clock = clock
        self.deadline = clock() + MAX_SECONDS
        self.device = None
        self.raw_bytes = 0
        self.raw_digests = {}  # In-memory identity memo only; no filesystem cache.

    def check(self):
        need(self.clock() < self.deadline, "time-limit")

    def validate(self, fd, directory=False):
        st = os.fstat(fd)
        need((stat.S_ISDIR if directory else stat.S_ISREG)(st.st_mode), "unexpected-type")
        if self.device is not None:
            need(st.st_dev == self.device, "different-filesystem")
        return st

    @contextlib.contextmanager
    def anchor(self):
        self.check()
        # The sole intentional followed link is the fixed kernel magic endpoint.
        fd = os.open(POLICY, os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC | os.O_NONBLOCK)
        try:
            st = self.validate(fd, True)
            need(sys.platform == "linux", "linux-required")
            libc = ctypes.CDLL(None, use_errno=True)
            func = libc.fstatfs
            func.argtypes = [ctypes.c_int, ctypes.c_void_p]
            func.restype = ctypes.c_int
            buf = ctypes.create_string_buffer(256)
            need(func(fd, buf) == 0, "filesystem-type-unavailable")
            magic = ctypes.c_ulong.from_buffer(buf).value
            need(magic == AAFS_MAGIC, "not-apparmorfs")
            self.device = st.st_dev
            yield fd
        finally:
            os.close(fd)

    @contextlib.contextmanager
    def directory(self, parent, name):
        self.check()
        fd = os.open(component(name), os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW |
                     os.O_CLOEXEC | os.O_NONBLOCK, dir_fd=parent)
        try:
            self.validate(fd, True)
            yield fd
        finally:
            os.close(fd)

    def names(self, fd):
        self.check()
        out = []
        with os.scandir(fd) as entries:
            for entry in entries:
                self.check()
                need(len(out) < MAX_PROFILES + MAX_NAMESPACES, "directory-count-limit")
                out.append(component(entry.name))
        need(len(set(out)) == len(out), "duplicate-entry")
        return sorted(out)

    @contextlib.contextmanager
    def optional_directory(self, parent, name):
        self.check()
        try:
            fd = os.open(component(name), os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW |
                         os.O_CLOEXEC | os.O_NONBLOCK, dir_fd=parent)
        except FileNotFoundError:
            yield None
            return
        try:
            self.validate(fd, True)
            yield fd
        finally:
            os.close(fd)

    def read(self, parent, field, limit=MAX_TEXT, revision=False):
        self.check()
        need(field in FIELDS, "field-not-allowed")
        need(not revision or field == "revision", "revision-field")
        fd = os.open(field, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC | os.O_NONBLOCK,
                     dir_fd=parent)
        try:
            self.validate(fd)
            if revision:
                # ns_revision_read is event-like, including when revision == 0.
                data = os.read(fd, limit + 1)
                need(len(data) <= limit, "text-limit")
                need(bool(re.fullmatch(rb"[0-9]{1,20}\n", data)), "revision-invalid")
                return data
            chunks, count = [], 0
            while True:
                self.check()
                part = os.read(fd, min(4096, limit + 1 - count))
                if not part:
                    return b"".join(chunks)
                chunks.append(part)
                count += len(part)
                need(count <= limit, "text-limit")
        finally:
            os.close(fd)

    def link(self, parent, field):
        self.check()
        need(field in RAW_FIELDS, "raw-field-not-allowed")
        st = os.stat(field, dir_fd=parent, follow_symlinks=False)
        need(stat.S_ISLNK(st.st_mode) and st.st_dev == self.device, "raw-link-type")
        value = os.readlink(field, dir_fd=parent)
        need(len(os.fsencode(value)) <= MAX_TEXT, "raw-link-limit")
        return value

    def raw_digest(self, parent):
        self.check()
        st = os.stat("raw_data", dir_fd=parent, follow_symlinks=False)
        need(stat.S_ISREG(st.st_mode) and st.st_dev == self.device, "raw-data-type")
        need(0 <= st.st_size <= MAX_RAW, "raw-profile-limit")
        key = canonical(identity(st))
        if key in self.raw_digests:
            return dict(self.raw_digests[key], sharedRead=True)
        need(self.raw_bytes + st.st_size <= MAX_RAW_TOTAL, "raw-total-limit")
        fd = os.open("raw_data", os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC | os.O_NONBLOCK,
                     dir_fd=parent)
        try:
            opened = self.validate(fd)
            need(identity(opened) == identity(st), "raw-identity-changed")
            count, digest = 0, hashlib.sha256()
            while count < st.st_size:
                self.check()
                part = os.read(fd, min(65536, st.st_size - count))
                need(bool(part), "raw-short-read")
                count += len(part)
                self.raw_bytes += len(part)
                need(count <= MAX_RAW and self.raw_bytes <= MAX_RAW_TOTAL, "raw-byte-limit")
                digest.update(part)
            need(count == st.st_size and identity(os.fstat(fd)) == identity(st), "raw-size-changed")
            result = {"status": "available", "bytes": count, "sha256": digest.hexdigest(),
                      "objectIdentitySha256": sha(key), "hashScope": "exported-raw-policy-bytes",
                      "sharedRead": False}
            self.raw_digests[key] = result
            return dict(result)
        finally:
            os.close(fd)


def optional(call):
    try:
        return {"status": "available", "value": call()}
    except (OSError, Incomplete) as exc:
        if error_code(exc) == "time-limit":
            raise
        return {"status": error_code(exc)}


def scalar(fs, fd, field, revision=False):
    result = optional(lambda: fs.read(fd, field, 256, revision))
    if result["status"] != "available":
        return result
    data = result.pop("value")
    result.update(text_fact(data))
    expression = {"abi": rb"v[0-9]{1,6}\n", "sha256": rb"[0-9a-f]{64}\n",
                  "revision": rb"[0-9]{1,20}\n", "compressed_size": rb"[0-9]{1,20}\n"}[field]
    if not re.fullmatch(expression, data):
        result["status"] = "invalid-scalar"
    else:
        result["value"] = data.decode().rstrip("\n")
    return result


def raw_info(fs, namespace_fd, profile_fd, depth, links):
    out = {}
    targets = set()
    for field, final in RAW_FIELDS.items():
        item = links[field]
        if item["status"] != "available":
            out[field] = dict(item)
            continue
        try:
            revision = raw_target(item["value"], depth, final)
            targets.add(revision)
            with fs.directory(namespace_fd, "raw_data") as raw_root:
                # This ID was parsed from a fixed kernel link, not a caller path.
                with fs.directory(raw_root, revision) as data_dir:
                    if field == "raw_data":
                        value = fs.raw_digest(data_dir)
                    else:
                        value = scalar(fs, data_dir, final)
                    out[field] = dict(value, targetRevision=revision)
                    out[field]["loadedRevision"] = scalar(fs, data_dir, "revision")
        except (OSError, Incomplete) as exc:
            if error_code(exc) == "time-limit":
                raise
            out[field] = {"status": error_code(exc)}
    out["consistentTarget"] = len(targets) <= 1
    return out


class Collector:
    def __init__(self, fs):
        self.fs = fs
        self.records = []
        self.namespaces = []
        self.relevant = 0
        self.output_cost = 0
        self.partial = []

    def append(self, record):
        self.output_cost += len(canonical(record))
        need(self.output_cost <= MAX_OUTPUT - 65536, "output-limit")
        self.records.append(record)

    def scan(self, root, collect):
        seen, fingerprints = set(), []
        counts = {"profiles": 0, "namespaces": 0}

        def unique(fd):
            st = self.fs.validate(fd, True)
            key = (st.st_dev, st.st_ino)
            need(key not in seen, "directory-alias")
            seen.add(key)
            return identity(st)

        def profiles(folder, namespace_fd, ns_id, ns_path, ancestors, depth):
            need(depth <= MAX_DEPTH, "profile-depth-limit")
            unique(folder)
            for entry in self.fs.names(folder):
                counts["profiles"] += 1
                need(counts["profiles"] <= MAX_PROFILES, "profile-count-limit")
                with self.fs.directory(folder, entry) as fd:
                    meta = unique(fd)
                    name = self.fs.read(fd, "name")
                    mode = self.fs.read(fd, "mode", 128)
                    attach = self.fs.read(fd, "attach")
                    need(mode in {(m + "\n").encode() for m in MODES},
                         "profile-mode-invalid")
                    kind = attachment_kind(attach)
                    need(kind != "invalid-utf8", "attachment-invalid-utf8")
                    links = {field: optional(lambda f=field: self.fs.link(fd, f)) for field in RAW_FIELDS}
                    profile_id = sha(canonical([ns_id, [sha(x) for x in ancestors], sha(name), meta]))
                    fp = [ns_id, meta, sha(os.fsencode(entry)), sha(name), sha(mode), sha(attach),
                          {f: (sha(os.fsencode(v["value"])) if v["status"] == "available" else v["status"])
                           for f, v in links.items()}]
                    fingerprints.append(fp)
                    if collect:
                        relevant = kind in {"empty", "unknown-sentinel"}
                        record = {"id": profile_id, "namespaceId": ns_id, "depth": depth,
                                  "parentNameHashes": [sha(x) for x in ancestors],
                                  "name": text_fact(name, relevant), "mode": mode[:-1].decode(),
                                  "attachment": dict(text_fact(attach, relevant), classification=kind,
                                                     emptyRepresentation=empty_representation(attach)),
                                  "candidateNameCollision": name == (TARGET_NAME + "\n").encode(),
                                  "profileHash": scalar(self.fs, fd, "sha256")}
                        if relevant:
                            self.relevant += 1
                            need(self.relevant <= MAX_RELEVANT, "relevant-profile-limit")
                            record["profileAncestors"] = [text_fact(x, True) for x in ancestors]
                            record["namespaceHierarchy"] = ns_path
                            record["rawPolicy"] = raw_info(self.fs, namespace_fd, fd, depth, links)
                        self.append(record)
                    with self.fs.optional_directory(fd, "profiles") as child:
                        if child is not None:
                            profiles(child, namespace_fd, ns_id, ns_path, ancestors + [name], depth + 1)

        def namespace(fd, path, depth):
            need(depth <= MAX_DEPTH, "namespace-depth-limit")
            counts["namespaces"] += 1
            need(counts["namespaces"] <= MAX_NAMESPACES, "namespace-count-limit")
            meta = unique(fd)
            ns_id = sha(canonical([meta, [p["sha256"] for p in path]]))
            before = scalar(self.fs, fd, "revision", True)
            with self.fs.directory(fd, "profiles") as folder:
                profiles(folder, fd, ns_id, path, [], 1)
            with self.fs.directory(fd, "namespaces") as folder:
                unique(folder)
                for entry in self.fs.names(folder):
                    with self.fs.directory(folder, entry) as child:
                        namespace(child, path + [text_fact(os.fsencode(entry), True)], depth + 1)
            after = scalar(self.fs, fd, "revision", True)
            stable = before["status"] == "available" and before == after
            fingerprints.append(["namespace", ns_id, before, after])
            if collect:
                hidden_path = [{k: v for k, v in item.items() if k != "text"} for item in path]
                self.namespaces.append({"id": ns_id, "hierarchy": hidden_path, "identity": meta,
                                        "revisionBefore": before, "revisionAfter": after,
                                        "revisionStable": stable})
            need(stable, "revision-unavailable-or-changed")

        namespace(root, [], 0)
        return {"counts": counts, "sha256": sha(canonical(sorted(fingerprints, key=canonical)))}

    def collect(self, root):
        first = self.scan(root, True)
        second = self.scan(root, False)
        need(first == second, "inventory-changed")
        return {"complete": True, "stableObservation": True, "atomicSnapshotClaimed": False,
                "scope": "observer-policy-namespace-subtree-including-descendants",
                "before": first, "after": second}


def fixed_read(path, limit):
    """Only callers with literal fixed host-identity paths use this helper."""
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC | os.O_NONBLOCK)
    try:
        st = os.fstat(fd)
        need(stat.S_ISREG(st.st_mode), "identity-file-type")
        chunks, count = [], 0
        while True:
            data = os.read(fd, min(4096, limit + 1 - count))
            if not data:
                return b"".join(chunks)
            chunks.append(data)
            count += len(data)
            need(count <= limit, "identity-file-limit")
    finally:
        os.close(fd)


def observer():
    out = {"effectiveUid": os.geteuid(), "kernelRelease": text_fact(os.uname().release.encode(), True)}
    for key, path in [("label", "/proc/self/attr/current"),
                      ("policyNamespaceName", "/sys/kernel/security/apparmor/.ns_name"),
                      ("policyNamespaceLevel", "/sys/kernel/security/apparmor/.ns_level"),
                      ("policyNamespaceStacked", "/sys/kernel/security/apparmor/.ns_stacked"),
                      ("policyStacked", "/sys/kernel/security/apparmor/.stacked")]:
        item = optional(lambda p=path: fixed_read(p, MAX_TEXT))
        if item["status"] == "available":
            data = item.pop("value")
            item.update(text_fact(data))
            if key == "label":
                item["unconfined"] = data in {b"unconfined", b"unconfined\n"}
            elif key == "policyNamespaceLevel":
                if re.fullmatch(rb"[0-9]{1,10}\n", data):
                    item["value"] = int(data)
                else:
                    item["status"] = "invalid-namespace-level"
            elif key in {"policyNamespaceStacked", "policyStacked"}:
                if data in {b"yes\n", b"no\n"}:
                    item["value"] = data == b"yes\n"
                else:
                    item["status"] = "invalid-stacking-value"
        out[key] = item
    out["processNamespaces"] = {}
    for name in ["user", "mnt", "pid", "net"]:
        result = optional(lambda n=name: os.readlink("/proc/self/ns/" + n))
        if result["status"] == "available":
            value = result.pop("value")
            if re.fullmatch(name + r":\[[0-9]{1,20}\]", value):
                result["identity"] = value
            else:
                result["status"] = "invalid-namespace-link"
        out["processNamespaces"][name] = result
    return out


def observer_complete(value):
    return (all(value[k]["status"] == "available" for k in
                ["label", "policyNamespaceName", "policyNamespaceLevel",
                 "policyNamespaceStacked", "policyStacked"])
            and all(v["status"] == "available" for v in value["processNamespaces"].values()))


def disk_bytes(path, limit):
    """Bounded fixed disk-file identity reads; no EOF probe beyond the hard cap."""
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC | os.O_NONBLOCK)
    try:
        st = os.fstat(fd)
        need(stat.S_ISREG(st.st_mode), "identity-file-type")
        need(0 <= st.st_size <= limit, "identity-file-limit")
        chunks, count = [], 0
        while count < st.st_size:
            data = os.read(fd, min(65536, st.st_size - count))
            need(bool(data), "identity-short-read")
            chunks.append(data)
            count += len(data)
        need(identity(os.fstat(fd)) == identity(st), "identity-changed")
        return b"".join(chunks), identity(st)
    finally:
        os.close(fd)


def package_identities(data, release):
    need(re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9.+_-]{0,127}", release) is not None, "kernel-release-invalid")
    targets = {"apparmor", "linux-image-" + release}
    results = {name: {"status": "absent"} for name in sorted(targets)}
    seen = set()
    # Parse bytes internally; never expose unrelated stanzas or error text.
    for stanza in data.split(b"\n\n"):
        names = re.findall(rb"(?m)^Package: ([^\n]+)$", stanza)
        matches = [name for name in targets if name.encode() in names]
        for name in matches:
            if name in seen:
                results[name] = {"status": "duplicate-package"}
                continue
            seen.add(name)
            if len(names) != 1:
                results[name] = {"status": "malformed-package"}
                continue
            fields = {}
            valid = True
            for key in ["Package", "Version", "Source", "Architecture", "Status"]:
                values = re.findall(rb"(?m)^" + key.encode() + rb": ([^\n]+)$", stanza)
                if len(values) > 1 or (key != "Source" and len(values) != 1):
                    valid = False
                    break
                if values:
                    value = values[0]
                    if len(value) > 256 or not re.fullmatch(rb"[A-Za-z0-9.+:~_() -]+", value):
                        valid = False
                        break
                    fields[key] = value.decode("ascii")
            if not valid:
                results[name] = {"status": "malformed-package"}
            elif fields.pop("Status") != "install ok installed":
                results[name] = {"status": "not-installed"}
            elif (not re.fullmatch(r"[0-9][A-Za-z0-9.+:~_-]{0,255}", fields["Version"])
                  or not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,63}", fields["Architecture"])
                  or ("Source" in fields and not re.fullmatch(
                      r"[a-z0-9][a-z0-9+.-]*(?: \([0-9][A-Za-z0-9.+:~_-]*\))?", fields["Source"]))):
                results[name] = {"status": "malformed-package"}
            else:
                if any("suppressed" in text_fact(value.encode(), True) for value in fields.values()):
                    results[name] = {"status": "metadata-disclosure-suppressed"}
                else:
                    results[name] = {"status": "available", "fields": fields}
    return results


def direct_metadata(release):
    out = {}
    for name, path in [("apparmorParser", "/usr/sbin/apparmor_parser"),
                       ("apparmorPackageFileList", "/var/lib/dpkg/info/apparmor.list")]:
        try:
            fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC | os.O_NONBLOCK)
            try:
                st = os.fstat(fd)
                need(stat.S_ISREG(st.st_mode), "identity-file-type")
                out[name] = {"status": "available", "identity": identity(st),
                             "versionInferred": False, "contentRead": False}
            finally:
                os.close(fd)
        except (OSError, Incomplete) as exc:
            if error_code(exc) == "time-limit":
                raise
            out[name] = {"status": error_code(exc)}
    try:
        data, meta = disk_bytes("/usr/sbin/apparmor_parser", MAX_RAW)
        out["apparmorParser"] = {"status": "available", "identity": meta,
                                 "sha256": sha(data), "executed": False}
    except (OSError, Incomplete) as exc:
        if error_code(exc) == "time-limit":
            raise
        out["apparmorParserDigest"] = {"status": error_code(exc)}
    try:
        data, meta = disk_bytes("/var/lib/dpkg/status", 8 * 1024 * 1024)
        out["selectedInstalledPackages"] = package_identities(data, release)
        out["packageDatabaseRead"] = {"status": "available", "bytes": len(data),
                                      "sha256": sha(data), "identity": meta,
                                      "unrelatedStanzasExported": False}
    except (OSError, Incomplete) as exc:
        if error_code(exc) == "time-limit":
            raise
        out["selectedInstalledPackages"] = {"status": error_code(exc)}
    out["kernelSourcePatchSetVerified"] = False
    return out


def profile_list():
    data = fixed_read("/sys/kernel/security/apparmor/profiles", 262144)
    rows = data.splitlines()
    need(len(rows) <= MAX_PROFILES, "profile-list-count-limit")
    need(all(re.fullmatch(rb"[^\x00-\x1f\x7f]+ \((enforce|complain|unconfined|kill|prompt)\)", row)
             for row in rows), "profile-list-invalid")
    need(len(set(rows)) == len(rows), "profile-list-duplicate")
    return {"bytes": len(data), "sha256": sha(data), "count": len(rows)}


def diagnostic_limits(records):
    """Optional absence is evidence; unsupported/partial reads are incomplete."""
    okay = {"available", "absent", "denied"}
    for record in records:
        raw = record.get("rawPolicy", {})
        if raw and not raw["consistentTarget"]:
            return "raw-targets-inconsistent"
        for field in RAW_FIELDS:
            if field in raw:
                item = raw[field]
                if item["status"] not in okay:
                    return item["status"]
                if "loadedRevision" in item and item["loadedRevision"]["status"] not in okay:
                    return item["loadedRevision"]["status"]
    return None


def bounded_output(result):
    encoded = canonical(result)
    if len(encoded) + 1 <= MAX_OUTPUT:
        return encoded + b"\n"
    # Never silently truncate a successful collection.
    result["status"] = "INCOMPLETE"
    result["failure"] = "output-limit"
    result["snapshot"] = {"complete": False, "stableObservation": False}
    result["omittedRecordCount"] = len(result.get("profiles", []))
    result["profiles"] = []
    result["namespaces"] = []
    encoded = canonical(result)
    need(len(encoded) + 1 <= MAX_OUTPUT, "output-envelope-limit")
    return encoded + b"\n"


def main():
    result = {"schemaVersion": "gridninja-attachment-diagnostic.v1", "diagnosticOnly": True,
              "collisionResolved": False, "qualification": False, "matchingProofStatus": "NOT_ATTEMPTED",
              "candidatePath": TARGET, "candidateProfileName": TARGET_NAME,
              "historicalRunAttribution": "NONE_FRESH_HOST_ONLY", "status": "INCOMPLETE",
              "limits": {"seconds": MAX_SECONDS, "profiles": MAX_PROFILES, "namespaces": MAX_NAMESPACES,
                         "relevantProfiles": MAX_RELEVANT, "textBytes": MAX_TEXT,
                         "rawBytesPerProfile": MAX_RAW, "rawBytesTotal": MAX_RAW_TOTAL,
                         "outputBytes": MAX_OUTPUT},
              "environmentEquivalenceToHistoricalTrial": False,
              "featureMetadata": {"status": "not-collected-fixed-read-scope"}}
    fs, collector = KernelFS(), None
    started = time.monotonic()
    def expired(_signum, _frame):
        raise Incomplete("time-limit")
    signal.signal(signal.SIGALRM, expired)
    signal.setitimer(signal.ITIMER_REAL, MAX_SECONDS)
    try:
        need(len(sys.argv) == 1, "arguments-not-supported")
        result["observerBefore"] = observer()
        need(observer_complete(result["observerBefore"]), "observer-incomplete")
        result["directFileMetadata"] = direct_metadata(os.uname().release)
        result["profileListBefore"] = profile_list()
        collector = Collector(fs)
        with fs.anchor() as root:
            result["policyAnchor"] = identity(os.fstat(root))
            result["snapshot"] = collector.collect(root)
        result["profileListAfter"] = profile_list()
        need(result["profileListBefore"] == result["profileListAfter"], "profile-list-changed")
        need(result["profileListBefore"]["count"] == result["snapshot"]["before"]["counts"]["profiles"],
             "profile-list-inventory-count-mismatch")
        result["observerAfter"] = observer()
        need(result["observerBefore"] == result["observerAfter"], "observer-changed")
        limit = diagnostic_limits(collector.records)
        need(limit is None, limit)
        result["status"] = "COLLECTED_CONFLICT_UNRESOLVED"
    except (OSError, Incomplete) as exc:
        result["failure"] = error_code(exc)
        result["snapshot"] = {"complete": False, "stableObservation": False}
    except Exception:
        result["failure"] = "unexpected-error"
        result["snapshot"] = {"complete": False, "stableObservation": False}
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
    if collector is not None:
        result["profiles"] = collector.records
        result["namespaces"] = collector.namespaces
        result["relevantProfileCount"] = collector.relevant
    result["rawBytesRead"] = fs.raw_bytes
    result["elapsedMilliseconds"] = round((time.monotonic() - started) * 1000)
    sys.stdout.buffer.write(bounded_output(result))
    return 0 if result["status"] == "COLLECTED_CONFLICT_UNRESOLVED" else 2


if __name__ == "__main__":
    raise SystemExit(main())
