#!/usr/bin/env python3
"""Offline adversarial tests; no privileged execution or browser launch."""
import ast
import copy
import importlib.util
import io
import json
import os
from pathlib import Path
import stat
import types
import unittest
from unittest.mock import patch
import zipfile

HELPER = Path(__file__).resolve().parents[1] / "facility/qualification-native-observer.py"
spec = importlib.util.spec_from_file_location("native_observer", HELPER)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def ns(seed):
    return {key: key + ":[" + str(seed + index) + "]" for index, key in enumerate(m.NAMESPACES)}


def row(pid=100, parent=20, role="browser"):
    return {"pid": pid, "ppid": parent, "pgrp": 20, "session": 20, "startTicks": str(pid * 10),
            "state": "S", "role": role, "uid": 1001, "gid": 1001,
            "executable": str(m.BINARY), "binarySha256": m.BINARY_SHA,
            "label": "unconfined", "labelMode": "unconfined", "namespaces": ns(1),
            "NoNewPrivs": 0, "Seccomp": 0, "Seccomp_filters": 0, "CapEff": "0000000000000000",
            "NSpid": [pid], "uidMap": [[0, 0, 4294967295]], "gidMap": [[0, 0, 4294967295]]}


def renderer(pid=102, parent=101):
    value = row(pid, parent, "renderer")
    value.update(namespaces=ns(11), NoNewPrivs=1, Seccomp=2, Seccomp_filters=1,
                 NSpid=[pid, 2], uidMap=[[0, 1001, 1]], gidMap=[[0, 1001, 1]])
    return value


def request():
    return {"schemaVersion": m.SCHEMA, "headSha": "a" * 40, "runId": "99", "runnerUid": 1001,
            "caller": {"pid": 20, "startTicks": "200"}}


def status_bytes(**changes):
    values = {"Uid": "1001\t1001\t1001\t1001", "Gid": "1001\t1001\t1001\t1001",
              "NSpid": "100", "NoNewPrivs": "0", "Seccomp": "0", "Seccomp_filters": "0",
              "CapEff": "0000000000000000"}
    values.update(changes)
    return ("\n".join(k + ":\t" + v for k, v in values.items()) + "\n").encode()


