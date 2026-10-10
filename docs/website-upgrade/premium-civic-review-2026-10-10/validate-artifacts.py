"""Read-only validation of review artifacts; no application or browser tests."""
import datetime, hashlib, json, pathlib, re
from html.parser import HTMLParser
from urllib.parse import unquote, urlsplit
from PIL import Image
P=pathlib.Path(__file__).resolve().parent
errors=[]
jsons=list(P.glob('*.json'))
for f in jsons:
 try: json.loads(f.read_text())
 except Exception as e: errors.append(f'{f.name}: {e}')
class Links(HTMLParser):
 def __init__(self): super().__init__(); self.links=[]
 def handle_starttag(self,tag,attrs):
  d=dict(attrs)
  for a in ('href','src'):
   if a in d:self.links.append(d[a])
local_count=0
for f in [*P.glob('*.md'),P/'report.html']:
 text=f.read_text()
 if f.suffix=='.md': links=re.findall(r'\]\(([^)]+)\)',text)
 else:
  h=Links();h.feed(text);links=h.links
 for link in links:
  u=urlsplit(link.strip('<>'))
  if u.scheme or not u.path or u.path.startswith('/'):continue
  target=(f.parent/unquote(u.path)).resolve();local_count+=1
  if not target.exists():errors.append(f'{f.name}: missing {link}')
for f in P.glob('*'):
 if f.suffix in {'.md','.py','.css','.ts','.html','.json'}:
  for i,line in enumerate(f.read_text().splitlines(),1):
   if line.rstrip()!=line:errors.append(f'{f.name}:{i}: trailing whitespace')
captures=json.loads((P/'capture-index.json').read_text())
assert len(captures)==40
assert len({(r['slug'],r['width']) for r in captures})==40
assert {r['width'] for r in captures}=={320,390,768,1440}
assert all(r['scrollY']==0 and not r['overflow'] for r in captures)
for r in captures:
 for suffix in ['', '-full']:
  file=P/'screenshots'/f"{r['slug']}-{r['width']}{suffix}.jpg"
  with Image.open(file) as im:
   if im.width!=r['width'] or im.height<1000:errors.append(f'{file.name}: dimensions {im.size}')
 assert (P/'screenshots'/f"{r['slug']}-{r['width']}.txt").exists()
findings=json.loads((P/'findings.json').read_text())['findings']
assert len(findings)==14 and len({f['id'] for f in findings})==14
for f in findings:
 for key in ['routes','viewportState','screenshots','classification','observed','proposal','confidence','effort','acceptance']:assert f[key]
 for shot in f['screenshots']:assert (P/'screenshots'/shot).exists()
 assert abs(f['priorityScore']-round((2*f['visualImpact']+2*f['messageClarity']+f['confidenceScore'])/f['effortWeight'],1))<.01
colors=json.loads((P/'color-system.json').read_text())
def lum(h):
 x=[int(h[i:i+2],16)/255 for i in [1,3,5]]
 x=[c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in x]
 return sum(c*w for c,w in zip(x,[.2126,.7152,.0722]))
for c in colors['contrastChecks']:
 a,b=sorted([lum(colors['tokens'][t]['hex']) for t in [c['foreground'],c['background']]])
 ratio=(b+.05)/(a+.05)
 assert abs(ratio-c['ratio'])<.0001 and ratio>=c['minimum']
http=json.loads((P/'http-baseline.json').read_text());assert len(http['routes'])==41
assert all(m['matchesSourceFile'] for m in http['media'])
assert len(http['sitemap'])==18
assert all(r.get('title') and r.get('h1Count')==1 for r in http['routes'] if r.get('status')==200)
record={'validatedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'Review artifacts only; not live-site conformance or application tests','pass':not errors,'errors':errors,'jsonFilesParsed':len(jsons),'relativeFileLinksChecked':local_count,'canonicalViewportCaptures':len(captures),'topAndFullImagesChecked':80,'uniqueFindings':len(findings),'colorPairsIndependentlyRecomputed':len(colors['contrastChecks']),'httpPageProbes':len(http['routes']),'researchTypecheck':'Passed isolated strict tsc; see cross-review-technical.md','browserReportReview':'Desktop1440 and mobile390; no document-level horizontal overflow. Screenshots retained.','notRun':['Application lint/typecheck/build/unit/browser suites (no application changes)','Fresh live performance measurements','Complete live keyboard/reduced-motion/no-JavaScript/failed-media matrix','Verified200% enlarged-text capture','Physical-device checks']}
(P/'validation.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record,indent=2))
if errors:raise SystemExit(1)
