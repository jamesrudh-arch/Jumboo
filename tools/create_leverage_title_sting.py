#!/usr/bin/env python3
"""Original synthesized title sting; no external sound samples."""
from pathlib import Path
import math, random, struct, wave
rate=48000; duration=4.0; random.seed(13579)
out=Path(__file__).resolve().parents[1]/'brand/leverage/leverage_title_sting.wav'
with wave.open(str(out),'wb') as w:
 w.setnchannels(2);w.setsampwidth(2);w.setframerate(rate);frames=bytearray()
 for i in range(int(rate*duration)):
  t=i/rate
  pulse=.15*math.exp(-5*t)*math.sin(2*math.pi*(55*t-4*t*t))
  scrape=.032*math.exp(-6*t)*random.uniform(-1,1)
  rise=max(0,min(1,(t-.15)/1.25))*max(0,min(1,(3.7-t)/1.2))
  drone=rise*(.045*math.sin(2*math.pi*73.42*t)+.028*math.sin(2*math.pi*110*t+.35)+.018*math.sin(2*math.pi*146.83*t+.6))
  strike=max(0,t-2.2); accent=.06*math.exp(-2.4*strike)*math.sin(2*math.pi*293.66*strike) if t>=2.2 else 0
  fade=max(0,min(1,(duration-t)/.65));v=(pulse+scrape+drone+accent)*fade
  pan=.77+.10*math.sin(t*.75);frames.extend(struct.pack('<hh',int(v*pan*32767),int(v*(1.55-pan)*32767)))
 w.writeframes(frames)
print(out)
