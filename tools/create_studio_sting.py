#!/usr/bin/env python3
"""Original synthesized studio-ident sound. No third-party samples."""
import math, random, struct, wave
from pathlib import Path
rate=44100
duration=3.6
rng=random.Random(1829)
out=Path(__file__).resolve().parents[1]/'brand/studio/dyoungs_studio_sting.wav'
with wave.open(str(out),'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(rate)
    frames=bytearray()
    for i in range(int(rate*duration)):
        t=i/rate
        impact=math.exp(-9*t)*(0.26*math.sin(2*math.pi*61*t)+0.07*rng.uniform(-1,1))
        body=sum(amp*math.sin(2*math.pi*freq*t+phase)*math.exp(-1.5*t) for freq,amp,phase in [(164.81,.08,0),(246.94,.045,.8),(329.63,.025,1.4)])
        rise=max(0,min(1,(t-.18)/.6))*max(0,1-t/2.6)
        shimmer=.028*rise*math.sin(2*math.pi*(630*t+105*t*t))
        tail=max(0,1-max(0,t-2.5)/1.1)
        v=max(-0.85,min(0.85,(impact+body+shimmer)*tail))
        pan=0.78+0.16*math.sin(t*.9)
        frames.extend(struct.pack('<hh',int(v*pan*32767),int(v*(1.55-pan)*32767)))
    w.writeframes(frames)
print(out)
