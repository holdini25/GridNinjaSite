"""Bounded civic Blender worker, serialized with repository render/browser QA."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import time
import uuid

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('editorial_supervisor',ROOT/'scripts/editorial/run.py')
supervisor=importlib.util.module_from_spec(spec);spec.loader.exec_module(supervisor)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--timeout',type=int,default=1800)
    parser.add_argument('arguments',nargs=argparse.REMAINDER)
    args=parser.parse_args()
    output=args.output.resolve()
    if not output.is_relative_to(ROOT/'build/civic-hybrid'):raise ValueError('Private civic output required')
    if not 1<=args.timeout<=3600:raise ValueError('Timeout outside bounded range')
    output.mkdir(parents=True,exist_ok=True)
    report_path=output/'process-record.json';log_path=output/'blender.log'
    token=str(uuid.uuid4());held=[];child=None;capture=None
    report={'schema':'gridninja.civic-supervisor.v2','owner':'civic-hybrid-render','pid':os.getpid(),'token':token,'startedUnix':time.time(),'timeoutSeconds':args.timeout,'globalPreferencesChanged':False,'status':'acquiring','supervisorSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
    with report_path.open('x') as handle:handle.write(json.dumps(report,indent=2)+'\n')
    def stop():
        if child is None:return
        if child.poll() is not None:report['childExitConfirmed']=True;return
        report['terminationAttempted']=True
        for sig,seconds in [(signal.SIGTERM,10),(signal.SIGKILL,5)]:
            try:os.killpg(child.pid,sig)
            except ProcessLookupError:pass
            try:report['exitCode']=child.wait(timeout=seconds);report['childExitConfirmed']=True;return
            except subprocess.TimeoutExpired:pass
        report['childExitConfirmed']=False
    def interrupted(signum,_frame):raise InterruptedError('Signal '+str(signum))
    signal.signal(signal.SIGTERM,interrupted);signal.signal(signal.SIGINT,interrupted)
    try:
        for lock in [ROOT/'build/qa/compute.lock',ROOT/'build/cinematic/render.lock']:
            lock.parent.mkdir(parents=True,exist_ok=True)
            fd=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600);held.append((lock,os.fstat(fd).st_ino))
            with os.fdopen(fd,'w') as handle:handle.write(json.dumps(report)+'\n')
        arguments=args.arguments[1:] if args.arguments[:1]==['--'] else args.arguments
        command=['/Applications/Blender.app/Contents/MacOS/Blender','--background','--factory-startup','--python-exit-code','2','--python',str(ROOT/'scripts/civic/render-hybrid.py'),'--','--output',str(output),*arguments]
        env=os.environ.copy();env.pop('CYCLES_METAL_DISABLE_BINARY_ARCHIVES',None)
        report.update(command=command,status='running')
        with log_path.open('xb') as log:
            child=subprocess.Popen(command,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,bufsize=0,start_new_session=True,cwd=ROOT,env=env)
            report.update(childPid=child.pid,childExitConfirmed=False)
            capture=supervisor.BoundedLog(child.stdout,supervisor.LOG_BYTE_LIMIT)
            report_path.write_text(json.dumps(report,indent=2)+'\n')
            try:
                report['exitCode']=child.wait(timeout=args.timeout);report['childExitConfirmed']=True
                report['status']='complete' if child.returncode==0 else 'failed'
            except subprocess.TimeoutExpired:
                report['status']='timeout';stop()
            except BaseException:
                report['status']='interrupted';stop();raise
            finally:
                retained,report['logCapture']=capture.finish();log.write(retained)
                if report['status']=='complete' and not report['logCapture']['streamComplete']:report['status']='log-incomplete'
    except BaseException:
        if child is None:report['status']='blocked'
        stop();raise
    finally:
        preserve=child is not None and not report.get('childExitConfirmed',False)
        report.update(finishedUnix=time.time(),elapsedSeconds=time.time()-report['startedUnix'],locksPreservedForUnconfirmedChild=preserve)
        report_path.write_text(json.dumps(report,indent=2)+'\n')
        for lock,inode in reversed(held):
            if not preserve and lock.exists() and lock.stat().st_ino==inode and json.loads(lock.read_text()).get('token')==token:lock.unlink()
    print(json.dumps(report,indent=2))
    if report['status']!='complete':raise SystemExit(1)


if __name__=='__main__':main()
