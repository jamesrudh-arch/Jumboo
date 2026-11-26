#!/usr/bin/env python3
"""Concept ident: vector paths composited as a faux-metal 2D render, not 3D."""
from pathlib import Path
from io import BytesIO
import re
import math
import resvg_py
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

root = Path(__file__).resolve().parents[1]
svg = (root/'brand/studio/dy_symbol.svg').read_text()
paths = re.findall(r'<path[^>]+/>', svg)
size=600

def mask(path):
    path = re.sub(r'fill="#[0-9A-Fa-f]+"', 'fill="#ffffff"', path)
    data=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480">{path}</svg>'
    return Image.open(BytesIO(resvg_py.svg_to_bytes(svg_string=data,width=size,height=size))).convert('RGBA').getchannel('A')
dmask, ymask = map(mask, paths)
font = root/'game/assets/fonts/Inter-Variable.ttf'
def tracked(draw, xy, text, font, spacing, color):
    widths=[draw.textlength(c,font=font) for c in text]
    x=xy[0]-(sum(widths)+spacing*(len(text)-1))/2
    for c,w in zip(text,widths):
        draw.text((x,xy[1]),c,font=font,fill=color)
        x+=w+spacing

def layer_metal(bg, m, xy, dark, light, phase):
    x,y=xy
    # Extruded depth as staggered silhouettes. This is a 2D visual effect.
    for off in range(14,0,-1):
        layer=Image.new('RGBA',(size,size),(*dark,255))
        bg.paste(layer,(x+off//3,y+off),m)
    grad=Image.new('RGBA',(size,size)); pix=grad.load()
    for xx in range(size):
        flare=math.exp(-((xx/size-phase)/0.12)**2)*0.33
        for yy in range(size):
            t=max(0,min(1,0.25+0.28*(1-yy/size)+0.15*(1-xx/size)+flare))
            pix[xx,yy]=tuple(round(dark[i]*(1-t)+light[i]*t) for i in range(3))+(255,)
    bg.paste(grad,(x,y),m)
    edge=ImageChops.subtract(m,m.filter(ImageFilter.MinFilter(5)))
    hi=Image.new('RGBA',(size,size),(*light,255))
    bg.paste(hi,(x,y),edge.point(lambda a: int(a*0.64)))

def render(phase=0.55):
    w,h=1600,1000
    bg=Image.new('RGBA',(w,h),(8,12,15,255))
    glow=Image.new('RGBA',(w,h)); gd=ImageDraw.Draw(glow)
    gd.ellipse((460,150,1140,790),fill=(121,82,40,55))
    glow=glow.filter(ImageFilter.GaussianBlur(95)); bg=Image.alpha_composite(bg,glow)
    layer_metal(bg,dmask,(500,130),(25,34,37),(183,197,190),phase)
    layer_metal(bg,ymask,(500,130),(80,55,34),(244,212,160),phase)
    draw=ImageDraw.Draw(bg)
    tracked(draw,(800,750),'D’YOUNGS GAMES',ImageFont.truetype(str(font),49),7,(226,220,204,255))
    draw.line((510,834,1090,834),fill=(126,104,75,110),width=2)
    tracked(draw,(800,856),'STUDIO IDENTITY  /  CONCEPT PRESENTATION',ImageFont.truetype(str(font),15),2,(144,154,149,255))
    return bg.convert('RGB')

# Actual presentation still, and a timed moving-light concept in GIF format.
render().save(root/'docs/previews/dyoungs_studio_logo_presentation.png')
frames=[]
for i in range(30):
    im=render(-0.25+i*0.05).resize((800,500),Image.Resampling.LANCZOS)
    # Slow reveal, hold, then fade to black. No audio is implied.
    opacity=min(1.0,(i+1)/7,(30-i)/6)
    frames.append(Image.blend(Image.new('RGB',im.size,(8,12,15)),im,opacity))
frames[0].save(root/'docs/previews/dyoungs_studio_ident_concept.gif',save_all=True,append_images=frames[1:],duration=100,loop=0,optimize=True)
