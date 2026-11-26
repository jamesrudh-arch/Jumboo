#!/usr/bin/env python3
"""Reproducible editorial specimen; not an in-engine screenshot."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
FONTS = ROOT / 'game/assets/fonts'
OUT = ROOT / 'docs/previews/brand_typography_colour_specimen.png'
img = Image.new('RGB', (1600, 1260), '#10171d')
d = ImageDraw.Draw(img)
def font(name, size):
    return ImageFont.truetype(str(FONTS / name), size)
inter=lambda n:font('Inter-Variable.ttf',n)
oswald=lambda n:font('Oswald.ttf',n)
bebas=lambda n:font('BebasNeue-Regular.ttf',n)
def text(x,y,s,f,fill='#e8eeeb',**kw): d.text((x,y),s,font=f,fill=fill,**kw)
def contrast(a,b):
    def lum(c):
        rgb=[int(c[i:i+2],16)/255 for i in (1,3,5)]
        return sum(w*(v/12.92 if v<=0.04045 else ((v+0.055)/1.055)**2.4) for v,w in zip(rgb,(.2126,.7152,.0722)))
    x,y=sorted((lum(a),lum(b)),reverse=True)
    return (x+.05)/(y+.05)
text(64,35,'LEVERAGE / DESIGN SYSTEM',inter(24),'#b7cecb')
text(64,75,'TYPE & COLOUR',bebas(76))
text(65,165,'EDITORIAL SPECIMEN  /  PROPOSED  /  NOT A GAME SCREENSHOT',inter(18),'#a8c2bf')
d.line((64,210,1536,210),fill='#465e61',width=2)
text(64,235,'01   DISPLAY',inter(20),'#9dbab6')
text(64,270,'LEVERAGE',bebas(126),'#f0ede5')
text(69,415,'C I N D E R   C I T Y',oswald(38),'#c8a476')
text(67,487,'Bebas Neue / provisional display     •     Oswald / secondary display',inter(20),'#bcccca')
text(64,550,'02   INTERFACE & DIALOGUE',inter(20),'#9dbab6')
d.rounded_rectangle((64,590,940,865),radius=8,fill='#19262d',outline='#547275',width=2)
text(90,612,'OBJECTIVE  /  THE WITNESS',inter(22),'#e0b77e')
text(90,657,'Find Sade at the market stall',inter(31),'#f0ede5')
text(90,718,'MARCUS: Eli, what happened?',inter(28),'#f0ede5')
text(90,778,'X  INTERACT     •     142 m     •     23:47',inter(21),'#bdd0ce')
text(64,888,'Inter Variable / interface, subtitles and numerals. Test on device at actual size.',inter(19),'#bcccca')
text(1005,235,'03   PALETTE',inter(20),'#9dbab6')
palette=[('INK','#10171D','base / shadow'),('PAPER','#F0EDE5','primary type'),('TIDAL','#8EBAB6','information'),('AMBER','#E0B77E','objective / warmth'),('SIGNAL','#E88771','warning + symbol')]
for i,(name,color,role) in enumerate(palette):
    y=280+i*104
    d.rounded_rectangle((1005,y,1087,y+72),radius=5,fill=color,outline='#6d7b79',width=2)
    text(1107,y,name+'  '+color,inter(19))
    text(1107,y+33,role,inter(17),'#b8c9c7')
text(1005,800,'SOLID INK CONTRAST',inter(19),'#9dbab6')
for i,(name,color,_) in enumerate(palette[1:]):
    text(1005,835+i*30,f'{name:8}  {contrast(color,"#10171D"):.2f}:1',inter(19),color)
d.line((64,967,1536,967),fill='#465e61',width=2)
text(64,995,'04   APPLICATIONS',inter(20),'#9dbab6')
text(64,1035,'NEW GAME    CONTINUE    SETTINGS',oswald(30))
text(64,1090,'MISSION 01  /  THE CALL',bebas(40),'#e0b77e')
text(64,1151,'Incoming call  •  Eli     |     Dock Warehouse 9     |     04 / 11',inter(23))
text(64,1210,'Prototype typography and swatches • Fixed colour pairs only; no claim of in-game accessibility compliance.',inter(16),'#9dbab6')
img.save(OUT)
print(OUT)
