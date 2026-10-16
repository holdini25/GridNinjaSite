"""Pure/mocked gates only: no privilege, browser, /proc access, or policy load."""
import importlib.util
import io
import json
from pathlib import Path
import stat
import sys
import tempfile
import types
import unittest
from unittest.mock import patch, Mock
import zipfile

sys.dont_write_bytecode = True
SOURCE = Path(__file__).resolve().parents[1] / "facility/qualification-sandbox-provision.py"
SPEC = importlib.util.spec_from_file_location("sandbox_provision", SOURCE)
P = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(P)


class ProvisionTests(unittest.TestCase):
    def refuse(self, code, fn, *args):
        with self.assertRaisesRegex(P.Refusal, "^" + code + "$" ):
            fn(*args)

    def mounts(self):
        return [{"id": 1, "device": "8:1", "root": "/", "target": "/", "options": ["rw"], "fstype": "ext4"}]

    def baseline(self):
        return {"schemaVersion": P.SCHEMA, "phase": "baseline", "outcome": "DENIED_BASELINE_CLOSED",
                "runAttempt": "1", "chromeVersion": P.VERSION, "chromePath": str(P.BINARY), "binarySha256": P.BINARY_SHA,
                "directChildClosed": True, "closure": {"allObservedIdentitiesGone": True}, "startedEpochMs": 1000,
                "endedEpochMs": 2000, "rootPid": 123, "rootStartTicks": "999", "ownedProcesses": [{"pid": 123, "startTicks": "999"}]}

    def journal(self, **changes):
        values = {"apparmor": "DENIED", "operation": "userns_create", "class": "namespace", "profile": "unconfined", "pid": "123", "comm": "chrome"}
        values.update(changes)
        return (json.dumps({"__REALTIME_TIMESTAMP": "1500000", "MESSAGE": " ".join(f'{key}="{value}"' for key, value in values.items())}) + "\n").encode()

    def archive(self, entries):
        out = io.BytesIO()
        with zipfile.ZipFile(out, "w") as archive:
            for name, mode in entries:
                item = zipfile.ZipInfo(name)
                item.external_attr = mode << 16
                archive.writestr(item, b"fixture")
        out.seek(0)
        return zipfile.ZipFile(out)

    def test_exact_reviewed_profile(self):
        self.assertEqual(P.PROFILE, b"abi <abi/4.0>,\ninclude <tunables/global>\n\nprofile gridninja-cft-155 /var/lib/gridninja-cft/155.0.8059.79/chrome-linux64/chrome flags=(unconfined) {\n  userns,\n}\n")

    def test_executed_digest_requires_verified_bootstrap(self):
        self.refuse("verified-bootstrap-required", P.executed_helper_sha)
        with patch.object(P, "__verified_helper_sha256__", "a" * 64, create=True):
            self.assertEqual(P.executed_helper_sha(), "a" * 64)
        with patch.object(P, "__verified_helper_sha256__", "not-a-digest", create=True):
            self.refuse("verified-bootstrap-required", P.executed_helper_sha)

    def test_safe_mounts(self):
        self.assertEqual(P.validate_mounts(self.mounts())["protectedAliasCount"], 0)

    def test_mount_alias_rejected(self):
        mounts = self.mounts() + [{"id": 2, "device": "8:1", "root": "/var", "target": "/tmp/alias", "options": ["rw"], "fstype": "ext4"}]
        self.refuse("protected-mount-alias", P.validate_mounts, mounts)

    def test_nested_mount_rejected(self):
        mounts = self.mounts() + [{"id": 2, "device": "8:2", "root": "/", "target": "/var", "options": ["rw"], "fstype": "ext4"}]
        self.refuse("protected-mount-overlay", P.validate_mounts, mounts)

    def test_policy_mount_alias_rejected(self):
        mounts = self.mounts() + [{"id": 2, "device": "8:1", "root": "/etc/apparmor.d", "target": "/tmp/policy", "options": ["rw"], "fstype": "ext4"}]
        self.refuse("protected-mount-alias", P.validate_mounts, mounts)

    def test_unrelated_mount_allowed(self):
        mounts = self.mounts() + [{"id": 2, "device": "8:2", "root": "/", "target": "/mnt", "options": ["rw"], "fstype": "ext4"}]
        self.assertEqual(P.validate_mounts(mounts)["mountCount"], 2)

    def test_mount_escape_and_malformed(self):
        self.assertEqual(P.unescape_mount(r"/path\040space"), "/path space")
        self.refuse("mount-parse-failed", P.parse_mounts, b"broken")

    def test_literal_and_glob_collision(self):
        for attachment in (str(P.BINARY), "/var/lib/**/chrome", "/{tmp,var}/lib/**/chrome", "/**"):
            with self.subTest(attachment=attachment):
                self.assertTrue(P.attachment_may_match(attachment, str(P.BINARY)))

    def test_disjoint_attachments(self):
        for attachment in ("/usr/{bin,sbin}/chrome", "/opt/google/chrome/chrome", "/home/*/chrome", "unprivileged_userns"):
            with self.subTest(attachment=attachment):
                self.assertFalse(P.attachment_may_match(attachment, str(P.BINARY)))

    def test_unknown_attachment_rejected(self):
        for value in ("<unknown>", "", "@{HOME}/chrome", "/var/[a-z]/**"):
            with self.subTest(value=value), self.assertRaises(P.Refusal):
                P.attachment_may_match(value, str(P.BINARY))

    def test_nested_braces_expanded(self):
        self.assertEqual(sorted(P.expand_braces("/{usr/{bin,sbin},opt}/chrome")), ["/opt/chrome", "/usr/bin/chrome", "/usr/sbin/chrome"])

    def test_archive_regular_allowed(self):
        with self.archive([("chrome-linux64/chrome", stat.S_IFREG | 0o755)]) as archive:
            self.assertEqual(len(P.archive_entries(archive)), 1)

    def test_archive_traversal_rejected(self):
        for name in ("../chrome", "chrome-linux64/../chrome", "/chrome-linux64/chrome", "chrome-linux64//chrome", "chrome-linux64/./chrome"):
            with self.subTest(name=name), self.archive([(name, stat.S_IFREG | 0o755)]) as archive, self.assertRaises(P.Refusal):
                P.archive_entries(archive)

    def test_archive_symlink_and_suid_rejected(self):
        for mode in (stat.S_IFLNK | 0o777, stat.S_IFREG | 0o4755, stat.S_IFIFO | 0o644):
            with self.subTest(mode=mode), self.archive([("chrome-linux64/chrome", mode)]) as archive, self.assertRaises(P.Refusal):
                P.archive_entries(archive)

    def test_archive_duplicate_rejected(self):
        with self.archive([("chrome-linux64/chrome", stat.S_IFREG | 0o755)] * 2) as archive:
            self.refuse("archive-unsafe-name", P.archive_entries, archive)

    def test_metadata_rejects_acl_and_capability(self):
        st = types.SimpleNamespace(st_mode=stat.S_IFREG | 0o755, st_uid=0, st_gid=0, st_nlink=1, st_dev=1, st_ino=1)
        for attrs, code in ((["system.posix_acl_access"], "extended-acl-rejected"), (["security.capability"], "file-capability-rejected")):
            with self.subTest(attrs=attrs), patch.object(P.os, "lstat", return_value=st), patch.object(P.os, "listxattr", return_value=attrs, create=True):
                self.refuse(code, P.secure_metadata, "/test")

    def test_metadata_rejects_runner_write_and_hardlink(self):
        for mode, links, code in ((0o777, 1, "unsafe-mode"), (0o755, 2, "hardlink-rejected")):
            st = types.SimpleNamespace(st_mode=stat.S_IFREG | mode, st_uid=0, st_gid=0, st_nlink=links)
            with self.subTest(mode=mode), patch.object(P.os, "lstat", return_value=st):
                self.refuse(code, P.secure_metadata, "/test")

    def test_valid_baseline(self):
        self.assertEqual(P.validate_baseline(self.baseline(), {"preparedEpochMs": 500}, 2100)[:2], (1000, 2000))

    def test_baseline_requires_all_closure(self):
        value = self.baseline()
        value["closure"]["allObservedIdentitiesGone"] = False
        self.refuse("baseline-closure-unproven", P.validate_baseline, value, {"preparedEpochMs": 500}, 2100)

    def test_baseline_rejects_stale_or_future(self):
        for now in (1000, 62001):
            self.refuse("baseline-time-window-invalid", P.validate_baseline, self.baseline(), {"preparedEpochMs": 500}, now)

    def test_baseline_rejects_substitute_binary(self):
        value = self.baseline()
        value["binarySha256"] = "0" * 64
        self.refuse("baseline-browser-mismatch", P.validate_baseline, value, {"preparedEpochMs": 500}, 2100)

    def test_baseline_rejects_missing_root_identity(self):
        value = self.baseline()
        value["rootPid"] = 124
        self.refuse("baseline-root-missing", P.validate_baseline, value, {"preparedEpochMs": 500}, 2100)

    def test_attributed_denial_positive_and_no_raw_log(self):
        result = P.attributed_denials(self.journal(), 1000, 2000, self.baseline()["ownedProcesses"])
        self.assertEqual(result[0]["pid"], 123)
        self.assertEqual(set(result[0]), {"pid", "epochMs", "operation", "result", "profile", "comm", "rawRecordSha256"})

    def test_attributed_denial_requires_exact_fields(self):
        for changed in ({"pid": "999"}, {"apparmor": "ALLOWED"}, {"operation": "open"}, {"class": "file"}, {"profile": "chrome"}, {"comm": "bash"}):
            with self.subTest(changed=changed):
                self.refuse("attributed-userns-denial-not-established", P.attributed_denials, self.journal(**changed), 1000, 2000, self.baseline()["ownedProcesses"])

    def test_denial_outside_window_rejected(self):
        self.refuse("attributed-userns-denial-not-established", P.attributed_denials, self.journal(), 2000, 3000, self.baseline()["ownedProcesses"])

    def test_closure_rejects_live_identity_accepts_reused_pid(self):
        items = [{"pid": 123, "startTicks": "99"}]
        with patch.object(P, "process_stat", return_value={"startTicks": "99"}):
            self.refuse("observed-process-still-present", P.closed_identities, items)
        with patch.object(P, "process_stat", return_value={"startTicks": "100"}):
            P.closed_identities(items)

    def test_activation_never_loads_without_attributed_denial(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            args = types.SimpleNamespace(head="a" * 40, run_id="1", request="unused")
            with patch.object(P, "ROOT", root), patch.object(P, "PROFILE_PATH", root / "profile"), \
                 patch.object(P, "read_state", return_value={"preparedEpochMs": 500}), \
                 patch.object(P, "unchanged_protection", return_value={"controls": {}}), \
                 patch.object(P, "request", return_value=(self.baseline(), "fixture")), \
                 patch.object(P.time, "time", return_value=2.1), \
                 patch.object(P, "closed_identities"), patch.object(P, "global_closure", return_value={}), \
                 patch.object(P, "command", return_value=b"") as command:
                self.refuse("attributed-userns-denial-not-established", P.activate, args)
                self.assertEqual(command.call_count, 1)
                self.assertEqual(command.call_args.args[0][0], "/usr/bin/journalctl")
                self.assertFalse((root / "profile").exists())

    def test_activation_writes_exact_profile_and_add_only_after_guards(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            args = types.SimpleNamespace(head="a" * 40, run_id="1", request="unused")
            with patch.object(P, "ROOT", root), patch.object(P, "PROFILE_PATH", root / "profile"), \
                 patch.object(P, "read_state", return_value={"preparedEpochMs": 500}), \
                 patch.object(P, "unchanged_protection", return_value={"controls": {}, "profiles": {}}), \
                 patch.object(P, "request", return_value=(self.baseline(), "fixture")), \
                 patch.object(P.time, "time", return_value=2.1), \
                 patch.object(P, "closed_identities"), patch.object(P, "global_closure", return_value={}), \
                 patch.object(P, "secure_metadata"), patch.object(P, "profile_snapshot"), \
                 patch.object(P, "command", side_effect=[self.journal(), (P.PROFILE_NAME + "\n").encode(), b""]) as command:
                self.assertTrue(P.activate(args)["policyLoaded"])
                self.assertEqual((root / "profile").read_bytes(), P.PROFILE)
                self.assertEqual(command.call_args_list[1].args[0], ["/usr/sbin/apparmor_parser", "--names", "--skip-kernel-load", "--skip-cache", "--jobs=0", str(root / "profile")])
                self.assertEqual(command.call_args_list[2].args[0], ["/usr/sbin/apparmor_parser", "--add", "--skip-cache", "--jobs=0", str(root / "profile")])
                self.assertTrue((root / "activation-intent.json").exists())

    def test_gate_requires_active_policy(self):
        with patch.object(P, "read_state", return_value={}), patch.object(P, "read_active"), patch.object(P, "closure", return_value={"policyLoaded": False}):
            self.refuse("matrix-policy-not-active", P.gate, object())

    def test_finalize_never_unloads_with_uncertain_closure(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "activation-intent.json").write_text(json.dumps({"headSha": "a" * 40, "runId": "1", "profileSha256": P.sha_bytes(P.PROFILE)}))
            (root / "profile").write_bytes(P.PROFILE)
            args = types.SimpleNamespace(head="a" * 40, run_id="1")
            with patch.object(P, "ROOT", root), patch.object(P, "PROFILE_PATH", root / "profile"), \
                 patch.object(P, "read_state", return_value={}), patch.object(P, "secure_metadata"), \
                 patch.object(P, "unchanged_protection"), patch.object(P, "global_closure", side_effect=P.Refusal("global-process-closure-unproven")), \
                 patch.object(P, "command") as command:
                self.refuse("global-process-closure-unproven", P.finalize, args)
                command.assert_not_called()
                self.assertTrue((root / "profile").exists())

    def test_attest_rejects_foreign_process_tree(self):
        args = types.SimpleNamespace(head="a" * 40, run_id="1")
        request = {"rootPid": 123, "rootStartTicks": "99", "ownedProcesses": [{"pid": 123, "startTicks": "99"}, {"pid": 999, "startTicks": "100"}]}
        rows = [{"pid": 123, "ppid": 1, "pgrp": 123, "session": 123, "role": "browser"}, {"pid": 999, "ppid": 1, "pgrp": 999, "session": 999, "role": "renderer"}]
        with patch.object(P, "read_state", return_value={"runnerUid": 1001}), patch.object(P, "read_active"), \
             patch.object(P, "request", return_value=(request, "fixture")), patch.object(P, "attest_process", side_effect=rows):
            self.refuse("attest-process-not-owned-tree", P.attest, args)

    def test_global_closure_excludes_confirmed_kernel_thread(self):
        def read(path, limit):
            if str(path).endswith("/cmdline"):
                return b""
            if str(path).endswith("/status"):
                return b"Name:\tkworker\nKthread:\t1\n"
            self.fail("Kernel thread must not cause an attr/current read")
        with patch.object(P.Path, "iterdir", return_value=iter([Path("/proc/2")])), \
             patch.object(P, "process_stat", return_value={"startTicks": "1", "state": "S"}), \
             patch.object(P.os, "readlink", side_effect=FileNotFoundError), patch.object(P, "bounded_read", side_effect=read):
            self.assertEqual(P.global_closure()["unknownProcesses"], 0)

    def test_global_closure_does_not_exclude_unknown_live_process(self):
        with patch.object(P.Path, "iterdir", return_value=iter([Path("/proc/123")])), \
             patch.object(P, "process_stat", return_value={"startTicks": "1", "state": "S"}), \
             patch.object(P.os, "readlink", side_effect=PermissionError):
            self.refuse("global-process-closure-unproven", P.global_closure)

    def test_global_closure_detects_stacked_and_child_profile_labels(self):
        for label in ("other//&gridninja-cft-155 (unconfined)", "gridninja-cft-155//child (enforce)"):
            with self.subTest(label=label), patch.object(P.Path, "iterdir", return_value=iter([Path("/proc/123")])), \
                 patch.object(P, "process_stat", return_value={"startTicks": "1", "state": "S"}), \
                 patch.object(P.os, "readlink", return_value="/usr/bin/example"), patch.object(P, "bounded_read", return_value=label.encode()):
                self.refuse("global-process-closure-unproven", P.global_closure)

    def test_global_closure_detects_deleted_installation_executable(self):
        with patch.object(P.Path, "iterdir", return_value=iter([Path("/proc/123")])), \
             patch.object(P, "process_stat", return_value={"startTicks": "1", "state": "S"}), \
             patch.object(P.os, "readlink", return_value=str(P.BINARY) + " (deleted)"), patch.object(P, "bounded_read", return_value=b"unconfined"):
            self.refuse("global-process-closure-unproven", P.global_closure)

    def test_stop_never_signals_reused_pid(self):
        request = {"rootPid": 123, "rootStartTicks": "99", "ownedProcesses": [{"pid": 123, "startTicks": "99"}]}
        with patch.object(P, "read_state", return_value={"runnerUid": 1001}), patch.object(P, "request", return_value=(request, "fixture")), \
             patch.object(P.os, "pidfd_open", return_value=7, create=True), patch.object(P.os, "close"), \
             patch.object(P, "process_stat", return_value={"startTicks": "100"}), \
             patch.object(P.signal, "pidfd_send_signal", create=True) as send:
            result = P.stop(object())
            send.assert_not_called()
            self.assertEqual(result["alreadyGoneOrReused"], 1)
            self.assertTrue(result["globalClosureStillRequired"])

    def test_stop_validates_all_executables_before_signalling(self):
        request = {"rootPid": 123, "rootStartTicks": "99", "ownedProcesses": [{"pid": 123, "startTicks": "99"}]}
        with patch.object(P, "read_state", return_value={"runnerUid": 1001}), patch.object(P, "request", return_value=(request, "fixture")), \
             patch.object(P.os, "pidfd_open", return_value=7, create=True), patch.object(P.os, "close"), \
             patch.object(P, "process_stat", return_value={"startTicks": "99"}), patch.object(P.os, "readlink", return_value="/usr/bin/other"), \
             patch.object(P.signal, "pidfd_send_signal", create=True) as send:
            self.refuse("stop-executable-mismatch", P.stop, object())
            send.assert_not_called()

    def test_tunables_assignments_and_in_tree_includes(self):
        P.validate_tunable_text(b'# comment\n@{HOMEDIRS}=/home/\n@{HOME}=@{HOMEDIRS}/*/ /root/\n#include <tunables/home.d>\ninclude if exists <tunables/optional>\n')

    def test_tunables_cannot_add_policy_alias_or_outside_include(self):
        for text in (b'profile evil /bin/evil { userns, }', b'alias /var/ -> /home/,', b'include </tmp/unsafe>', b'include <tunables/../unsafe>'):
            with self.subTest(text=text), self.assertRaises(P.Refusal):
                P.validate_tunable_text(text)

    def test_official_noble_tunables_assignment_fixture(self):
        fixture = json.loads((Path(__file__).parent / "fixtures/apparmor-tunables-noble-4.0.1.json").read_text())
        self.assertEqual(fixture["version"], "4.0.1really4.0.1-0ubuntu0.24.04.9")
        self.assertEqual(fixture["packageSha256"], "59af23f557d666039708ec176aa056d2fd85125dabd452accf6d86f5c608fb74")
        self.assertEqual(len(fixture["files"]), 17)
        self.assertEqual(sum(len(file["activeLines"]) for file in fixture["files"]), 111)
        for file in fixture["files"]:
            with self.subTest(file=file["relativePath"]):
                raw = ("\n".join(line["text"] for line in file["activeLines"]) + "\n").encode()
                P.validate_tunable_text(raw, "/etc/apparmor.d/tunables/" + file["relativePath"])

    def test_official_pci_bus_literal_colon_regression(self):
        fixture = json.loads((Path(__file__).parent / "fixtures/apparmor-tunables-noble-4.0.1.json").read_text())
        system = next(file for file in fixture["files"] if file["relativePath"] == "system")
        line = next(line for line in system["activeLines"] if line["lineNumber"] == 100)
        self.assertEqual(line["text"], "@{pci_bus}=pci@{hex4}:@{hex2}")
        P.validate_tunable_text(line["text"].encode())

    def test_assignment_character_change_is_only_literal_colon(self):
        prior = r"[A-Za-z0-9_/.@{}\[\]*?+,~^=\-$\s\"']"
        changed = [point for point in range(128)
                   if bool(P.re.fullmatch(prior, chr(point))) != bool(P.re.fullmatch(P.TUNABLE_VALUE_CHARACTERS, chr(point)))]
        self.assertEqual(changed, [ord(":")])

    def test_colon_does_not_enable_new_directive_or_rule_syntax(self):
        for raw in (b'profile other /tmp/app { userns, }', b'alias /var/ -> /tmp/:,',
                    b'@{X}=/tmp/:; profile other /tmp/app { userns, }', b'include </tmp/:outside>'):
            with self.subTest(raw=raw), self.assertRaises(P.Refusal):
                P.validate_tunable_text(raw)

    def test_tunable_diagnostic_identifies_safe_metadata_without_raw_contents(self):
        raw = b'# synthetic fixture\n@{TEST}=ghp_SYNTHETIC_CANARY_SECRET;\n'
        try:
            P.validate_tunable_text(raw, "/etc/apparmor.d/tunables/system")
            self.fail("Unsupported semicolon must still fail")
        except P.Refusal as error:
            self.assertEqual(str(error), "tunable-assignment-unknown-syntax")
            diagnostic = error.tunable_diagnostic
            self.assertEqual(diagnostic["fileRelativePath"], "system")
            self.assertEqual(diagnostic["lineNumber"], 2)
            self.assertEqual(diagnostic["unexpectedCharacterCodePoints"], [59])
            self.assertEqual(diagnostic["fileSha256"], P.sha_bytes(raw))
            self.assertTrue(diagnostic["rawContentsSuppressed"])
            encoded = json.dumps(diagnostic)
            self.assertNotIn("SYNTHETIC_CANARY_SECRET", encoded)
            self.assertNotIn("@{TEST}", encoded)
            self.assertLess(len(encoded), 1024)

    def test_tunable_diagnostic_suppresses_unrecognized_filename(self):
        with self.assertRaises(P.Refusal) as caught:
            P.validate_tunable_text(b'@{X}=/bad;\n', "/etc/apparmor.d/tunables/private-secret-name")
        encoded = json.dumps(caught.exception.tunable_diagnostic)
        self.assertNotIn("private-secret-name", encoded)
        self.assertEqual(caught.exception.tunable_diagnostic["fileRelativePath"], "unrecognized-tunable")

    def test_tunable_diagnostic_limits_unknown_codepoints(self):
        raw = ('@{X}=' + ''.join(chr(n) for n in range(0x2600, 0x2620))).encode()
        with self.assertRaises(P.Refusal) as caught:
            P.validate_tunable_text(raw)
        diagnostic = caught.exception.tunable_diagnostic
        self.assertEqual(len(diagnostic["unexpectedCharacterCodePoints"]), 8)
        self.assertEqual(diagnostic["additionalUnexpectedCodePoints"], 24)

    def test_lock_prevents_concurrent_helper_and_releases(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / "install"
            with patch.object(P, "ROOT", root), patch.object(P, "secure_metadata"), \
                 patch.object(P, "bounded_read", return_value=b""), patch.object(P, "parse_mounts"), patch.object(P, "validate_mounts"):
                fd = P.invocation_lock("prepare")
                try:
                    self.refuse("another-helper-still-active", P.invocation_lock, "gate")
                finally:
                    P.os.close(fd)
                reopened = P.invocation_lock("gate")
                P.os.close(reopened)

    def test_prepare_never_reuses_existing_root(self):
        with tempfile.TemporaryDirectory() as temp, patch.object(P, "ROOT", Path(temp)):
            self.refuse("installation-or-profile-collision", P.invocation_lock, "prepare")

    def test_lock_rejects_symlink(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "target").write_text("x")
            (root / "invocation.lock").symlink_to(root / "target")
            with patch.object(P, "ROOT", root), patch.object(P, "secure_metadata"), self.assertRaises(OSError):
                P.invocation_lock("gate")

    def test_pending_command_blocks_later_finalize_without_removing_evidence(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / "install"
            with patch.object(P, "ROOT", root), patch.object(P, "secure_metadata"), \
                 patch.object(P, "bounded_read", wraps=P.bounded_read) as read, patch.object(P, "parse_mounts"), patch.object(P, "validate_mounts"):
                read.side_effect = lambda path, limit=65536: b"" if str(path) == "/proc/self/mountinfo" else Path(path).read_bytes()
                fd = P.invocation_lock("prepare")
                P.os.close(fd)
                name = P.command_intent(["/usr/sbin/apparmor_parser", "--add", "--skip-cache", "--jobs=0", str(P.PROFILE_PATH)])
                self.refuse("previous-command-closure-unknown", P.invocation_lock, "finalize")
                self.assertTrue((root / (name + ".json")).exists())
                # Export may inspect and preserve the uncertain command.
                fd = P.invocation_lock("export")
                P.os.close(fd)
                P.exclusive_json(root / (name + "-closed.json"), {"directChildClosed": True, "returnCode": -9})
                fd = P.invocation_lock("gate")
                P.os.close(fd)

    def test_unreaped_command_keeps_pending_intent_and_refuses_followup(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            proc = Mock(pid=123, returncode=None)
            proc.poll.return_value = None
            proc.wait.side_effect = P.subprocess.TimeoutExpired("fixture", 2)
            selector = Mock()
            selector.get_map.return_value = {}
            with patch.object(P, "ROOT", root), patch.object(P, "secure_metadata"), \
                 patch.object(P.subprocess, "Popen", return_value=proc), patch.object(P.selectors, "DefaultSelector", return_value=selector), \
                 patch.object(P.os, "pidfd_open", return_value=7, create=True), patch.object(P.os, "set_blocking"), \
                 patch.object(P.os, "close"), patch.object(P.signal, "pidfd_send_signal", create=True), \
                 patch.object(P.time, "monotonic", side_effect=[0, 10]):
                self.refuse("command-closure-unknown", P.command, ["/usr/bin/journalctl"], 1)
                self.assertEqual(P.pending_command_intents(), ["command-intent-000.json"])
                self.refuse("previous-command-closure-unknown", P.command_intent, ["/usr/sbin/apparmor_parser", "--remove"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
