"""Diagnostics for actual Cycles proof frames; never substitutes for motion review."""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--output',type=Path,required=True)
a=p.parse_args();base=a.output.resolve()
if not base.is_relative_to(ROOT/'build/cinematic'):raise ValueError('Private build directory required')
settings=json.loads((ROOT/'assets-source/facility/cinematic/settings.json').read_text())
report={'version':'cinematic-motion-diagnostics.v1','humanMotionReview':'pending','composition':{},
        'animation':{'rotorCount':4,'bladesPerRotor':5,'turnsPerLoop':settings['rotorTurns'],
          'bladePassHz':[5*t/settings['durationSeconds'] for t in settings['rotorTurns']],
          'nyquistHz':settings['fps']/2,'shutterSeconds':settings['shutterFrames']/settings['fps'],
          'phaseClosure':'integer revolutions per loop; activity is cosine-periodic',
          'note':'Illustrative visual speeds, not measured equipment ratings. Nyquist check covers fundamental blade passage, not every edge harmonic.'}}

def stats(first,second,mask=None):
    delta=np.abs(first.astype(float)-second.astype(float))
    if mask is not None:delta=delta[mask]
    return {'meanAbsolute8bit':float(delta.mean()),'p95Absolute8bit':float(np.percentile(delta,95)),
            'p99Absolute8bit':float(np.percentile(delta,99)),'maxAbsolute8bit':float(delta.max())}

for comp,dim in settings['compositions'].items():
    directory=base/'proof'/comp
    def load(n):return np.array(Image.open(directory/f'{n:04d}.png').convert('RGB'))
    zero=load(0);height,width=zero.shape[:2]
    mask=zero.max(axis=2)>12
    yy,xx=np.ogrid[:height,:width]
    fan_mask=np.zeros((height,width),dtype=bool)
    aspect_adjust=1 if comp=='desktop' else 5/6
    for x,y in [(.5,.092),(.575,.142),(.65,.191),(.725,.242)]:
        y=.5+(y-.5)*aspect_adjust
        fan_mask|=((xx/width-x)/.031)**2+((yy/height-y)/(.024*aspect_adjust))**2<1
    frames=[load(n) for n in range(30)]
    consecutive=[stats(frames[n],frames[n+1],mask)['meanAbsolute8bit'] for n in range(29)]
    fan_motion=[stats(frames[n],frames[n+1],fan_mask)['meanAbsolute8bit'] for n in range(29)]
    closure=stats(zero,load(300),mask);boundary=stats(load(299),zero,mask)
    row={'frameCount':30,'diagnosticBoundaryFrames':[296,297,298,299,300],
       'repeatedTime0And300':closure,'transition299To0':boundary,
       'consecutiveForegroundMeanAbsolute8bit':consecutive,
       'consecutiveFanRoiMeanAbsolute8bit':fan_motion,
       'checks':{'renderedFanRoisChange':min(fan_motion)>.05,
                 'periodicImageClosure':closure['meanAbsolute8bit']<1 and closure['p99Absolute8bit']<=4,
                 'boundaryNotAnOutlier':boundary['meanAbsolute8bit']<=max(consecutive)*1.5+.05},
       'note':'Image deltas are diagnostics; visual playback must judge apparent fan direction, LED restraint, shimmer and poster transition.'}
    report['composition'][comp]=row
    crop=(int(width*.44),int(height*(.025 if comp=='desktop' else .105)),int(width*.79),int(height*(.29 if comp=='desktop' else .33)))
    sheet=Image.new('RGB',(1080,520),'#0b0e10');draw=ImageDraw.Draw(sheet)
    for idx,n in enumerate([0,1,2,5,15,29]):
        tile=Image.fromarray(frames[n]).crop(crop);tile.thumbnail((352,218),Image.Resampling.LANCZOS)
        x=idx%3*360;y=idx//3*260
        sheet.paste(tile,(x,y+24));draw.text((x+8,y+5),f'Actual Cycles frame {n}',fill='white')
    sheet.save(base/f'motion-contact-{comp}.png')
report['diagnosticChecksPassed']=all(all(row['checks'].values()) for row in report['composition'].values())
(base/'motion-diagnostics.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
