"""Headless supervisor tests; never launch Blender or use the shared GPU slot."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('editorial_supervisor', Path(__file__).resolve().parents[3] / 'scripts/editorial/run.py')
supervisor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(supervisor)


class SupervisorTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.root = Path(self.directory.name).resolve()
        self.root_patch = patch.object(supervisor, 'ROOT', self.root)
        self.root_patch.start()
        for name in ['assets-source/editorial/settings.json', 'assets-source/facility/facility-master.blend',
                     'assets-source/facility/compute.py', 'scripts/cinematic/render.py', 'scripts/editorial/render.py']:
            file = self.root / name
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_text('{}')
        self.launches = []

    def tearDown(self):
        self.root_patch.stop()
        self.directory.cleanup()

    def launch(self, name, extra=None, log='ERROR: MTLBinaryArchive failed to load\n', code=2, environment=None):
        output = self.root / 'build/cinematic/editorial' / name
        arguments = ['run.py', '--output', str(output), '--name', name, '--blender', '/test/blender', *(extra or []), '--', '--mode', 'final', '--family', 'C-frontal']
        launches = self.launches

        class Child:
            def __init__(self, command, **kwargs):
                launches.append(kwargs['env'])
                self.stdout = io.BytesIO(log.encode())
                self.pid, self.returncode = 12345, code

            def wait(self, timeout=None):
                return code

            def poll(self):
                return code

        with patch.object(sys, 'argv', arguments), patch.object(supervisor.subprocess, 'Popen', Child), \
                patch.dict(supervisor.os.environ, environment or {}, clear=False), contextlib.redirect_stdout(io.StringIO()):
            supervisor.main()
        return output / (name + '-process.json')

    def report(self, name):
        return self.root / 'build/cinematic/editorial' / name / (name + '-process.json')

    def assert_unlocked(self):
        self.assertFalse((self.root / 'build/qa/compute.lock').exists())
        self.assertFalse((self.root / 'build/cinematic/render.lock').exists())

    def test_unlinked_fallback_and_environment_bypass_are_rejected(self):
        with self.assertRaisesRegex(ValueError, 'requires --retry-of'):
            self.launch('unlinked', ['--disable-metal-binary-archives'])
        self.assertEqual(len(self.launches), 0)
        self.launch('normal', code=0, environment={'CYCLES_METAL_DISABLE_BINARY_ARCHIVES': '1'})
        self.assertNotIn('CYCLES_METAL_DISABLE_BINARY_ARCHIVES', self.launches[0])
        self.assert_unlocked()

    def test_single_retry_is_durable_across_new_labels_and_preserves_evidence(self):
        with self.assertRaises(SystemExit):
            self.launch('original')
        original = self.report('original')
        original_bytes = original.read_bytes()
        self.launch('new-label', ['--disable-metal-binary-archives', '--retry-of', str(original)], code=0)
        record = json.loads(self.report('new-label').read_text())
        self.assertEqual(record['attemptCount'], 2)
        self.assertEqual(record['retryOf'], str(original))
        self.assertEqual(self.launches[1]['CYCLES_METAL_DISABLE_BINARY_ARCHIVES'], '1')
        with self.assertRaisesRegex(ValueError, 'already consumed'):
            self.launch('another-new-label', ['--disable-metal-binary-archives', '--retry-of', str(original)])
        self.assertEqual(len(self.launches), 2)
        self.assertEqual(original.read_bytes(), original_bytes)
        self.assert_unlocked()

    def test_corrupt_failure_and_nonarchive_failure_cannot_authorize_retry(self):
        with self.assertRaises(SystemExit):
            self.launch('other-error', log='ERROR: unsupported geometry\n')
        with self.assertRaisesRegex(ValueError, 'does not demonstrate'):
            self.launch('retry-other-error', ['--disable-metal-binary-archives', '--retry-of', str(self.report('other-error'))])
        with self.assertRaises(SystemExit):
            self.launch('archive-error')
        log = self.root / 'build/cinematic/editorial/archive-error/archive-error.log'
        log.write_text(log.read_text() + 'changed')
        with self.assertRaisesRegex(ValueError, 'evidence changed'):
            self.launch('retry-corrupt', ['--disable-metal-binary-archives', '--retry-of', str(self.report('archive-error'))])
        self.assert_unlocked()

    def test_old_failure_is_not_the_immediately_preceding_attempt(self):
        with self.assertRaises(SystemExit):
            self.launch('old-failure')
        self.launch('subsequent-success', code=0)
        with self.assertRaisesRegex(ValueError, 'immediately preceding'):
            self.launch('retry-old', ['--disable-metal-binary-archives', '--retry-of', str(self.report('old-failure'))])
        self.assert_unlocked()

    def test_identical_settings_and_default_samples_have_same_identity(self):
        clone = self.root / 'renamed-settings.json'
        clone.write_bytes((self.root / 'assets-source/editorial/settings.json').read_bytes())
        first, _, _ = supervisor.job_identity(['--mode', 'final'], '/test/blender')
        second, _, _ = supervisor.job_identity(['--samples', '128', '--settings', str(clone), '--mode', 'final'], '/test/blender')
        self.assertEqual(first, second)

    def test_relative_caller_settings_match_hashed_and_child_consumed_bytes(self):
        caller = self.root / 'caller'
        caller.mkdir()
        caller_settings = caller / 'custom.json'
        caller_settings.write_text('{"selection":"caller"}')
        (self.root / 'custom.json').write_text('{"selection":"different ROOT file"}')
        output = self.root / 'build/cinematic/editorial/relative-settings'
        observed = {}

        class Child:
            def __init__(self, command, **kwargs):
                self.pid, self.returncode = 12345, 0
                self.stdout = io.BytesIO()
                settings = Path(command[command.index('--settings') + 1])
                consumed_path = settings if settings.is_absolute() else kwargs['cwd'] / settings
                observed.update(settings=settings, cwd=kwargs['cwd'], consumed=consumed_path.read_bytes(), consumedPath=consumed_path, executable=command[0])

            def wait(self, timeout=None):
                return 0

            def poll(self):
                return 0

        arguments = ['--output', str(output), '--name', 'relative-settings', '--blender', 'tools/blender',
                     '--', '--settings', 'custom.json', '--mode', 'final', '--family', 'C-frontal']
        previous = Path.cwd()
        try:
            supervisor.os.chdir(caller)
            with patch.object(supervisor.subprocess, 'Popen', Child), contextlib.redirect_stdout(io.StringIO()):
                supervisor.main(arguments)
        finally:
            supervisor.os.chdir(previous)
        record = json.loads((output / 'relative-settings-process.json').read_text())
        self.assertEqual(record['renderIdentity']['settingsSha256'], supervisor.digest(observed['consumedPath']))
        self.assertTrue(observed['settings'].is_absolute())
        self.assertEqual(observed['settings'], caller_settings)
        self.assertEqual(observed['cwd'], self.root)
        self.assertEqual(observed['executable'], str(caller / 'tools/blender'))
        self.assertEqual(observed['consumed'], caller_settings.read_bytes())
        self.assertEqual(record['renderIdentity']['settingsSha256'], supervisor.digest(observed['settings']))
        self.assertNotEqual(record['renderIdentity']['settingsSha256'], supervisor.digest(self.root / 'custom.json'))
        self.assert_unlocked()

    def test_interrupted_fallback_is_consumed_before_child_launch(self):
        with self.assertRaises(SystemExit):
            self.launch('failed')
        original = self.report('failed')
        real_write = supervisor.write_ledger
        writes = []

        def interrupt_after_reservation(path, value):
            real_write(path, value)
            writes.append(1)
            if len(writes) == 1:
                raise InterruptedError('interrupted after durable reservation')

        with patch.object(supervisor, 'write_ledger', side_effect=interrupt_after_reservation):
            with self.assertRaises(InterruptedError):
                self.launch('interrupted-retry', ['--disable-metal-binary-archives', '--retry-of', str(original)])
        with self.assertRaisesRegex(ValueError, 'already consumed'):
            self.launch('renamed-retry', ['--disable-metal-binary-archives', '--retry-of', str(original)])
        self.assertEqual(len(self.launches), 1)
        self.assert_unlocked()

    def test_foreign_lock_is_preserved_and_ledger_failure_releases_owned_locks(self):
        lock = self.root / 'build/qa/compute.lock'
        lock.parent.mkdir(parents=True)
        lock.write_text('foreign owner')
        with self.assertRaises(FileExistsError):
            self.launch('blocked')
        self.assertEqual(lock.read_text(), 'foreign owner')
        lock.unlink()
        with patch.object(supervisor, 'write_ledger', side_effect=OSError('disk failure')):
            with self.assertRaisesRegex(OSError, 'disk failure'):
                self.launch('ledger-error')
        self.assert_unlocked()

    def test_same_output_and_name_contender_cannot_overwrite_running_owner(self):
        # Both invocations pass the non-atomic precheck before either creates
        # its report. Hold the owner in a harmless mocked child while allowing
        # the contender to reach report/compute-lock acquisition.
        barrier = threading.Barrier(2)
        owner_running = threading.Event()
        contender_finished = threading.Event()
        original_identity = supervisor.job_identity
        snapshots, results, launches = {}, {}, []
        output = self.root / 'build/cinematic/editorial/shared'
        report = output / 'shared-process.json'
        log = output / 'shared.log'
        lock = self.root / 'build/qa/compute.lock'
        arguments = ['--output', str(output), '--name', 'shared', '--blender', '/test/blender',
                     '--', '--mode', 'final', '--family', 'C-frontal']

        def synchronized_identity(*args):
            identity = original_identity(*args)
            barrier.wait(timeout=5)
            if threading.current_thread().name == 'contender':
                if not owner_running.wait(timeout=5):
                    raise RuntimeError('Owner did not reach mocked child')
            return identity

        class Child:
            def __init__(self, command, **kwargs):
                launches.append(command)
                self.stdout = io.BytesIO()
                self.pid, self.returncode = 12345, 2
                snapshots['before'] = [path.read_bytes() for path in [report, log, lock]]
                owner_running.set()

            def wait(self, timeout=None):
                if not contender_finished.wait(timeout=5):
                    raise RuntimeError('Contender did not finish')
                snapshots['after'] = [path.read_bytes() for path in [report, log, lock]]
                return 2

            def poll(self):
                return 2

        def invoke(role):
            try:
                supervisor.main(arguments)
            except BaseException as error:
                results[role] = error
            finally:
                if role == 'contender':
                    contender_finished.set()

        with patch.object(supervisor, 'job_identity', side_effect=synchronized_identity), \
                patch.object(supervisor.signal, 'signal'), patch.object(supervisor.subprocess, 'Popen', Child):
            threads = [threading.Thread(target=invoke, args=(role,), name=role) for role in ['owner', 'contender']]
            for thread in threads:
                thread.start()
            for thread in threads:
                thread.join(timeout=7)
            self.assertTrue(all(not thread.is_alive() for thread in threads))
        self.assertIsInstance(results.get('contender'), FileExistsError)
        self.assertIsInstance(results.get('owner'), SystemExit)
        self.assertEqual(len(launches), 1)
        self.assertEqual(snapshots['before'], snapshots['after'])
        record = json.loads(report.read_text())
        self.assertEqual(record['status'], 'failed')
        ledger = supervisor.read_ledger(self.root / 'build/qa/editorial-retry-ledger.json')
        attempts = next(iter(ledger['jobs'].values()))['attempts']
        self.assertEqual(len(attempts), 1)
        self.assertEqual(attempts[0]['reportSha256'], supervisor.digest(report))
        self.assertEqual(attempts[0]['logSha256'], supervisor.digest(log))
        self.assert_unlocked()

    def test_bounded_log_keeps_head_tail_and_counts_all_observed_bytes(self):
        message = 'beginning\n' + 'x' * 10000 + '\nERROR: MTLBinaryArchive failed to load\n'
        with patch.object(supervisor, 'LOG_BYTE_LIMIT', 256), self.assertRaises(SystemExit):
            self.launch('noisy-failure', log=message)
        report = self.report('noisy-failure')
        record = json.loads(report.read_text())
        retained = Path(record['log']).read_bytes()
        self.assertLessEqual(len(retained), 256)
        self.assertTrue(retained.startswith(b'beginning\n'))
        self.assertTrue(retained.endswith(b'ERROR: MTLBinaryArchive failed to load\n'))
        self.assertIn(supervisor.BoundedLog.marker, retained)
        self.assertEqual(record['logCapture']['observedBytes'], len(message.encode()))
        self.assertEqual(record['logCapture']['savedBytes'], len(retained))
        self.assertTrue(record['logCapture']['truncated'])
        self.assertTrue(record['logCapture']['streamComplete'])
        self.assertFalse(record['logCapture']['observedBytesIsLowerBound'])
        ledger = supervisor.read_ledger(self.root / 'build/qa/editorial-retry-ledger.json')
        original = next(iter(ledger['jobs'].values()))['attempts'][0]
        self.assertEqual(original['logSha256'], supervisor.digest(record['log']))
        self.assertEqual(original['reportSha256'], supervisor.digest(report))
        # The retained tail supports the permitted retry without changing its
        # original bounded evidence or durable per-job budget.
        before = report.read_bytes(), retained
        self.launch('noisy-retry', ['--disable-metal-binary-archives', '--retry-of', str(report)], code=0)
        self.assertEqual(before, (report.read_bytes(), Path(record['log']).read_bytes()))
        self.assert_unlocked()

    def test_log_drain_has_finite_deadline_and_marks_partial_byte_count(self):
        released, entered = threading.Event(), threading.Event()

        class HeldPipe:
            def read(self, _size):
                entered.set()
                released.wait(timeout=5)
                return b'later bytes'

            def close(self):
                pass

        capture = supervisor.BoundedLog(HeldPipe(), 256)
        self.assertTrue(entered.wait(timeout=1))
        try:
            with patch.object(supervisor, 'LOG_DRAIN_SECONDS', 0.01):
                retained, metadata = capture.finish()
            self.assertEqual(retained, b'')
            self.assertFalse(metadata['streamComplete'])
            self.assertTrue(metadata['observedBytesIsLowerBound'])
            self.assertEqual(metadata['observedBytes'], 0)
        finally:
            released.set()
            capture.thread.join(timeout=1)
        self.assertFalse(capture.thread.is_alive())
        self.assertEqual(capture.observed, 0)  # No mutation after final evidence.

    def test_postkill_wait_is_finite_and_unconfirmed_child_preserves_owned_locks(self):
        for reaped in [True, False]:
            with self.subTest(reaped=reaped):
                output = self.root / 'build/cinematic/editorial' / ('reaped' if reaped else 'unconfirmed')
                waits, signals = [], []

                class Child:
                    def __init__(self, *_args, **_kwargs):
                        self.pid, self.returncode, self.stdout = 12345, None, io.BytesIO(b'stopping\n')

                    def wait(self, timeout=None):
                        waits.append(timeout)
                        if reaped and len(waits) == 3:
                            self.returncode = -9
                            return -9
                        raise supervisor.subprocess.TimeoutExpired('harmless stub', timeout)

                    def poll(self):
                        return self.returncode

                arguments = ['--output', str(output), '--name', 'stop', '--timeout', '1', '--blender', '/test/blender', '--', '--mode', 'final']
                with patch.object(supervisor.subprocess, 'Popen', Child), \
                        patch.object(supervisor.os, 'killpg', side_effect=lambda _pid, value: signals.append(value)), \
                        self.assertRaises(SystemExit):
                    supervisor.main(arguments)
                record = json.loads((output / 'stop-process.json').read_text())
                self.assertEqual(waits, [1, supervisor.TERM_GRACE_SECONDS, supervisor.KILL_GRACE_SECONDS])
                self.assertTrue(all(timeout is not None and timeout > 0 for timeout in waits))
                self.assertEqual(signals, [supervisor.signal.SIGTERM, supervisor.signal.SIGKILL])
                self.assertEqual(record['status'], 'timeout')
                self.assertEqual(record['childExitConfirmed'], reaped)
                self.assertEqual(record['locksPreservedForUnconfirmedChild'], not reaped)
                self.assertTrue(record['logCapture']['streamComplete'])
                if reaped:
                    self.assert_unlocked()
                else:
                    self.assertTrue(record['postKillWaitTimedOut'])
                    for lock in [self.root / 'build/qa/compute.lock', self.root / 'build/cinematic/render.lock']:
                        self.assertEqual(json.loads(lock.read_text())['token'], record['token'])
                        lock.unlink()  # Stub-only owner cleanup before next subtest.


if __name__ == '__main__':
    unittest.main()
