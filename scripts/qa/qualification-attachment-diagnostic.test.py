#!/usr/bin/env python3
"""Pure and mocked tests; never open host policy, execute commands, or write files."""
import ast
import contextlib
import ctypes
import errno
import importlib.util
import io
import json
import os
from pathlib import Path
import stat
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
SOURCE = Path(__file__).with_name("qualification-attachment-diagnostic.py")
spec = importlib.util.spec_from_file_location("attachment_diagnostic", SOURCE)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def st(inode=1, mode=stat.S_IFREG | 0o444, device=7, size=0):
    return SimpleNamespace(st_dev=device, st_ino=inode, st_mode=mode,
                           st_uid=0, st_gid=0, st_size=size)


def node(files=None, dirs=None, links=None):
    return {"files": files or {}, "dirs": dirs or {}, "links": links or {}}


def profile(name=b"chrome\n", attach=b"<unknown>\n", children=None, links=None):
    return node({"name": name, "mode": b"unconfined\n", "attach": attach,
                 "sha256": b"a" * 64 + b"\n"},
                {"profiles": node(dirs=children)} if children is not None else {}, links)


def namespace(profiles=None, children=None, raw=None):
    return node({"revision": b"1\n"}, {"profiles": node(dirs=profiles or {}),
                "namespaces": node(dirs=children or {}), "raw_data": node(dirs=raw or {})})


class FakeFS:
    def __init__(self, root):
        self.root = root
        self.raw_bytes = 0
        self.sequence = []

    def validate(self, fd, directory=False):
        return st(id(fd), stat.S_IFDIR | 0o755 if directory else stat.S_IFREG | 0o444)

    @contextlib.contextmanager
    def directory(self, parent, name):
        if name not in parent["dirs"]:
            raise FileNotFoundError(errno.ENOENT, "suppressed")
        yield parent["dirs"][name]

    @contextlib.contextmanager
    def optional_directory(self, parent, name):
        yield parent["dirs"].get(name)

    def names(self, fd):
        return sorted(fd["dirs"])

    def read(self, parent, field, limit=8192, revision=False):
        self.sequence.append((id(parent), field, revision))
        if field not in parent["files"]:
            raise FileNotFoundError(errno.ENOENT, "suppressed")
        value = parent["files"][field]
        if isinstance(value, list):
            value = value.pop(0)
        if isinstance(value, Exception):
            raise value
        m.need(len(value) <= limit, "text-limit")
        return value

    def link(self, parent, field):
        if field not in parent["links"]:
            raise FileNotFoundError(errno.ENOENT, "suppressed")
        return parent["links"][field]

    def raw_digest(self, parent):
        data = parent["files"]["raw_data"]
        m.need(len(data) <= m.MAX_RAW, "raw-profile-limit")
        m.need(self.raw_bytes + len(data) <= m.MAX_RAW_TOTAL, "raw-total-limit")
        self.raw_bytes += len(data)
        return {"status": "available", "bytes": len(data), "sha256": m.sha(data)}


