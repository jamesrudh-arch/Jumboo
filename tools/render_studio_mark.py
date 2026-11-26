#!/usr/bin/env python3
"""Render the studio vector study in colour and monochrome; not game output."""
from pathlib import Path
from io import BytesIO
import re
import resvg_py
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1]
svg = (root / 'brand/studio/dy_symbol.svg').read_text()
font = root / 'game/assets/fonts/Inter-Variable.ttf'
canvas = Image.new('RGB', (1600, 1120), '#10171b')
d = ImageDraw.Draw(canvas)
def f(size): return ImageFont.truetype(str(font), size)
def label(x, y, text, size=20, color='#afc0be'):
    d.text((x,y), text, font=f(size), fill=color)
def mark(size, frame, ycolor):
    variant = svg.replace('#67767A', frame).replace('#D6B989', ycolor)
    return Image.open(BytesIO(resvg_py.svg_to_bytes(svg_string=variant, width=size, height=size))).convert('RGBA')
def place(x,y,size,frame,ycolor): canvas.paste(mark(size,frame,ycolor), (x,y), mark(size,frame,ycolor))
label(65, 35, 'D’YOUNGS GAMES  /  STUDIO IDENTITY', 25, '#d9e3df')
label(65, 80, 'VECTOR STUDY 01   •   NOT AN IN-GAME SCREENSHOT', 18)
d.line((65,120,1535,120),fill='#41575a',width=2)
# Primary lockup, with deliberate separation from the symbol.
d.rounded_rectangle((65,150,1010,800), radius=8, fill='#182126', outline='#34494a',width=2)
label(98,175,'01  /  PRIMARY COLOUR',18)
place(306,205,450,'#8C9C9C','#D6B989')
name='D’YOUNGS GAMES'
box=d.textbbox((0,0),name,font=f(48)); text_width=box[2]-box[0]
d.text((538-text_width/2,665),name,font=f(48),fill='#e8e5db')
label(287,735,'WORDMARK TYPE IS A TEMPORARY SPECIMEN',15)
# Dark and light monochrome applications.
d.rounded_rectangle((1040,150,1535,465),radius=8,fill='#202a2d',outline='#34494a',width=2)
label(1065,173,'02  /  LIGHT MONOCHROME',18)
place(1185,218,210,'#E9EBE5','#E9EBE5')
d.rounded_rectangle((1040,485,1535,800),radius=8,fill='#E7E4DA')
label(1065,508,'03  /  DARK MONOCHROME',18,'#37474a')
place(1185,553,210,'#20282A','#20282A')
label(65,850,'04  /  SMALL-SIZE CHECK',20)
for x,size in [(70,120),(235,80),(360,48),(455,32)]:
    place(x,900,size,'#dbe4df','#dbe4df')
    label(x,1030,f'{size} px',16)
label(690,865,'SEPARATE VECTOR PATHS  •  TRANSPARENT GAPS',20,'#d9e3df')
label(690,910,'The monogram is the first identity component.',21,'#d9e3df')
label(690,946,'Lettering, 3D motion and sound are not yet finished.',20)
label(690,982,'Trademark and real-device legibility checks remain open.',20)
canvas.save(root / 'docs/previews/studio_mark_vector_study.png')
