#!/usr/bin/env python3
"""Rebuild the synthesized ringing from the approved incoming-call study."""
import math
import struct
import wave
from pathlib import Path

OUTPUT = Path(__file__).resolve().parents[1] / 'game/assets/intro/incoming_ring.wav'
RATE = 44100
with wave.open(str(OUTPUT), 'wb') as wav:
    wav.setnchannels(1)
    wav.setsampwidth(2)
    wav.setframerate(RATE)
    data = bytearray()
    for i in range(RATE * 3):
        t = i / RATE
        local = t if t < .75 else t - 1.55
        active = (0 <= t < .75) or (1.55 <= t < 2.3)
        sample = 0
        if active:
            fade = max(0, min(1, local / .04, (.75 - local) / .05))
            sample = fade * (.16 * math.sin(2 * math.pi * 620 * t)
                + .12 * math.sin(2 * math.pi * 820 * t)
                + .035 * math.sin(2 * math.pi * 118 * t) * (.5 + .5 * math.sin(2 * math.pi * 21 * t)))
        data.extend(struct.pack('<h', int(max(-1, min(1, sample)) * 32767)))
    wav.writeframes(data)
print('Wrote', OUTPUT)
