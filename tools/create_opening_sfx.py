"""Create small original, synthetic sound cues for the prototype opening.

Requires Python 3 stdlib only. Output is 16-bit mono PCM, 44.1 kHz.
These are designed sounds, not recordings of real vehicles or foley.
"""
import math, random, struct, wave
from pathlib import Path

RATE = 44100
OUT = Path(__file__).resolve().parents[1] / 'game/assets/audio'
OUT.mkdir(parents=True, exist_ok=True)

def write(name, duration, fn):
    samples = bytearray()
    random.seed(8613)
    for i in range(int(duration * RATE)):
        t = i / RATE
        y = max(-0.96, min(0.96, fn(t, duration, random)))
        samples.extend(struct.pack('<h', round(y * 32767)))
    with wave.open(str(OUT / name), 'wb') as wav:
        wav.setparams((1, 2, RATE, 0, 'NONE', 'not compressed'))
        wav.writeframes(samples)

def engine(t, duration, rng):
    # Downward engine-like harmonic and short metallic rattle fading out.
    u = t / duration
    phase = 2 * math.pi * (70*t - 22*t*t/duration)
    fade = min(1, t*8) * (1-u)**1.4
    return fade * (0.26*math.sin(phase) + 0.12*math.sin(phase*2.0) + 0.04*(rng.random()*2-1))

def scrape(t, duration, rng):
    u = t / duration
    env = min(1, t*18) * (1-u)**1.8
    return env * (0.12 * (rng.random()*2-1) + 0.16 * math.sin(2*math.pi*(680*t + 190*t*t)))

def disconnect(t, duration, rng):
    # A brief digital disconnect, followed by silence, rather than an endless tone.
    return (0.12*math.sin(2*math.pi*620*t) + 0.12*math.sin(2*math.pi*480*t)) * min(1,t*50) * max(0,1-t/duration)

def pickup(t, duration, rng):
    return 0.22 * (rng.random()*2-1) * math.exp(-t*26) + 0.10 * math.sin(2*math.pi*290*t) * math.exp(-t*20)

def call_lost(t, duration, rng):
    sound = scrape(t, 0.9, rng) if t < 0.9 else 0.0
    if 0.60 <= t < 1.05:
        sound += disconnect(t - 0.60, 0.45, rng)
    return sound

write('engine_cut.wav', 1.4, engine)
write('call_lost.wav', 1.05, call_lost)
write('phone_pickup.wav', 0.24, pickup)
