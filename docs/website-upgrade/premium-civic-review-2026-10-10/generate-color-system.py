"""Generate the design token proposal and exact sRGB contrast checks, not product CSS."""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent
COLORS = {
    "canvas": "#080808", "surface": "#111315", "surface-raised": "#191C20",
    "heading": "#F4F7FA", "body": "#CDD3D8", "supporting": "#B8B8B8",
    "orange": "#FF9F1A", "orange-hover": "#FFB44D", "orange-pressed": "#E98B0C",
    "control-edge": "#7B858E", "decorative-edge": "#2A3035",
    "allow": "#83D8AD", "repair": "#E2C168", "reject": "#FF8F91",
    "no-proof": "#AFC2D6", "proof-cyan": "#61E4FF",
    "paper": "#E8EDF1", "paper-ink": "#1A2026", "paper-secondary": "#485662",
    "paper-orange": "#86420B", "media-matte": "#010101",
}

def linear(hex_value):
    values = [int(hex_value[i:i+2], 16)/255 for i in (1, 3, 5)]
    return [v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in values]

def luminance(hex_value):
    r,g,b=linear(hex_value)
    return .2126*r+.7152*g+.0722*b

def contrast(a,b):
    x,y=sorted((luminance(a),luminance(b)))
    return (y+.05)/(x+.05)

def oklch(hex_value):
    r,g,b=linear(hex_value)
    l=(.4122214708*r+.5363325363*g+.0514459929*b)**(1/3)
    m=(.2119034982*r+.6806995451*g+.1073969566*b)**(1/3)
    s=(.0883024619*r+.2817188376*g+.6299787005*b)**(1/3)
    L=.2104542553*l+.7936177850*m-.0040720468*s
    a=1.9779984951*l-2.4285922050*m+.4505937099*s
    B=.0259040371*l+.7827717662*m-.8086757660*s
    C=math.hypot(a,B)
    h=math.degrees(math.atan2(B,a))%360 if C>1e-6 else 0
    return {"L":round(L,7),"C":round(C,7),"h":round(h,5)}

pairs=[("Heading","heading","canvas",4.5),("Body","body","surface",4.5),
       ("Supporting text","supporting","surface-raised",4.5),
       ("Primary action default","canvas","orange",4.5),
       ("Primary action hover","canvas","orange-hover",4.5),
       ("Primary action pressed","canvas","orange-pressed",4.5),
       ("Link default and underline","orange","surface",4.5),
       ("Link hover","orange-hover","surface",4.5),
       ("Focus ring against canvas","orange-hover","canvas",3),
       ("Focus ring against raised surface","orange-hover","surface-raised",3),
       ("Essential control border","control-edge","surface-raised",3),
       ("Allow label","allow","surface-raised",4.5),
       ("Repair label","repair","surface-raised",4.5),
       ("Reject label","reject","surface-raised",4.5),
       ("No proof label","no-proof","surface-raised",4.5),
       ("Proof line and label","proof-cyan","surface-raised",4.5),
       ("Paper body","paper-ink","paper",4.5),
       ("Paper secondary","paper-secondary","paper",4.5),
       ("Paper link and focus","paper-orange","paper",4.5)]
checks=[{"role":role,"foreground":fg,"background":bg,"ratio":round(contrast(COLORS[fg],COLORS[bg]),4),"minimum":minimum,"pass":contrast(COLORS[fg],COLORS[bg])>=minimum} for role,fg,bg,minimum in pairs]
assert all(x["pass"] for x in checks)
tokens={key:{"hex":value,"oklch":oklch(value)} for key,value in COLORS.items()}
report={"schemaVersion":"gridninja.color-design.v1","status":"specified-not-applied","colorSpace":"sRGB","tokens":tokens,"contrastChecks":checks,"excludedUse":{"whiteOnOrange":round(contrast("#FFFFFF",COLORS["orange"]),4),"reason":"Fails ordinary and large text contrast; use dark labels."},"limitations":["Computed solid-color pair checks, not a rendered-page accessibility audit.","Essential focus/control geometry and alpha composition require browser verification.","Decorative edges are not substitutes for necessary control boundaries."]}
(ROOT/"color-system.json").write_text(json.dumps(report,indent=2)+"\n")
css=["/* DESIGN CONTRACT ONLY. Not loaded by the website. sRGB fallbacks remain authoritative. */",":root {"]
for key,value in COLORS.items():css.append(f"  --gn-{key}: {value};")
css.append("}\n@supports (color: oklch(50% 0 0)) {\n  :root {")
for key,item in tokens.items():
    c=item["oklch"]
    css.append(f"    --gn-{key}: oklch({c['L']:.7f} {c['C']:.7f} {c['h']:.5f});")
css.append("  }\n}\n")
(ROOT/"color-tokens.example.css").write_text("\n".join(css))
print(f"Validated {len(checks)} foreground/background pairs; {len(tokens)} sRGB and OKLCH tokens generated.")
