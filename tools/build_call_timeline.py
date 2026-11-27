#!/usr/bin/env python3
"""Build a sample-accurate dialogue timeline from the existing approved audio.

This is timing infrastructure, not an animation or runtime call implementation.
Requires Python 3.11/3.12 to match the existing audioop-based mix assembler.
"""
import argparse
import hashlib
import json
import wave
from pathlib import Path
from extract_call_viseme_candidates import AUDIO, LINES, RATE, pcm_at_mix_rate


def build_timeline(audio_dir: Path):
    chunks, events = [], []
    position = 0
    for name, pause, _ in LINES:
        pcm = pcm_at_mix_rate(audio_dir / name)
        length = len(pcm) // 2
        if not length:
            raise ValueError(f'Empty dialogue clip: {name}')
        pause_samples = round(RATE * pause)
        events.append({'speaker': name.split('_')[0], 'file': name,
                       'start_sample': position, 'end_sample': position + length,
                       'pause_end_sample': position + length + pause_samples,
                       'source_sha256': hashlib.sha256((audio_dir / name).read_bytes()).hexdigest()})
        chunks.extend((pcm, b'\0\0' * pause_samples))
        position += length + pause_samples
    mix = b''.join(chunks)
    with wave.open(str(audio_dir / 'first_call_preview.wav'), 'rb') as wav:
        if (wav.getnchannels(), wav.getsampwidth(), wav.getframerate(), wav.getcomptype()) != (1, 2, RATE, 'NONE'):
            raise ValueError('Unexpected mix format')
        actual = wav.readframes(wav.getnframes())
    if actual != mix:
        raise ValueError('Dialogue clips and approved mix differ; refusing to create a timeline')
    return {'status': 'timing data only; no pickup, facial animation or runtime integration',
            'sample_rate_hz': RATE, 'mix_samples': position,
            'mix_pcm_sha256': hashlib.sha256(mix).hexdigest(), 'events': events}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    data = build_timeline(AUDIO)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