class TextTests(unittest.TestCase):
    def test_unknown_preserves_exact_newline_bytes(self):
        data = b"<unknown>\n"
        fact = m.text_fact(data, True)
        self.assertEqual(fact["text"], "<unknown>\n")
        self.assertEqual(fact["sha256"], m.sha(data))
        self.assertEqual(m.attachment_kind(data), "unknown-sentinel")

    def test_empty_and_whitespace_remain_distinct(self):
        for data in [b"", b"\n", b"  \n"]:
            self.assertEqual(m.attachment_kind(data), "empty")
        self.assertNotEqual(m.text_fact(b"")["sha256"], m.text_fact(b"\n")["sha256"])

    def test_utf8_invalid_is_not_accepted_as_empty(self):
        self.assertEqual(m.attachment_kind(b"\xff"), "invalid-utf8")
        self.assertEqual(m.text_fact(b"\xff", True)["suppressed"], "invalid-utf8")

    def test_name_controls_are_suppressed(self):
        for data in [b"evil\x00name", b"evil\nname", b"evil\tname", b"evil\x7fname", "evil\u202ename".encode()]:
            self.assertNotIn("text", m.text_fact(data, True))

    def test_credentials_are_suppressed(self):
        for value in ["token=CANARY_SUPPRESS", "password: CANARY_SUPPRESS",
                      "https://user:pass@example.test", "ghp_123456789canary",
                      "A" * 48, "-----BEGIN PRIVATE KEY-----"]:
            self.assertNotIn("text", m.text_fact(value.encode(), True))

    def test_safe_public_names_disclose_only_when_requested(self):
        for value in [b"chrome\n", b"/usr/lib/chromium-browser/chromium-browser\n", b"electron\n"]:
            self.assertEqual(m.text_fact(value, True)["text"], value.decode())
            self.assertNotIn("text", m.text_fact(value))


class PathTests(unittest.TestCase):
    def test_kernel_raw_target_at_each_depth(self):
        for depth in [1, 2, 8, 32]:
            self.assertEqual(m.raw_target("../../" * depth + "raw_data/123/raw_data", depth, "raw_data"), "123")

    def test_raw_target_rejects_escapes_or_unexpected_basename(self):
        for link in ["/raw_data/1/raw_data", "../../raw_data/../raw_data",
                     "../../raw_data/1/attach", "../../raw_data/1/raw_data/extra",
                     "../../../../raw_data/1/raw_data", "../../raw_data/-1/raw_data",
                     "../../raw_data/1/../raw_data", "../../raw_data/1/raw_data\x00"]:
            with self.assertRaises(m.Incomplete):
                m.raw_target(link, 1, "raw_data")

    def test_components_reject_path_input(self):
        for value in ["", ".", "..", "../x", "/etc/passwd", "x\0", "x" * 256]:
            with self.assertRaises(m.Incomplete):
                m.component(value)

    def test_directory_open_no_follows_and_checks_same_device(self):
        fs = m.KernelFS(); fs.device = 7
        with patch.object(m.os, "open", return_value=3) as opened, patch.object(m.os, "fstat", return_value=st(mode=stat.S_IFDIR | 0o755, device=8)), patch.object(m.os, "close"):
            with self.assertRaisesRegex(m.Incomplete, "different-filesystem"):
                with fs.directory(2, "profiles"):
                    pass
        self.assertTrue(opened.call_args.args[1] & os.O_NOFOLLOW)
        self.assertEqual(opened.call_args.kwargs["dir_fd"], 2)

    def test_symlink_scalar_refuses_before_read(self):
        fs = m.KernelFS(); fs.device = 7
        with patch.object(m.os, "open", side_effect=OSError(errno.ELOOP, "CANARY")), patch.object(m.os, "read") as read:
            with self.assertRaises(OSError): fs.read(3, "attach")
            read.assert_not_called()

    def test_missing_optional_child_does_not_swallow_descendant_failure(self):
        fs = m.KernelFS(); fs.device = 7
        with patch.object(m.os, "open", return_value=4), patch.object(m.os, "fstat", return_value=st(mode=stat.S_IFDIR | 0o755)), patch.object(m.os, "close"):
            with self.assertRaises(FileNotFoundError):
                with fs.optional_directory(3, "profiles"):
                    raise FileNotFoundError(errno.ENOENT, "missing descendant")