class PassiveFixtures(unittest.TestCase):
    def test_import_has_no_execution_surface(self):
        tree = ast.parse(HELPER.read_text())
        modules = {node.names[0].name for node in ast.walk(tree) if isinstance(node, ast.Import)}
        self.assertFalse(modules & {"subprocess", "socket", "requests", "urllib"})
        calls = {ast.unparse(node.func) for node in ast.walk(tree) if isinstance(node, ast.Call)}
        self.assertFalse(calls & {"os.system", "os.kill", "os.execv", "signal.pidfd_send_signal"})
        self.assertNotIn("apparmor_parser", HELPER.read_text())
        self.assertNotIn("matchingProfileProcesses", HELPER.read_text())

    def test_request_identity(self):
        self.assertEqual(m.read_request(io.BytesIO(json.dumps(request()).encode())), request())

    def test_request_bad_identity(self):
        for field, value in [("schemaVersion", "old-trial"), ("headSha", "a"), ("runId", "0"),
                             ("runnerUid", 0), ("runnerUid", True), ("caller", {"pid": 1, "startTicks": "3"})]:
            with self.subTest(field=field, value=value):
                data = request(); data[field] = value
                with self.assertRaises(m.Refusal):
                    m.read_request(io.BytesIO(json.dumps(data).encode()))

    def test_request_bounded(self):
        with self.assertRaisesRegex(m.Refusal, "request-size-limit"):
            m.read_request(io.BytesIO(b" " * 131073))

    def test_scalar_absence_is_not_zero(self):
        with patch.object(m, "bounded_read", side_effect=FileNotFoundError):
            self.assertEqual(m.scalar_fact("unused"), {"status": "absent"})
            with self.assertRaisesRegex(m.Refusal, "required-context-absent"):
                m.scalar_fact("unused", optional=False)

    def test_scalar_permission_is_not_absence(self):
        with patch.object(m, "bounded_read", side_effect=PermissionError):
            with self.assertRaises(PermissionError):
                m.scalar_fact("unused")

    def test_revision_one_fresh_nonblocking_read(self):
        with patch.object(m.os, "open", return_value=4) as opened, patch.object(m.os, "read", return_value=b"5\n") as read, patch.object(m.os, "close") as closed:
            self.assertEqual(m.scalar_fact("unused", revision=True), {"status": "present", "value": 5})
            self.assertTrue(opened.call_args.args[1] & os.O_NONBLOCK)
            read.assert_called_once_with(4, 257); closed.assert_called_once_with(4)

    def test_revision_would_block_is_not_zero(self):
        with patch.object(m.os, "open", return_value=4), patch.object(m.os, "read", side_effect=BlockingIOError), patch.object(m.os, "close"):
            with self.assertRaises(BlockingIOError):
                m.scalar_fact("unused", revision=True)

    def test_scalar_types(self):
        for raw, kind, expected in [(b"0\n", "number", 0), (b"Y\n", "bool", True), (b"no\n", "bool", False), (b"root\n", "text", "root")]:
            with self.subTest(raw=raw), patch.object(m, "bounded_read", return_value=raw):
                self.assertEqual(m.scalar_fact("unused", kind), {"status": "present", "value": expected})

    def test_scalar_invalid(self):
        for raw, kind in [(b"-1\n", "number"), (b"unknown\n", "bool"), (b"hello\nworld", "text")]:
            with self.subTest(raw=raw), patch.object(m, "bounded_read", return_value=raw):
                with self.assertRaises(m.Refusal): m.scalar_fact("unused", kind)

    def test_natural_labels_preserved(self):
        for label, mode in [("unconfined", "unconfined"), ("chrome (unconfined)", "unconfined"), ("profile//child (enforce)", "enforce")]:
            with self.subTest(label=label), patch.object(m, "bounded_read", return_value=(label + "\n").encode()):
                self.assertEqual(m.read_label(100), (label, mode))

    def test_label_internal_newline_rejected(self):
        with patch.object(m, "bounded_read", return_value=b"unconfined\nforged"):
            with self.assertRaisesRegex(m.Refusal, "process-label-invalid"): m.read_label(100)

    def test_process_stat_comm_parentheses(self):
        fields = ["S", "20", "20", "20"] + ["0"] * 15 + ["777"]
        with patch.object(m, "bounded_read", return_value=("100 (chrome (helper)) " + " ".join(fields)).encode()):
            self.assertEqual(m.process_stat(100)["startTicks"], "777")

    def test_process_stat_pid_substitution_rejected(self):
        with patch.object(m, "bounded_read", return_value=b"200 (x) S 1 1 1"):
            with self.assertRaisesRegex(m.Refusal, "process-stat-invalid"): m.process_stat(100)

    def test_required_status_missing_fails(self):
        raw = status_bytes().replace(b"Seccomp_filters:\t0\n", b"")
        with self.assertRaisesRegex(m.Refusal, "process-status-incomplete"): m.parse_status(raw)

    def test_duplicate_status_fails(self):
        with self.assertRaisesRegex(m.Refusal, "duplicate-process-status"):
            m.parse_status(status_bytes() + b"Seccomp:\t2\n")

    def test_renderer_positive(self):
        m.assert_renderer(renderer(), row(), 1001)

    def test_renderer_missing_required_kernel_evidence(self):
        for key, value in [("NoNewPrivs", 0), ("Seccomp", 0), ("Seccomp_filters", 0), ("CapEff", "1")]:
            with self.subTest(key=key):
                candidate = renderer(); candidate[key] = value
                with self.assertRaisesRegex(m.Refusal, "renderer-kernel-sandbox-missing"):
                    m.assert_renderer(candidate, row(), 1001)

    def test_each_renderer_namespace_must_differ(self):
        for key in ("user", "pid", "net"):
            with self.subTest(key=key):
                candidate = renderer(); candidate["namespaces"][key] = row()["namespaces"][key]
                with self.assertRaisesRegex(m.Refusal, "renderer-namespace-not-isolated"):
                    m.assert_renderer(candidate, row(), 1001)

    def test_renderer_uid_mapping_exact_single_host_user(self):
        for mapping in [[[0, 1002, 1]], [[0, 1001, 2]], [[0, 1001, 1], [1, 1002, 1]]]:
            with self.subTest(mapping=mapping):
                candidate = renderer(); candidate["uidMap"] = mapping
                with self.assertRaisesRegex(m.Refusal, "renderer-user-map-invalid"):
                    m.assert_renderer(candidate, row(), 1001)

    def test_renderer_gid_mapping_invalid(self):
        candidate = renderer(); candidate["gidMap"] = [[0, 1002, 1]]
        with self.assertRaisesRegex(m.Refusal, "renderer-group-map-invalid"): m.assert_renderer(candidate, row(), 1001)

    def test_renderer_pid_nesting_required(self):
        candidate = renderer(); candidate["NSpid"] = [102]
        with self.assertRaisesRegex(m.Refusal, "renderer-pid-map-invalid"): m.assert_renderer(candidate, row(), 1001)

    def test_renderer_executable_pin(self):
        candidate = renderer(); candidate["binarySha256"] = "0" * 64
        with self.assertRaisesRegex(m.Refusal, "renderer-identity-invalid"): m.assert_renderer(candidate, row(), 1001)

    def test_descendant_tree(self):
        root, zygote, child = row(), row(101, 100, "zygote"), renderer()
        m.assert_process_tree([root, zygote, child], root, {"pid": 20})

    def test_reparented_process_cannot_be_attested(self):
        root, child = row(), renderer(parent=1)
        with self.assertRaisesRegex(m.Refusal, "process-not-current-owned-descendant"):
            m.assert_process_tree([root, child], root, {"pid": 20})

    def test_root_must_originate_in_runner(self):
        with self.assertRaisesRegex(m.Refusal, "browser-root-parent-mismatch"):
            m.assert_process_tree([row()], row(), {"pid": 21})

    def test_tree_cycle_fails(self):
        root, a, b = row(), row(101, 102, "zygote"), renderer()
        with self.assertRaisesRegex(m.Refusal, "process-not-current-owned-descendant"):
            m.assert_process_tree([root, a, b], root, {"pid": 20})

    def test_duplicate_process_fails(self):
        with self.assertRaisesRegex(m.Refusal, "duplicate-attested-process"):
            m.assert_process_tree([row(), row()], row(), {"pid": 20})

    def test_known_live_identity_blocks_closure(self):
        with patch.object(m, "process_stat", return_value=row()):
            with self.assertRaisesRegex(m.Refusal, "observed-process-still-present"):
                m.closed_identities([{"pid": 100, "startTicks": "1000"}])

    def test_reused_pid_does_not_own_new_process(self):
        with patch.object(m, "process_stat", return_value={**row(), "startTicks": "2000"}):
            m.closed_identities([{"pid": 100, "startTicks": "1000"}])

    def test_gone_identity_closed(self):
        with patch.object(m, "process_stat", side_effect=FileNotFoundError):
            m.closed_identities([{"pid": 100, "startTicks": "1000"}])

    def scan_fixture(self, executable):
        return (patch.object(m.Path, "iterdir", return_value=iter([Path("/proc/100")])),
                patch.object(m, "process_stat", return_value=row()),
                patch.object(m.os, "readlink", return_value=executable))

    def test_common_label_unrelated_executable_does_not_block_closure(self):
        a, b, c = self.scan_fixture("/usr/bin/bash")
        with a, b, c, patch.object(m, "read_label", side_effect=AssertionError("must not inspect shared label")):
            self.assertEqual(m.installation_closure()["matchingInstallationProcesses"], 0)

    def test_protected_installation_leftover_blocks_closure(self):
        for suffix in ("", " (deleted)"):
            a, b, c = self.scan_fixture(str(m.BINARY) + suffix)
            with self.subTest(suffix=suffix), a, b, c:
                with self.assertRaisesRegex(m.Refusal, "installation-process-closure-unproven"):
                    m.installation_closure()

    def test_unknown_live_executable_blocks_closure(self):
        a, b, _ = self.scan_fixture("")
        with a, b, patch.object(m.os, "readlink", side_effect=FileNotFoundError), patch.object(m, "bounded_read", return_value=b"live\0"):
            with self.assertRaisesRegex(m.Refusal, "installation-process-closure-unproven"):
                m.installation_closure()

    def test_scan_permission_failure_requires_privileged_read(self):
        a, b, _ = self.scan_fixture("")
        with a, b, patch.object(m.os, "readlink", side_effect=PermissionError):
            with self.assertRaises(PermissionError): m.installation_closure()

    def test_archive_accepts_bounded_ordinary_distribution(self):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as archive: archive.writestr("chrome-linux64/chrome", b"fixture")
        with zipfile.ZipFile(io.BytesIO(buf.getvalue())) as archive: self.assertEqual(len(m.archive_entries(archive)), 1)

    def test_archive_traversal_symlink_and_setuid_rejected(self):
        cases = [("chrome-linux64/../chrome", stat.S_IFREG | 0o644),
                 ("chrome-linux64/chrome", stat.S_IFLNK | 0o777),
                 ("chrome-linux64/chrome", stat.S_IFREG | 0o4755)]
        for name, mode in cases:
            with self.subTest(name=name, mode=mode):
                buf = io.BytesIO()
                with zipfile.ZipFile(buf, "w") as archive:
                    info = zipfile.ZipInfo(name); info.external_attr = mode << 16; archive.writestr(info, b"x")
                with zipfile.ZipFile(io.BytesIO(buf.getvalue())) as archive:
                    with self.assertRaises(m.Refusal): m.archive_entries(archive)

    def test_archive_duplicate_rejected(self):
        info = zipfile.ZipInfo("chrome-linux64/chrome")
        with self.assertRaisesRegex(m.Refusal, "archive-unsafe-name"):
            m.archive_entries(types.SimpleNamespace(infolist=lambda: [info, info]))

    def test_mount_alias_rejected(self):
        root = {"id": 1, "target": "/", "root": "/", "device": "8:1", "options": ["rw"], "fstype": "ext4"}
        self.assertEqual(m.validate_mounts([root])["protectedAliasCount"], 0)
        alias = {**root, "id": 2, "target": "/alias", "root": str(m.ROOT)}
        with self.assertRaisesRegex(m.Refusal, "protected-mount-alias"): m.validate_mounts([root, alias])

    def test_host_or_caller_drift_blocks_context(self):
        state = {"host": {"revision": 1}, "runnerUid": 1001, "callerContext": {"pid": 20}, "inventory": {}}
        with patch.object(m, "read_state", return_value=state), patch.object(m, "host_facts", return_value={"revision": 2}):
            with self.assertRaisesRegex(m.Refusal, "host-security-context-changed"): m.checked_context(request())
        with patch.object(m, "read_state", return_value=state), patch.object(m, "host_facts", return_value=state["host"]), patch.object(m, "process_context", return_value={"pid": 21}):
            with self.assertRaisesRegex(m.Refusal, "runner-context-changed"): m.checked_context(request())

    def test_installation_drift_blocks_context(self):
        state = {"host": {}, "runnerUid": 1001, "callerContext": {}, "inventory": {"sha256": "old"}}
        with patch.object(m, "read_state", return_value=state), patch.object(m, "host_facts", return_value={}), patch.object(m, "process_context", return_value={}), patch.object(m, "protected_inventory", return_value={"sha256": "new"}):
            with self.assertRaisesRegex(m.Refusal, "protected-distribution-changed"): m.checked_context(request())


    def process_fixture(self, labels=None, stats=None, argv=None, status=None):
        from contextlib import ExitStack
        stack = ExitStack()
        proc = row()
        stack.enter_context(patch.object(m, "process_stat", side_effect=stats or [proc, proc]))
        stack.enter_context(patch.object(m, "read_label", side_effect=labels or [("unconfined", "unconfined")] * 2))
        stack.enter_context(patch.object(m, "read_namespaces", return_value=ns(1)))
        stack.enter_context(patch.object(m, "read_map", return_value=[[0, 0, 4294967295]]))
        stack.enter_context(patch.object(m.os, "readlink", return_value=str(m.BINARY)))
        stack.enter_context(patch.object(m.os, "stat", return_value=types.SimpleNamespace(st_dev=1, st_ino=2)))
        stack.enter_context(patch.object(m, "secure_metadata", return_value={}))
        stack.enter_context(patch.object(m, "sha_file", return_value=m.BINARY_SHA))
        command = argv or (str(m.BINARY) + "\0--headless\0").encode()
        def read(path, limit=0):
            return (status or status_bytes()) if str(path).endswith("status") else command
        stack.enter_context(patch.object(m, "bounded_read", side_effect=read))
        return stack

    def test_real_process_context_shape(self):
        with self.process_fixture():
            value = m.process_context({"pid": 100, "startTicks": "1000"}, 1001, True)
            self.assertEqual(value["label"], "unconfined")
            self.assertEqual(value["labelMode"], "unconfined")
            self.assertEqual(value["role"], "browser")
            self.assertEqual(value["binarySha256"], m.BINARY_SHA)

    def test_process_reuse_at_first_read_fails(self):
        with self.process_fixture(stats=[{**row(), "startTicks": "2000"}]):
            with self.assertRaisesRegex(m.Refusal, "process-identity-changed"):
                m.process_context({"pid": 100, "startTicks": "1000"}, 1001, True)

    def test_process_reuse_during_read_fails(self):
        with self.process_fixture(stats=[row(), {**row(), "startTicks": "2000"}]):
            with self.assertRaisesRegex(m.Refusal, "process-identity-or-parent-changed"):
                m.process_context({"pid": 100, "startTicks": "1000"}, 1001, True)

    def test_process_reparent_during_read_fails(self):
        with self.process_fixture(stats=[row(), {**row(), "ppid": 1}]):
            with self.assertRaisesRegex(m.Refusal, "process-identity-or-parent-changed"):
                m.process_context({"pid": 100, "startTicks": "1000"}, 1001, True)

    def test_process_label_drift_fails(self):
        with self.process_fixture(labels=[("unconfined", "unconfined"), ("chrome (enforce)", "enforce")]):
            with self.assertRaisesRegex(m.Refusal, "process-context-changed"):
                m.process_context({"pid": 100, "startTicks": "1000"}, 1001, True)

    def test_process_root_uid_rejected(self):
        with self.process_fixture(status=status_bytes(Uid="0 0 0 0")):
            with self.assertRaisesRegex(m.Refusal, "unexpected-process-owner"):
                m.process_context({"pid": 100, "startTicks": "1000"}, 1001, True)

    def test_process_forbidden_flags_rejected(self):
        for flag in m.FORBIDDEN_FLAGS:
            with self.subTest(flag=flag), self.process_fixture(argv=(str(m.BINARY) + "\0" + flag + "\0").encode()):
                with self.assertRaisesRegex(m.Refusal, "sandbox-disabling-argument"):
                    m.process_context({"pid": 100, "startTicks": "1000"}, 1001, True)

    def test_process_duplicate_roles_rejected(self):
        argv = (str(m.BINARY) + "\0--type=renderer\0--type=zygote\0").encode()
        with self.process_fixture(argv=argv):
            with self.assertRaisesRegex(m.Refusal, "ambiguous-process-type"):
                m.process_context({"pid": 100, "startTicks": "1000"}, 1001, True)

    def test_process_partial_status_fails(self):
        with self.process_fixture(status=b"Uid: 1001 1001 1001 1001\n"):
            with self.assertRaisesRegex(m.Refusal, "process-status-incomplete"):
                m.process_context({"pid": 100, "startTicks": "1000"}, 1001, True)


if __name__ == "__main__":
    unittest.main()
