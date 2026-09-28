"""One bounded private Blender process; preserves attempts and owns only its child."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import time

ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--output',required=True,type=Path)
p.add_argument('--name',required=True)
p.add_argument('--timeout',type=int,default=1800)
p.add_argument('--script',choices=['render.py','diagnostics.py'],default='render.py')
p.add_argument('--blender',default='/Applications/Blender.app/Contents/MacOS/Blender')
p.add_argument('arguments',nargs=argparse.REMAINDER)
a=p.parse_args()
base=a.output.resolve()
if not base.is_relative_to(ROOT/'build/cinematic') or not a.name.replace('-','').isalnum():raise ValueError('Private output and simple attempt name required')
base.mkdir(parents=True,exist_ok=True)
report_path=base/(a.name+'-process.json');log=base/(a.name+'.log')
if report_path.exists() or log.exists():raise ValueError('Use a fresh attempt name')
lock=ROOT/'build/cinematic/render.lock'
descriptor=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
os.write(descriptor,str(os.getpid()).encode());os.close(descriptor)
arguments=a.arguments[1:] if a.arguments[:1]==['--'] else a.arguments
command=[a.blender,'--background','--factory-startup','--python-exit-code','2','--python',str(ROOT/'scripts/cinematic'/a.script),'--','--output',str(base),*arguments]
report={'command':command,'timeoutSeconds':a.timeout,'startedUnix':time.time(),'status':'running','log':str(log),'globalPreferencesChanged':False}
report_path.write_text(json.dumps(report,indent=2)+'\n')
def interrupted(signum,frame):
    raise InterruptedError(f'Received signal {signum}')

signal.signal(signal.SIGTERM,interrupted)
child=None
report['supervisorSha256']=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
try:
    with log.open('wb') as handle:
        child=subprocess.Popen(command,stdout=handle,stderr=subprocess.STDOUT,start_new_session=True,cwd=ROOT)
        try:
            report['exitCode']=child.wait(timeout=a.timeout)
            report['status']='complete' if child.returncode==0 else 'failed'
        except subprocess.TimeoutExpired:
            report['status']='timeout';os.killpg(child.pid,signal.SIGTERM)
            try:child.wait(timeout=10)
            except subprocess.TimeoutExpired:os.killpg(child.pid,signal.SIGKILL);child.wait()
except BaseException:
    report['status']='interrupted'
    if child and child.poll() is None:
        os.killpg(child.pid,signal.SIGTERM)
        try:child.wait(timeout=10)
        except subprocess.TimeoutExpired:os.killpg(child.pid,signal.SIGKILL);child.wait()
    raise
finally:
    report['finishedUnix']=time.time();report['elapsedSeconds']=report['finishedUnix']-report['startedUnix']
    report_path.write_text(json.dumps(report,indent=2)+'\n');lock.unlink(missing_ok=True)
if report['status']!='complete':raise SystemExit(1)
print(json.dumps(report,indent=2))