class ReadTests(unittest.TestCase):
    def test_revision_one_read_fresh_nonblocking_fd(self):
        fs = m.KernelFS(); fs.device = 7
        with patch.object(m.os, "open", side_effect=[3, 4]) as opened, patch.object(m.os, "fstat", return_value=st()), patch.object(m.os, "read", return_value=b"1\n") as read, patch.object(m.os, "close") as close:
            self.assertEqual(fs.read(2, "revision", 256, True), b"1\n")
            self.assertEqual(fs.read(2, "revision", 256, True), b"1\n")
            self.assertEqual(read.call_count, 2)
            self.assertEqual([c.args[0] for c in read.call_args_list], [3, 4])
            self.assertEqual(close.call_count, 2)
            self.assertTrue(all(c.args[1] & os.O_NONBLOCK for c in opened.call_args_list))

    def test_revision_eagain_is_not_zero_or_success(self):
        fs = m.KernelFS(); fs.device = 7
        with patch.object(m.os, "open", return_value=3), patch.object(m.os, "fstat", return_value=st()), patch.object(m.os, "read", side_effect=BlockingIOError(errno.EAGAIN, "secret")) as read, patch.object(m.os, "close"):
            self.assertEqual(m.scalar(fs, 2, "revision", True), {"status": "would-block"})
            self.assertEqual(read.call_count, 1)

    def test_oversized_text_explicit_failure(self):
        fs = m.KernelFS(); fs.device = 7
        with patch.object(m.os, "open", return_value=3), patch.object(m.os, "fstat", return_value=st()), patch.object(m.os, "read", return_value=b"12345"), patch.object(m.os, "close"):
            with self.assertRaisesRegex(m.Incomplete, "text-limit"): fs.read(2, "attach", 4)

    def test_raw_digest_exports_hash_not_bytes(self):
        fs = m.KernelFS(); fs.device = 7
        value = b"CANARY_RAW_POLICY_SECRET"
        metadata = st(size=len(value))
        with patch.object(m.os, "stat", return_value=metadata), patch.object(m.os, "open", return_value=3), patch.object(m.os, "fstat", return_value=metadata), patch.object(m.os, "read", side_effect=[value, b""]), patch.object(m.os, "close"):
            result = fs.raw_digest(2)
        self.assertEqual(result["sha256"], m.sha(value))
        self.assertNotIn("CANARY", json.dumps(result))
        self.assertEqual(fs.raw_bytes, len(value))

    def test_raw_profile_limit_precedes_content_open(self):
        fs = m.KernelFS(); fs.device = 7
        with patch.object(m.os, "stat", return_value=st(size=m.MAX_RAW + 1)), patch.object(m.os, "open") as opened:
            with self.assertRaisesRegex(m.Incomplete, "raw-profile-limit"): fs.raw_digest(2)
            opened.assert_not_called()

    def test_raw_total_limit_includes_repeated_reads(self):
        fs = m.KernelFS(); fs.device = 7; fs.raw_bytes = m.MAX_RAW_TOTAL - 2
        with patch.object(m.os, "stat", return_value=st(size=3)), patch.object(m.os, "open") as opened:
            with self.assertRaisesRegex(m.Incomplete, "raw-total-limit"): fs.raw_digest(2)
            opened.assert_not_called()

    def test_raw_change_does_not_get_hash_success(self):
        fs = m.KernelFS(); fs.device = 7
        with patch.object(m.os, "stat", return_value=st(size=3)), patch.object(m.os, "open", return_value=3), patch.object(m.os, "fstat", return_value=st(size=3)), patch.object(m.os, "read", side_effect=[b"ab", b""]), patch.object(m.os, "close"):
            with self.assertRaisesRegex(m.Incomplete, "raw-short-read"): fs.raw_digest(2)

    def test_raw_hard_cap_never_reads_probe_byte(self):
        fs = m.KernelFS(); fs.device = 7
        value = b"abcd"; metadata = st(size=4)
        with patch.object(m, "MAX_RAW", 4), patch.object(m, "MAX_RAW_TOTAL", 4), patch.object(m.os, "stat", return_value=metadata), patch.object(m.os, "open", return_value=3), patch.object(m.os, "fstat", return_value=metadata), patch.object(m.os, "read", return_value=value) as read, patch.object(m.os, "close"):
            result = fs.raw_digest(2)
            self.assertEqual(result["bytes"], 4)
            self.assertEqual(read.call_count, 1)
            self.assertEqual(read.call_args.args, (3, 4))

    def test_shared_raw_object_is_read_once(self):
        fs = m.KernelFS(); fs.device = 7
        metadata = st(size=3)
        with patch.object(m.os, "stat", return_value=metadata), patch.object(m.os, "open", return_value=3) as opened, patch.object(m.os, "fstat", return_value=metadata), patch.object(m.os, "read", return_value=b"abc"), patch.object(m.os, "close"):
            first = fs.raw_digest(2); second = fs.raw_digest(2)
        self.assertFalse(first["sharedRead"])
        self.assertTrue(second["sharedRead"])
        self.assertEqual(opened.call_count, 1)
        self.assertEqual(fs.raw_bytes, 3)

    def test_finite_clock_deadline(self):
        clock = iter([0, 31])
        fs = m.KernelFS(clock=lambda: next(clock))
        with self.assertRaisesRegex(m.Incomplete, "time-limit"): fs.check()

    def test_exception_details_do_not_escape(self):
        result = m.optional(lambda: (_ for _ in ()).throw(OSError(errno.EACCES, "CANARY_SECRET")))
        self.assertEqual(result, {"status": "denied"})


