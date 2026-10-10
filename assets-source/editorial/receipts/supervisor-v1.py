"""One private bounded Blender process; shared compute exclusion with browser QA."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--name', required=True)
    parser.add_argument('--timeout', type=int, default=1800)
    parser.add_argument('--blender', default='/Applications/Blender.app/Contents/MacOS/Blender')
    parser.add_argument('--disable-metal-binary-archives', action='store_true',
                        help='One documented retry only after a reproducible Metal archive failure')
    parser.add_argument('arguments', nargs=argparse.REMAINDER)
    args = parser.parse_args()
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
    held = []
    report = {'owner': 'editorial-render', 'pid': os.getpid(), 'token': token, 'task': args.name,
              'startedUnix': time.time(), 'status': 'acquiring', 'timeoutSeconds': args.timeout,
              'globalPreferencesChanged': False, 'metalArchiveFallback': args.disable_metal_binary_archives,
              'supervisorSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
    child = None

    def interrupted(signum, _frame):
        raise InterruptedError(f'Received signal {signum}')

    def stop_child():
        if child and child.poll() is None:
            os.killpg(child.pid, signal.SIGTERM)
            try:
                child.wait(timeout=10)
            except subprocess.TimeoutExpired:
                os.killpg(child.pid, signal.SIGKILL)
                child.wait()

    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    try:
        for lock in [ROOT / 'build/qa/compute.lock', ROOT / 'build/cinematic/render.lock']:
            lock.parent.mkdir(parents=True, exist_ok=True)
            descriptor = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            with os.fdopen(descriptor, 'w') as handle:
                handle.write(json.dumps(report) + '\n')
            held.append((lock, lock.stat().st_ino))
        arguments = args.arguments[1:] if args.arguments[:1] == ['--'] else args.arguments
        command = [args.blender, '--background', '--factory-startup', '--python-exit-code', '2',
                   '--python', str(ROOT / 'scripts/editorial/render.py'), '--', '--output', str(base), *arguments]
        report.update(command=command, status='running', log=str(log))
        report_path.write_text(json.dumps(report, indent=2) + '\n')
        environment = os.environ.copy()
        if args.disable_metal_binary_archives:
            environment['CYCLES_METAL_DISABLE_BINARY_ARCHIVES'] = '1'
        with log.open('wb') as handle:
            child = subprocess.Popen(command, stdout=handle, stderr=subprocess.STDOUT, start_new_session=True,
                                     cwd=ROOT, env=environment)
            report['childPid'] = child.pid
            try:
                report['exitCode'] = child.wait(timeout=args.timeout)
                report['status'] = 'complete' if child.returncode == 0 else 'failed'
            except subprocess.TimeoutExpired:
                report['status'] = 'timeout'
                stop_child()
    except BaseException:
        report['status'] = 'interrupted' if child else 'blocked'
        stop_child()
        raise
    finally:
        report['finishedUnix'] = time.time()
        report['elapsedSeconds'] = report['finishedUnix'] - report['startedUnix']
        report_path.write_text(json.dumps(report, indent=2) + '\n')
        for lock, inode in reversed(held):
            if lock.exists() and lock.stat().st_ino == inode and json.loads(lock.read_text()).get('token') == token:
                lock.unlink()
    if report['status'] != 'complete':
        raise SystemExit(1)
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
