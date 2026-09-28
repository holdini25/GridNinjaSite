"""Validate rendered frames, encode native-video deliverables and bind their manifest.

Uses a caller-selected ffmpeg and Pillow; no repository or global dependency install.
Every complete-production frame must have a matching render receipt before encoding.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import shutil
import time

from PIL import Image, ImageOps

ROOT=Path(__file__).resolve().parents[2]


def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def write(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    temp=path.with_suffix(path.suffix+'.tmp')
    temp.write_text(json.dumps(value,indent=2)+'\n');temp.replace(path)


def descriptor(path,dimensions=None):
    row={'file':path.name,'bytes':path.stat().st_size,'sha256':sha(path),'mimeType':'video/mp4' if path.suffix=='.mp4' else 'image/webp'}
    if dimensions:row.update(width=dimensions[0],height=dimensions[1])
    return row


def expected_identity(base,mode,comp,settings,settings_path):
    candidates=[base/f'{mode}-both-report.json',base/f'{mode}-{comp}-report.json']
    for path in candidates:
        if not path.exists():continue
        report=json.loads(path.read_text())
        matches=[row for row in report['frames'] if row['composition']==comp]
        if report['status']!='complete' or not matches:continue
        source=report['source']
        if source['settingsSha256']!=sha(settings_path) or report['settings']!=settings:
            raise ValueError('Encoder settings differ from completed render report')
        if source['masterSha256']!=sha(ROOT/'assets-source/facility/facility-master.blend'):
            raise ValueError('Source master differs from completed render report')
        if source['rendererSha256']!=sha(base/'provenance/render.py'):
            raise ValueError('Frozen render source differs from completed render report')
        identity={'source':source,'settings':settings,'camera':matches[0]['camera'],
                  'samples':settings['samples'],'blur':settings['shutterFrames']}
        return hashlib.sha256(json.dumps(identity,sort_keys=True).encode()).hexdigest(),matches[0]['camera']
    raise ValueError(f'No completed {comp} render report; finish or resume rendering first')


def validate_frames(directory,count,expected,dimensions):
    identities=set();png_hashes=set()
    for frame in range(count):
        receipt=json.loads((directory/f'{frame:04d}.json').read_text());identities.add(receipt['identity'])
        if receipt['frame']!=frame:raise ValueError('Frame index does not match receipt')
        if receipt['identity']!=expected:raise ValueError('Frame identity does not bind selected source/settings/camera')
        if [receipt['width'],receipt['height']]!=list(dimensions):raise ValueError('Rendered frame dimensions disagree')
        if {row['file'] for row in receipt['files']}!={f'{frame:04d}.png',f'{frame:04d}.exr'}:raise ValueError('Unexpected frame files')
        for entry in receipt['files']:
            path=directory/entry['file']
            if path.stat().st_size!=entry['bytes'] or sha(path)!=entry['sha256']:raise ValueError(f'Frame hash mismatch: {path}')
            if path.suffix=='.png':png_hashes.add(entry['sha256'])
    if len(identities)!=1:raise ValueError('Frame render identities disagree')
    if len(png_hashes)!=count:raise ValueError('Animation must contain unique rendered source frames')
    return next(iter(identities))


def run(command,log):
    started=time.perf_counter()
    with log.open('wb') as handle:subprocess.run(command,stdout=handle,stderr=subprocess.STDOUT,check=True,timeout=900)
    return {'command':command,'seconds':time.perf_counter()-started,'log':str(log)}


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--output',type=Path,required=True);p.add_argument('--ffmpeg',type=Path,required=True)
    p.add_argument('--mode',choices=['proof','production'],default='production')
    p.add_argument('--crf',type=int,default=18);p.add_argument('--frames',type=int)
    p.add_argument('--settings',type=Path,default=ROOT/'assets-source/facility/cinematic/settings.json')
    args=p.parse_args();base=args.output.resolve()
    if not base.is_relative_to(ROOT/'build/cinematic'):raise ValueError('Private build directory required')
    settings=json.loads(args.settings.read_text());count=args.frames or (30 if args.mode=='proof' else settings['frameCount'])
    if count<=0 or args.mode=='production' and count!=settings['frameCount']:raise ValueError('Production requires the exact complete frame count')
    if not 0<=args.crf<=40:raise ValueError('CRF must be between0and40')
    attempt=base/'encode-attempts'/f'{args.mode}-{time.time_ns()}'
    attempt.mkdir(parents=True)
    (attempt/'source.py').write_bytes(Path(__file__).read_bytes())
    destination=base/('release' if args.mode=='production' else 'proof-media')
    release=attempt/'media';release.mkdir(parents=True)
    report={'encoderVersion':subprocess.check_output([str(args.ffmpeg),'-version'],text=True).splitlines()[0],
            'encoderSha256':sha(args.ffmpeg),'mode':args.mode,'crf':args.crf,
            'color':{'primaries':'bt709','transfer':'iec61966-2-1','matrix':'bt709','range':'limited'},
            'files':[],'runs':[],'frameIdentities':{},'decodedFrames':[]}
    manifest={'schemaVersion':'cinematic.v1','release':'cinematic-v1','environment':'synthetic',
              'source':{'masterIdentity':'gridninja-facility-shared-master','masterSha256':sha(ROOT/'assets-source/facility/facility-master.blend'),'settingsSha256':sha(args.settings)},
              'encoding':{'codec':'h264','profile':'high','pixelFormat':'yuv420p','audio':False,'fastStart':True,
                          'color':{**report['color'],'dynamicRange':'sdr'}},
              'renditions':{},'files':[]}
    for comp,dim in settings['compositions'].items():
        frames=base/args.mode/comp
        expected,camera=expected_identity(base,args.mode,comp,settings,args.settings)
        report['frameIdentities'][comp]=validate_frames(frames,count,expected,(dim['width'],dim['height']))
        width,height=dim['deliveryWidth'],dim['deliveryHeight']
        video=release/f'{comp}.mp4';poster=release/f'poster-{comp}.webp'
        # Preserve the PNG's sRGB transfer while encoding limited-range YUV with
        # BT.709 primaries/matrix. Native playback selected this over a BT.709
        # transfer remap, which visibly lifted the black stage and midtones.
        vf=f'zscale=w={width}:h={height}:filter=lanczos:primariesin=709:transferin=iec61966-2-1:matrixin=gbr:rangein=full:primaries=709:transfer=iec61966-2-1:matrix=709:range=limited,format=yuv420p'
        command=[str(args.ffmpeg),'-y','-hide_banner','-framerate',str(settings['fps']),'-start_number','0','-i',str(frames/'%04d.png'),
                 '-frames:v',str(count),'-vf',vf,'-c:v','libx264','-preset','slow','-crf',str(args.crf),'-profile:v','high',
                 '-pix_fmt','yuv420p','-movflags','+faststart','-an','-color_primaries','bt709','-color_trc','iec61966-2-1','-colorspace','bt709','-color_range','tv',str(video)]
        report['runs'].append(run(command,attempt/f'encode-{comp}.log'))
        decoded=attempt/f'decoded-{comp}-frame0.png'
        decode_vf='zscale=primariesin=709:transferin=iec61966-2-1:matrixin=709:rangein=limited:primaries=709:transfer=iec61966-2-1:matrix=gbr:range=full,format=gbrp,format=rgb24'
        report['runs'].append(run([str(args.ffmpeg),'-y','-hide_banner','-i',str(video),'-frames:v','1','-vf',decode_vf,str(decoded)],attempt/f'decode-{comp}.log'))
        # Poster derives from the actual compressed video first frame, transformed
        # back into sRGB for an image element. Browser playback still needs review.
        report['decodedFrames'].append({'composition':comp,'file':str(decoded),'bytes':decoded.stat().st_size,'sha256':sha(decoded)})
        image=Image.open(decoded).convert('RGB')
        image.save(poster,'WEBP',quality=92,method=6)
        manifest['renditions'][comp]={'width':width,'height':height,'durationSeconds':count/settings['fps'],'fps':settings['fps'],'frameCount':count,
            'video':video.name,'poster':poster.name,'frame0Sha256':sha(frames/'0000.png'),
            'composition':{'renderWidth':dim['width'],'renderHeight':dim['height'],'crop':'full-frame',
                'camera':{'projection':'orthographic','fixed':True,'positionMetres':camera['position'],
                          'rotationEulerRadians':camera['rotation'],'verticalSpanMetres':camera['orthographicSpan'],
                          'azimuthDegrees':camera['azimuth'],'elevationDegrees':camera['elevation'],'padding':camera['padding']}},
            'posterCorrespondence':{'method':'encoded-first-frame','frameIndex':0,'decodedFrameSha256':sha(decoded),
                                    'decodedFrameBytes':decoded.stat().st_size,'encodedVideoSha256':sha(video)}}
        manifest['files'].extend([descriptor(video),descriptor(poster)])
    if args.mode=='production':
        first=Image.open(base/'production/desktop/0000.png').convert('RGB')
        width,height=first.size
        for name,bounds in {'construction':(.22,.28,.69,.83),'cooling':(.43,.035,.795,.425)}.items():
            crop=first.crop(tuple(round(value*(width if i%2==0 else height)) for i,value in enumerate(bounds)))
            # Same scene/time/grade as hero; supporting crops never introduce labels.
            crop=ImageOps.fit(crop,(720,480),Image.Resampling.LANCZOS,centering=(.5,.5))
            path=release/f'still-{name}.webp';crop.save(path,'WEBP',quality=90,method=6)
            manifest['files'].append(descriptor(path,crop.size))
        write(release/'manifest.json',manifest)
        write(base/'provenance/settings.json',settings)
    # Retain every encoded experiment and only update the candidate once all files succeed.
    destination.mkdir(parents=True,exist_ok=True)
    for path in sorted(release.iterdir(),key=lambda p:p.name=='manifest.json'):
        temporary=destination/(path.name+'.tmp')
        shutil.copyfile(path,temporary);temporary.replace(destination/path.name)
    report['files']=manifest['files'];report['status']='complete'
    report['candidateDirectory']=str(destination);report['retainedMediaDirectory']=str(release)
    write(attempt/'report.json',report)
    write(base/f'encode-{args.mode}-report.json',report)
    print(json.dumps({'status':'complete','mode':args.mode,'files':manifest['files']},indent=2))


if __name__=='__main__':main()