class InventoryTests(unittest.TestCase):
    def collect(self, root):
        fs = FakeFS(root); c = m.Collector(fs)
        return c, c.collect(root)

    def test_complete_unknown_and_empty_identified(self):
        c, result = self.collect(namespace({"one.1": profile(), "two.2": profile(b"electron\n", b"\n")}))
        self.assertTrue(result["complete"])
        self.assertEqual(c.relevant, 2)
        self.assertEqual({x["name"]["text"] for x in c.records}, {"chrome\n", "electron\n"})
        self.assertEqual({x["attachment"]["classification"] for x in c.records}, {"empty", "unknown-sentinel"})

    def test_unrelated_names_not_disclosed(self):
        c, _ = self.collect(namespace({"one.1": profile(b"CANARY_UNRELATED\n", b"/usr/bin/known\n")}))
        self.assertNotIn("CANARY", json.dumps(c.records))

    def test_profile_and_namespace_hierarchy(self):
        child = profile(b"child\n")
        inner = namespace({"parent.1": profile(b"parent\n", b"/not/candidate\n", {"child.2": child})})
        c, _ = self.collect(namespace(children={"nested": inner}))
        record = next(x for x in c.records if x["attachment"]["classification"] == "unknown-sentinel")
        self.assertEqual(record["depth"], 2)
        self.assertEqual(record["profileAncestors"][0]["text"], "parent\n")
        self.assertEqual(record["namespaceHierarchy"][0]["text"], "nested")
        self.assertNotIn("nested", json.dumps(c.namespaces))

    def test_realistic_raw_links_match_same_namespace(self):
        links = {k: "../../raw_data/7/" + v for k, v in m.RAW_FIELDS.items()}
        blob = node({"raw_data": b"SECRET_POLICY", "abi": b"v9\n", "sha256": b"b" * 64 + b"\n", "revision": b"7\n"})
        c, _ = self.collect(namespace({"chrome.1": profile(links=links)}, raw={"7": blob}))
        raw = c.records[0]["rawPolicy"]
        self.assertEqual(raw["raw_abi"]["value"], "v9")
        self.assertEqual(raw["raw_sha256"]["value"], "b" * 64)
        self.assertEqual(c.records[0]["profileHash"]["value"], "a" * 64)
        self.assertNotIn("SECRET_POLICY", json.dumps(c.records))

    def test_bad_raw_target_never_opens_escaped_path(self):
        c, _ = self.collect(namespace({"chrome.1": profile(links={"raw_data": "/etc/shadow"})}))
        self.assertEqual(m.diagnostic_limits(c.records), "raw-link-escape")

    def test_revision_change_refuses_complete(self):
        root = namespace({"x.1": profile()}); root["files"]["revision"] = [b"1\n", b"2\n"]
        with self.assertRaisesRegex(m.Incomplete, "revision-unavailable-or-changed"): self.collect(root)

    def test_revision_missing_refuses_complete(self):
        root = namespace(); del root["files"]["revision"]
        with self.assertRaisesRegex(m.Incomplete, "revision-unavailable-or-changed"): self.collect(root)

    def test_inventory_change_between_passes_refuses(self):
        p = profile(); p["files"]["attach"] = [b"<unknown>\n", b"/changed\n"]
        with self.assertRaisesRegex(m.Incomplete, "inventory-changed"): self.collect(namespace({"x.1": p}))

    def test_directory_alias_refuses(self):
        p = profile()
        with self.assertRaisesRegex(m.Incomplete, "directory-alias"): self.collect(namespace({"x.1": p, "y.2": p}))

    def test_missing_descendant_field_does_not_get_swallowed(self):
        child = profile(); del child["files"]["name"]
        with self.assertRaises(FileNotFoundError): self.collect(namespace({"x.1": profile(children={"child.2": child})}))

    def test_profile_count_bound(self):
        with patch.object(m, "MAX_PROFILES", 1):
            with self.assertRaisesRegex(m.Incomplete, "profile-count-limit"):
                self.collect(namespace({"x.1": profile(), "y.2": profile()}))

    def test_unknown_disclosure_bound(self):
        with patch.object(m, "MAX_RELEVANT", 1):
            with self.assertRaisesRegex(m.Incomplete, "relevant-profile-limit"):
                self.collect(namespace({"x.1": profile(), "y.2": profile()}))

    def test_strict_mode_rejects_non_ascii(self):
        p = profile(); p["files"]["mode"] = b"\xffenforce\n"
        with self.assertRaisesRegex(m.Incomplete, "profile-mode-invalid"): self.collect(namespace({"x.1": p}))

    def test_output_cap_marks_incomplete_without_secret_dump(self):
        result = {"status": "COLLECTED_CONFLICT_UNRESOLVED", "profiles": [{"x": "a" * m.MAX_OUTPUT}],
                  "diagnosticOnly": True, "collisionResolved": False, "qualification": False}
        data = m.bounded_output(result)
        self.assertLessEqual(len(data), m.MAX_OUTPUT)
        value = json.loads(data)
        self.assertEqual(value["status"], "INCOMPLETE")
        self.assertEqual(value["omittedRecordCount"], 1)
        self.assertFalse(value["collisionResolved"])


