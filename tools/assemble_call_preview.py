#!/usr/bin/env python3
"""Assemble the unapproved dialogue audition; no music or phone effects."""
import audioop
import wave
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; D=ROOT/'brand/intro/call_audio'; RATE=44100
lines=[('marcus_01.wav',.35),('brother_01.wav',.25),('marcus_02.wav',.2),('brother_02.wav',.3),('marcus_03.wav',.2),('brother_03.wav',.4),('marcus_04.wav',0)]
with wave.open(str(D/'first_call_preview.wav'),'wb') as out:
 out.setnchannels(1);out.setsampwidth(2);out.setframerate(RATE)
 for name,pause in lines:
  with wave.open(str(D/name),'rb') as f:
   assert f.getnchannels()==1 and f.getsampwidth()==2 and f.getcomptype()=='NONE'
   data=f.readframes(f.getnframes())
   if f.getframerate()!=RATE:data,_=audioop.ratecv(data,2,1,f.getframerate(),RATE,None)
   out.writeframes(data);out.writeframes(b'\0\0'*round(RATE*pause))
print('Wrote',D/'first_call_preview.wav')
