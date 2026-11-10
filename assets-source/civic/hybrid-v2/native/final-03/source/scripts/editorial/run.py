"""One private bounded Blender process; shared compute exclusion with browser QA."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import threading
import time
import uuid

ROOT = Path(__file__).resolve().parents[2]
LOG_BYTE_LIMIT = 1024 * 1024
LOG_DRAIN_SECONDS = 2
TERM_GRACE_SECONDS = 10
KILL_GRACE_SECONDS = 5


class BoundedLog:
    """Drain stdout without backpressure, retaining a bounded head and tail."""
    marker = b'\n[LOG TRUNCATED; byte counts are in the process report]\n'

    def __init__(self, stream, limit):
        if limit <= len(self.marker) + 2:
            raise ValueError('Log limit is too small for truncation metadata')
        self.stream, self.limit = stream, limit
        self.head_limit = (limit - len(self.marker)) // 2
        self.tail_limit = limit - len(self.marker) - self.head_limit
        self.head, self.tail = bytearray(), bytearray()
        self.observed, self.truncated, self.complete = 0, False, False
        self.frozen, self.error = False, None
        self.lock = threading.Lock()
        # An unreaped child or inherited pipe must not keep the supervisor alive.
        # Only this thread closes the stream; the owner never blocks on its read.
        self.thread = threading.Thread(target=self.drain, daemon=True)
        self.thread.start()

    def drain(self):
        try:
            while True:
                chunk = self.stream.read(65536)
                with self.lock:
                    if self.frozen:
                        return
                    if not chunk:
                        self.complete = True
                        return
                    self.observed += len(chunk)
                    if not self.truncated:
                        self.head.extend(chunk)
                        if len(self.head) > self.limit:
                            self.tail = self.head[-self.tail_limit:]
                            del self.head[self.head_limit:]
                            self.truncated = True
                    else:
                        self.tail.extend(chunk)
                        del self.tail[:-self.tail_limit]
        except Exception as error:
            with self.lock:
                if not self.frozen:
                    self.error = str(error)[:200]
        finally:
            self.stream.close()

    def finish(self):
        self.thread.join(timeout=LOG_DRAIN_SECONDS)
        with self.lock:
            self.frozen = True
            retained = bytes(self.head)
            if self.truncated:
                retained += self.marker + bytes(self.tail)
            metadata = {'limitBytes': self.limit, 'observedBytes': self.observed,
                        'savedBytes': len(retained), 'truncated': self.truncated,
                        'streamComplete': self.complete,
                        'observedBytesIsLowerBound': not self.complete,
                        'drainTimeoutSeconds': LOG_DRAIN_SECONDS, 'readError': self.error}
        return retained, metadata


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def job_identity(arguments, blender):
    """Output directories and labels cannot reset the fallback budget."""
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument('--settings', type=Path, default=ROOT / 'assets-source/editorial/settings.json')
    parser.add_argument('--mode', choices=['studies', 'final', 'reference'], default='studies')
    parser.add_argument('--family', choices=['all', 'A-instrument', 'B-architectural', 'C-frontal'], default='all')
    parser.add_argument('--subject', choices=['all', 'ai-workload', 'colocation-hall', 'platform-systems'], default='all')
    parser.add_argument('--device', choices=['metal', 'cpu'], default='metal')
    parser.add_argument('--samples', type=int)
    parsed = parser.parse_args(arguments)
    # Resolve against the caller exactly once. The child changes cwd to ROOT,
    # so forwarding the original relative spelling could load different bytes
    # from those bound by this identity.
    parsed.settings = parsed.settings.resolve()
    samples = parsed.samples or {'studies': 32, 'final': 128, 'reference': 256}[parsed.mode]
    renderer_arguments = ['--settings', str(parsed.settings), '--mode', parsed.mode,
                          '--family', parsed.family, '--subject', parsed.subject,
                          '--device', parsed.device, '--samples', str(samples)]
    identity = {'settingsSha256': digest(parsed.settings), 'mode': parsed.mode, 'family': parsed.family,
                'subject': parsed.subject, 'device': parsed.device,
                'samples': samples,
                'blender': str(Path(blender).resolve()),
                'sources': {path: digest(ROOT / path) for path in [
                    'assets-source/facility/facility-master.blend', 'assets-source/facility/compute.py',
                    'scripts/cinematic/render.py', 'scripts/editorial/render.py']}}
    return hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest(), identity, renderer_arguments


def read_ledger(path):
    if not path.exists():
        return {'version': 'editorial-retries.v1', 'jobs': {}}
    if path.is_symlink():
        raise ValueError('Retry ledger must be a regular owned file')
    value = json.loads(path.read_text())
    if value.get('version') != 'editorial-retries.v1' or not isinstance(value.get('jobs'), dict):
        raise ValueError('Invalid retry ledger; preserve it for explicit recovery')
    return value


def write_ledger(path, value):
    temporary = path.with_name(path.name + '.tmp-' + str(os.getpid()))
    with temporary.open('x') as handle:
        handle.write(json.dumps(value, indent=2) + '\n')
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temporary, path)


def authorize_attempt(ledger, key, identity, retry_of, fallback):
    job = ledger['jobs'].setdefault(key, {'identity': identity, 'attempts': []})
    if job['identity'] != identity:
        raise ValueError('Retry identity collision')
    if retry_of and not fallback:
        raise ValueError('--retry-of requires the explicit Metal archive fallback flag')
    prior = None
    if fallback:
        if identity['device'] != 'metal' or retry_of is None:
            raise ValueError('Metal archive fallback requires --retry-of a recorded failed Metal attempt')
        if any(attempt['fallback'] for attempt in job['attempts']):
            raise ValueError('Single Metal archive fallback retry already consumed for this job')
        prior = next((attempt for attempt in job['attempts'] if attempt['reportPath'] == str(retry_of.resolve())), None)
        if not prior or prior.get('status') != 'failed' or prior.get('fallback'):
            raise ValueError('Retry must link a recorded failed original attempt')
        if prior is not job['attempts'][-1]:
            raise ValueError('Retry must link the immediately preceding failed attempt')
        report_path, log = Path(prior['reportPath']), Path(prior['log'])
        if report_path.is_symlink() or log.is_symlink() or not report_path.is_file() or not log.is_file() or digest(report_path) != prior.get('reportSha256') or digest(log) != prior.get('logSha256'):
            raise ValueError('Prior failure evidence changed or is missing')
        message = log.read_text(errors='replace')
        signature = r'(?im)^.*(?:(?:binary.?archive|MTLBinaryArchive).{0,200}(?:error|fail)|(?:error|fail).{0,200}(?:binary.?archive|MTLBinaryArchive)).*$'
        if not re.search(signature, message):
            raise ValueError('Prior log does not demonstrate a Metal binary archive failure')
    return job, prior


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--name', required=True)
    parser.add_argument('--timeout', type=int, default=1800)
    parser.add_argument('--blender', default='/Applications/Blender.app/Contents/MacOS/Blender')
    parser.add_argument('--disable-metal-binary-archives', action='store_true',
                        help='One documented retry only after a reproducible Metal archive failure')
    parser.add_argument('--retry-of', type=Path, help='Preserved failed process report required for the single fallback retry')
    parser.add_argument('arguments', nargs=argparse.REMAINDER)
    args = parser.parse_args(argv)
    base = args.output.resolve()
    if not base.is_relative_to(ROOT / 'build/cinematic/editorial') or not args.name.replace('-', '').isalnum():
        raise ValueError('Private editorial output and simple attempt name required')
    if args.timeout < 1 or args.timeout > 3600:
        raise ValueError('Timeout must be between 1 and 3600 seconds')
    base.mkdir(parents=True, exist_ok=True)
    report_path, log = base / (args.name + '-process.json'), base / (args.name + '.log')
    if report_path.exists() or log.exists():
        raise ValueError('Use a fresh attempt name')
    token = str(uuid.uuid4())
    arguments = args.arguments[1:] if args.arguments[:1] == ['--'] else args.arguments
    key, identity, arguments = job_identity(arguments, args.blender)
    held = []
    report = {'owner': 'editorial-render', 'pid': os.getpid(), 'token': token, 'task': args.name,
              'startedUnix': time.time(), 'status': 'acquiring', 'timeoutSeconds': args.timeout,
              'globalPreferencesChanged': False, 'metalArchiveFallback': args.disable_metal_binary_archives,
              'jobIdentity': key, 'renderIdentity': identity,
              'supervisorSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
    child, capture = None, None
    ledger_path = ROOT / 'build/qa/editorial-retry-ledger.json'
    ledger, attempt = None, None

    def interrupted(signum, _frame):
        raise InterruptedError(f'Received signal {signum}')

    def stop_child():
        if child is None or report.get('terminationAttempted'):
            return
        if child.poll() is not None:
            report['childExitConfirmed'] = True
            return
        report.update(terminationAttempted=True, termGraceSeconds=TERM_GRACE_SECONDS,
                      killGraceSeconds=KILL_GRACE_SECONDS)
        for stop_signal, grace in [(signal.SIGTERM, TERM_GRACE_SECONDS), (signal.SIGKILL, KILL_GRACE_SECONDS)]:
            try:
                os.killpg(child.pid, stop_signal)
            except ProcessLookupError:
                pass  # Still reap with a finite deadline below.
            try:
                report['exitCode'] = child.wait(timeout=grace)
                report['childExitConfirmed'] = True
                return
            except subprocess.TimeoutExpired:
                pass
        report.update(childExitConfirmed=False, postKillWaitTimedOut=True)

    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    # The friendly precheck above is not ownership. Two callers may both pass
    # it before either acquires the compute lock. Claim this report atomically
    # before entering any finally block that can write it. A losing caller
    # raises here without touching the winner's report, log, or lock.
    with report_path.open('x') as handle:
        handle.write(json.dumps(report, indent=2) + '\n')
    try:
        for lock in [ROOT / 'build/qa/compute.lock', ROOT / 'build/cinematic/render.lock']:
            lock.parent.mkdir(parents=True, exist_ok=True)
            descriptor = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            held.append((lock, os.fstat(descriptor).st_ino))
            with os.fdopen(descriptor, 'w') as handle:
                handle.write(json.dumps(report) + '\n')
        ledger = read_ledger(ledger_path)
        job, prior = authorize_attempt(ledger, key, identity, args.retry_of, args.disable_metal_binary_archives)
        report['attemptCount'] = len(job['attempts']) + 1
        report['retryOf'] = prior['reportPath'] if prior else None
        attempt = {'attemptCount': report['attemptCount'], 'reportPath': str(report_path), 'log': str(log),
                   'fallback': args.disable_metal_binary_archives, 'retryOf': report['retryOf'], 'status': 'running'}
        job['attempts'].append(attempt)
        # Consume the retry before launch, including interruptions. New labels,
        # output directories, or a restarted supervisor cannot restore it.
        write_ledger(ledger_path, ledger)
        command = [identity['blender'], '--background', '--factory-startup', '--python-exit-code', '2',
                   '--python', str(ROOT / 'scripts/editorial/render.py'), '--', '--output', str(base), *arguments]
        report.update(command=command, status='running', log=str(log))
        report_path.write_text(json.dumps(report, indent=2) + '\n')
        environment = os.environ.copy()
        environment.pop('CYCLES_METAL_DISABLE_BINARY_ARCHIVES', None)
        if args.disable_metal_binary_archives:
            environment['CYCLES_METAL_DISABLE_BINARY_ARCHIVES'] = '1'
        with log.open('xb') as handle:
            child = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                     bufsize=0, start_new_session=True, cwd=ROOT, env=environment)
            report.update(childPid=child.pid, childExitConfirmed=False)
            capture = BoundedLog(child.stdout, LOG_BYTE_LIMIT)
            try:
                try:
                    report['exitCode'] = child.wait(timeout=args.timeout)
                    report['childExitConfirmed'] = True
                    report['status'] = 'complete' if child.returncode == 0 else 'failed'
                except subprocess.TimeoutExpired:
                    report['status'] = 'timeout'
                    stop_child()
            except BaseException:
                stop_child()
                raise
            finally:
                retained, report['logCapture'] = capture.finish()
                handle.write(retained)
                if not report['logCapture']['streamComplete'] and report['status'] == 'complete':
                    report['status'] = 'log-incomplete'
    except BaseException:
        report['status'] = 'interrupted' if child else 'blocked'
        stop_child()
        raise
    finally:
        preserve_locks = child is not None and not report.get('childExitConfirmed', False)
        report['locksPreservedForUnconfirmedChild'] = preserve_locks
        report['finishedUnix'] = time.time()
        report['elapsedSeconds'] = report['finishedUnix'] - report['startedUnix']
        try:
            report_path.write_text(json.dumps(report, indent=2) + '\n')
            if attempt is not None:
                attempt.update(status=report['status'], reportSha256=digest(report_path),
                               logSha256=digest(log) if log.exists() else None)
                write_ledger(ledger_path, ledger)
        finally:
            for lock, inode in reversed(held):
                try:
                    if not preserve_locks and lock.exists() and lock.stat().st_ino == inode and json.loads(lock.read_text()).get('token') == token:
                        lock.unlink()
                except (OSError, ValueError):
                    # Preserve malformed/replaced locks for owner-led recovery.
                    # One lock's failure must not prevent releasing another
                    # verified lock still owned by this supervisor.
                    pass
    if report['status'] != 'complete':
        raise SystemExit(1)
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