class SourceBoundaryTests(unittest.TestCase):
    def test_no_external_command_or_policy_mutation_modules(self):
        tree = ast.parse(SOURCE.read_text())
        imports = {a.name for n in ast.walk(tree) if isinstance(n, ast.Import) for a in n.names}
        self.assertTrue(imports.isdisjoint({"subprocess", "socket", "urllib", "shutil"}))
        source = SOURCE.read_text()
        for token in ["O_WRONLY", "O_RDWR", "O_CREAT", "os.system", "os.exec", "os.chmod", "os.chown", "os.unlink"]:
            self.assertNotIn(token, source)

    def test_collection_flags_are_never_pass_flags(self):
        source = SOURCE.read_text()
        self.assertIn('"collisionResolved": False', source)
        self.assertIn('"qualification": False', source)
        self.assertIn('"matchingProofStatus": "NOT_ATTEMPTED"', source)
        self.assertIn('"historicalRunAttribution": "NONE_FRESH_HOST_ONLY"', source)


class PackageTests(unittest.TestCase):
    def fixture(self, name="apparmor", status="install ok installed", version="4.0.1-1"):
        return ("Package: " + name + "\nStatus: " + status + "\nArchitecture: amd64\nVersion: " + version + "\n\n").encode()

    def test_exact_installed_packages_only(self):
        data = self.fixture() + self.fixture("linux-image-6.17.0-test", version="6.17.0-1") + self.fixture("unrelated", version="CANARY_SECRET")
        value = m.package_identities(data, "6.17.0-test")
        self.assertEqual(set(value), {"apparmor", "linux-image-6.17.0-test"})
        self.assertEqual(value["apparmor"]["fields"]["Version"], "4.0.1-1")
        self.assertNotIn("CANARY", json.dumps(value))
        self.assertNotIn("Status", value["apparmor"]["fields"])

    def test_missing_not_installed_duplicate_are_unknown(self):
        self.assertEqual(m.package_identities(b"", "test")["apparmor"]["status"], "absent")
        self.assertEqual(m.package_identities(self.fixture(status="deinstall ok config-files"), "test")["apparmor"]["status"], "not-installed")
        self.assertEqual(m.package_identities(self.fixture() * 2, "test")["apparmor"]["status"], "duplicate-package")

    def test_duplicate_fields_and_invalid_versions_unknown(self):
        data = self.fixture().replace(b"Version: 4.0.1-1", b"Version: 4.0.1-1\nVersion: 5.0")
        self.assertEqual(m.package_identities(data, "test")["apparmor"]["status"], "malformed-package")
        self.assertEqual(m.package_identities(self.fixture(version="secret CANARY"), "test")["apparmor"]["status"], "malformed-package")

    def test_source_field_allowlist(self):
        data = self.fixture().replace(b"Architecture:", b"Source: apparmor (4.0.1-1)\nArchitecture:")
        self.assertEqual(m.package_identities(data, "test")["apparmor"]["fields"]["Source"], "apparmor (4.0.1-1)")

    def test_disk_input_bound_precedes_read(self):
        with patch.object(m.os, "open", return_value=3), patch.object(m.os, "fstat", return_value=st(size=9)), patch.object(m.os, "read") as read, patch.object(m.os, "close"):
            with self.assertRaisesRegex(m.Incomplete, "identity-file-limit"): m.disk_bytes("fixed", 8)
            read.assert_not_called()

    def test_disk_short_read_is_incomplete(self):
        with patch.object(m.os, "open", return_value=3), patch.object(m.os, "fstat", return_value=st(size=4)), patch.object(m.os, "read", side_effect=[b"ab", b""]), patch.object(m.os, "close"):
            with self.assertRaisesRegex(m.Incomplete, "identity-short-read"): m.disk_bytes("fixed", 4)

    def test_metadata_timeout_prevents_later_disk_reads(self):
        with patch.object(m.os, "open", return_value=3), patch.object(m.os, "fstat", return_value=st()), patch.object(m.os, "close"), patch.object(m, "disk_bytes", side_effect=m.Incomplete("time-limit")) as read:
            with self.assertRaisesRegex(m.Incomplete, "time-limit"):
                m.direct_metadata("test")
            self.assertEqual(read.call_count, 1)
            self.assertEqual(read.call_args.args[0], "/usr/sbin/apparmor_parser")

    def test_metadata_stat_timeout_prevents_later_reads(self):
        with patch.object(m.os, "open", side_effect=m.Incomplete("time-limit")), patch.object(m, "disk_bytes") as read:
            with self.assertRaisesRegex(m.Incomplete, "time-limit"):
                m.direct_metadata("test")
            read.assert_not_called()

    def test_package_database_timeout_propagates(self):
        with patch.object(m.os, "open", return_value=3), patch.object(m.os, "fstat", return_value=st()), patch.object(m.os, "close"), patch.object(m, "disk_bytes", side_effect=[(b"parser", {}), m.Incomplete("time-limit")]) as read:
            with self.assertRaisesRegex(m.Incomplete, "time-limit"):
                m.direct_metadata("test")
            self.assertEqual(read.call_count, 2)

    def test_profiles_list_missing_or_duplicate_not_complete(self):
        with patch.object(m, "fixed_read", return_value=b"chrome (unconfined)\nchrome (unconfined)\n"):
            with self.assertRaisesRegex(m.Incomplete, "profile-list-duplicate"): m.profile_list()

    def test_profiles_list_hash_and_count_without_names(self):
        with patch.object(m, "fixed_read", return_value=b"CANARY (unconfined)\n"):
            value = m.profile_list()
        self.assertEqual(value["count"], 1)
        self.assertNotIn("CANARY", json.dumps(value))

    def test_stacking_context_unavailable_is_incomplete(self):
        fields = ["label", "policyNamespaceName", "policyNamespaceLevel", "policyNamespaceStacked", "policyStacked"]
        value = {f: {"status": "available"} for f in fields}
        value["processNamespaces"] = {"user": {"status": "available"}}
        self.assertTrue(m.observer_complete(value))
        value["policyNamespaceStacked"] = {"status": "absent"}
        self.assertFalse(m.observer_complete(value))


