"""Measure the actual delivered codec/poster; no craft or device-approval claim."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import time
import threading

import numpy as np
from PIL import Image

def temporal_diagnostics(ffmpeg,video,decode_filter,width,height,count,directory,comp):
    command=[str(ffmpeg),'-v','error','-i',str(video),'-vf',decode_filter,'-pix_fmt','rgb24','-f','rawvideo','pipe:1']
    values=np.arange(256,dtype=np.float32)/255
    linear=np.where(values<=.04045,values/12.92,((values+.055)/1.055)**2.4)
    first=previous=mask=None;means=[];largest={'pixels':0};transitions=[]
    with (directory/f'{comp}-temporal-decode.log').open('wb') as log:
        process=subprocess.Popen(command,stdout=subprocess.PIPE,stderr=log)
        timer=threading.Timer(120,process.kill);timer.start()
        try:
            for frame in range(count):
                data=process.stdout.read(width*height*3)
                if len(data)!=width*height*3:raise ValueError('Temporal decode ended before the complete loop')
                rgb=np.frombuffer(data,dtype=np.uint8).reshape(height,width,3)
                luminance=.2126*linear[rgb[:,:,0]]+.7152*linear[rgb[:,:,1]]+.0722*linear[rgb[:,:,2]]
                if first is None:first=luminance.copy();mask=rgb.max(axis=2)>12
                means.append(float(luminance[mask].mean()))
                if previous is not None:
                    changed=(np.abs(luminance-previous)>=.1)&(np.maximum(luminance,previous)>=.5)
                    pixels=int(changed.sum());transitions.append(pixels)
                    if pixels>largest['pixels']:largest={'pixels':pixels,'fromFrame':frame-1,'toFrame':frame}
                previous=luminance
            changed=(np.abs(first-previous)>=.1)&(np.maximum(first,previous)>=.5)
            boundary_pixels=int(changed.sum());transitions.append(boundary_pixels)
            if boundary_pixels>largest['pixels']:largest={'pixels':boundary_pixels,'fromFrame':count-1,'toFrame':0}
            if process.stdout.read(1):raise ValueError('Temporal decode contains unexpected extra frames')
            if process.wait(timeout=10)!=0:raise ValueError('Temporal decode failed')
        finally:
            timer.cancel()
            if process.poll() is None:process.kill();process.wait()
    return {'decodedFrames':count,'comparedTransitionsIncludingWrap':len(transitions),
       'foregroundDefinition':'Frame0 pixels with maximum decoded sRGB channel greater than12/255.',
       'thresholdDefinition':'Pixels whose estimated linear sRGB relative luminance changes by at least0.10 and reaches at least0.50 in either frame. Aggregate changed pixels, not connected-region area or a flash-frequency test.',
       'largestChangingBrightAggregate':{**largest,'fractionOfFullFrame':largest['pixels']/(width*height),'fractionOfForeground':largest['pixels']/int(mask.sum())},
       'boundaryChangingBrightPixels':boundary_pixels,
       'foregroundMeanRelativeLuminance':{'minimum':min(means),'maximum':max(means),'range':max(means)-min(means),'perFrame':means},
       'sceneExposureSetting':0,'automaticExposure':False,
       'manualFlashSafetyReview':'Required separately; these descriptive measurements are not independent flash-safety certification.',
       'decodeCommand':command}


ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--output',type=Path,required=True);p.add_argument('--ffmpeg',type=Path,required=True)
p.add_argument('--release-directory',type=Path)
p.add_argument('--transfer',choices=['srgb','bt709'],default='srgb',help='Use bt709 only when inspecting retained superseded encodes')
a=p.parse_args();base=a.output.resolve()
if not base.is_relative_to(ROOT/'build/cinematic'):raise ValueError('Private build directory required')
release=a.release_directory.resolve() if a.release_directory else base/'release'
if not release.is_relative_to(base):raise ValueError('Release must belong to this private candidate')
manifest=json.loads((release/'manifest.json').read_text())
declared_transfer=manifest.get('encoding',{}).get('color',{}).get('transfer')
if declared_transfer and declared_transfer!=('iec61966-2-1' if a.transfer=='srgb' else 'bt709'):
    raise ValueError('Inspection transfer must match the encoded release declaration')
for entry in manifest['files']:
    path=release/entry['file']
    if path.stat().st_size!=entry['bytes'] or hashlib.sha256(path.read_bytes()).hexdigest()!=entry['sha256']:
        raise ValueError('Delivery artifact no longer matches its manifest')
directory=base/'delivery-inspection'/str(time.time_ns());directory.mkdir(parents=True)
transfer='iec61966-2-1' if a.transfer=='srgb' else '709'
report={'version':'cinematic-delivery-diagnostics.v1','release':manifest['release'],'transfer':a.transfer,'manifestSha256':hashlib.sha256((release/'manifest.json').read_bytes()).hexdigest(),'renditions':{},
        'limitations':['SSIM measures codec fidelity after the same SDR conversion and central crop. It does not score photographic quality.',
          'RGB delta is measured by explicit limited-range BT.709-matrix YUV→sRGB RGB decoding using the declared transfer. Native browser and physical-phone playback are separate checks.']}
for comp,r in manifest['renditions'].items():
    source=base/'production'/comp;video=release/r['video'];poster=release/r['poster']
    w,h=r['width'],r['height'];decoded=directory/f'{comp}-frame0.png'
    decode_filter=f'zscale=primariesin=709:transferin={transfer}:matrixin=709:rangein=limited:primaries=709:transfer=iec61966-2-1:matrix=gbr:range=full,format=gbrp,format=rgb24'
    decode=[str(a.ffmpeg),'-y','-hide_banner','-i',str(video),'-frames:v','1','-vf',decode_filter,str(decoded)]
    subprocess.run(decode,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,check=True,timeout=120)
    rgb=np.array(Image.open(decoded).convert('RGB')).astype(float)
    poster_rgb=np.array(Image.open(poster).convert('RGB')).astype(float)
    mask=rgb.max(axis=2)>12;difference=np.abs(rgb-poster_rgb)[mask]
    row={'videoBytes':video.stat().st_size,'videoSha256':hashlib.sha256(video.read_bytes()).hexdigest(),'posterBytes':poster.stat().st_size,
         'posterVsDecodedFrame0':{'meanAbsolute8bit':float(difference.mean()),'p95Absolute8bit':float(np.percentile(difference,95)),
           'p99Absolute8bit':float(np.percentile(difference,99)),
           'decodedCornerRgb':rgb[0,0].tolist(),'posterCornerRgb':poster_rgb[0,0].tolist()}}
    yuv_command=[str(a.ffmpeg),'-v','error','-i',str(video),'-frames:v','1','-pix_fmt','yuv420p','-f','rawvideo','pipe:1']
    yuv=np.frombuffer(subprocess.check_output(yuv_command,timeout=120),dtype=np.uint8)
    if len(yuv)!=w*h*3//2:raise ValueError('Unexpected YUV frame byte count')
    y=yuv[:w*h].reshape(h,w);u=yuv[w*h:w*h*5//4].reshape(h//2,w//2);v=yuv[w*h*5//4:].reshape(h//2,w//2)
    corners={name:[int(y[py,px]),int(u[py//2,px//2]),int(v[py//2,px//2])]
             for name,py,px in [('topLeft',0,0),('topRight',0,w-1),('bottomLeft',h-1,0),('bottomRight',h-1,w-1)]}
    row['encodedBlack']={'yuvCorners':corners,'top16RowsYRange':[int(y[:16].min()),int(y[:16].max())],
       'left16ColumnsYRange':[int(y[:,:16].min()),int(y[:,:16].max())],
       'expectedNeutralDigitalBlackYuv':[16,128,128],'command':yuv_command,
       'limitation':'Digital YUV samples and explicit decode do not substitute for native browser compositor measurements.'}
    conversion=f'zscale=w={w}:h={h}:filter=lanczos:primariesin=709:transferin=iec61966-2-1:matrixin=gbr:rangein=full:primaries=709:transfer={transfer}:matrix=709:range=limited,format=yuv420p'
    # Apply the same central90%×80% crop to both inputs, reducing black-margin bias.
    crop='crop=iw*.9:ih*.8:iw*.05:ih*.08'
    stats=directory/f'{comp}-ssim.txt'
    filters=f'[0:v]{conversion},{crop}[reference];[1:v]{crop}[encoded];[reference][encoded]ssim=stats_file={stats}'
    command=[str(a.ffmpeg),'-hide_banner','-framerate',str(r['fps']),'-i',str(source/'%04d.png'),'-i',str(video),
             '-filter_complex',filters,'-frames:v',str(r['frameCount']),'-f','null','-']
    result=subprocess.run(command,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,text=True,check=True,timeout=300)
    (directory/f'{comp}-ssim.log').write_text(result.stderr)
    match=re.search(r'SSIM Y:[^\n]*All:([0-9.]+)',result.stderr)
    if not match:raise ValueError('Missing SSIM summary')
    row['centralCropSsim']=float(match.group(1));row['ssimFrameRows']=len(stats.read_text().splitlines())
    if row['ssimFrameRows']!=r['frameCount']:raise ValueError('Codec comparison did not cover every production frame')
    row['decodeCommand']=decode;row['comparisonCommand']=command
    row['temporal']=temporal_diagnostics(a.ffmpeg,video,decode_filter,w,h,r['frameCount'],directory,comp)
    report['renditions'][comp]=row
report['status']='complete'
(base/'delivery-diagnostics.json').write_text(json.dumps(report,indent=2)+'\n')
(directory/'report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