class MainTests(unittest.TestCase):
    def run_main(self, change_list=False, incomplete_observer=False):
        root = namespace({"chrome.1": profile()})
        fs = FakeFS(root)
        fs.anchor = lambda: contextlib.nullcontext(root)
        fields = ["label", "policyNamespaceName", "policyNamespaceLevel", "policyNamespaceStacked", "policyStacked"]
        context = {f: {"status": "available"} for f in fields}
        context["processNamespaces"] = {"user": {"status": "available"}}
        if incomplete_observer:
            context["policyStacked"]["status"] = "absent"
        output = SimpleNamespace(buffer=io.BytesIO())
        lists = [{"count": 1, "sha256": "a"}, {"count": 1, "sha256": "b" if change_list else "a"}]
        with patch.object(m, "KernelFS", return_value=fs), patch.object(m, "observer", return_value=context), patch.object(m, "direct_metadata", return_value={}), patch.object(m, "profile_list", side_effect=lists), patch.object(m.os, "fstat", return_value=st(mode=stat.S_IFDIR | 0o755)), patch.object(m.signal, "signal"), patch.object(m.signal, "setitimer"), patch.object(m.sys, "argv", ["diagnostic"]), patch.object(m.sys, "stdout", output):
            code = m.main()
        return code, json.loads(output.buffer.getvalue())

    def test_complete_collection_never_claims_collision_resolution(self):
        code, value = self.run_main()
        self.assertEqual(code, 0)
        self.assertEqual(value["status"], "COLLECTED_CONFLICT_UNRESOLVED")
        self.assertTrue(value["diagnosticOnly"])
        self.assertFalse(value["collisionResolved"])
        self.assertFalse(value["qualification"])
        self.assertFalse(value["environmentEquivalenceToHistoricalTrial"])

    def test_changed_profiles_list_emits_partial_failure(self):
        code, value = self.run_main(change_list=True)
        self.assertEqual(code, 2)
        self.assertEqual(value["failure"], "profile-list-changed")
        self.assertFalse(value["snapshot"]["complete"])

    def test_incomplete_observer_cannot_claim_collection(self):
        code, value = self.run_main(incomplete_observer=True)
        self.assertEqual(code, 2)
        self.assertEqual(value["failure"], "observer-incomplete")

    def test_credential_like_package_value_is_suppressed(self):
        data = b"Package: apparmor\nStatus: install ok installed\nVersion: 1:secret:CANARY\nArchitecture: amd64\n\n"
        value = m.package_identities(data, "test")
        self.assertEqual(value["apparmor"]["status"], "metadata-disclosure-suppressed")
        self.assertNotIn("CANARY", json.dumps(value))


if __name__ == "__main__":
    unittest.main(verbosity=2)
