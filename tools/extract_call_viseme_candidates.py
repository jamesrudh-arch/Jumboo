#!/usr/bin/env python3
"""Generate unreviewed Rhubarb mouth cues for Marcus's approved call audio.

This is an offline research artifact, not a face rig or a finished lip-sync.
The binary is supplied by the operator and is never downloaded by this script.
"""
import argparse
import audioop
import hashlib
import json
import subprocess
import tempfile
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUDIO = ROOT / 'brand/intro/call_audio'
RATE = 44100
LINES = [
    ('marcus_01.wav', 0.35, 'Hey. You all right?'),
    ('brother_01.wav', 0.25, None),
    ('marcus_02.wav', 0.2, 'Where are you?'),
    ('brother_02.wav', 0.3, None),
    ('marcus_03.wav', 0.2, "What? Tell me what you can see. I'll come get you."),
    ('brother_03.wav', 0.4, None),
    ('marcus_04.wav', 0, 'No, wait. Stay on the line. Hello?'),
]


def pcm_at_mix_rate(path):
    with wave.open(str(path), 'rb') as w:
        if (w.getnchannels(), w.getsampwidth(), w.getcomptype()) != (1, 2, 'NONE'):
            raise ValueError(f'Expected mono 16-bit PCM: {path}')
        raw = w.readframes(w.getnframes())
        if w.getframerate() != RATE:
            raw, _ = audioop.ratecv(raw, 2, 1, w.getframerate(), RATE, None)
        return raw


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--rhubarb', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    binary = args.rhubarb.resolve(strict=True)
    binary_hash = hashlib.sha256(binary.read_bytes()).hexdigest()
    expected = '03e82c9c76c4e691a058f38a9cf7e75331e2f3c31a9c1fab90c00944b3ef7dc2'
    if binary_hash != expected:
        raise ValueError('Unexpected binary hash; check provenance before running extraction')
    version = subprocess.run([str(binary), '--version'], capture_output=True, text=True, check=True).stdout.strip()
    if 'Rhubarb Lip Sync version 1.13.0' not in version:
        raise ValueError('Expected Rhubarb 1.13.0; investigate other versions before using them')
    chunks = []
    offset_samples = 0
    lines = []
    with tempfile.TemporaryDirectory(prefix='leverage-viseme-') as tmp:
        tmp = Path(tmp)
        for name, pause, transcript in LINES:
            pcm = pcm_at_mix_rate(AUDIO / name)
            start = offset_samples / RATE
            length = len(pcm) // 2
            chunks.append(pcm)
            if transcript is not None:
                textfile = tmp / 'dialog.txt'
                textfile.write_text(transcript, encoding='utf-8')
                output = tmp / 'cues.json'
                subprocess.run([str(binary), '-q', '--threads', '1', '-f', 'json', '-d', str(textfile), '-o', str(output), str(AUDIO / name)], check=True)
                result = json.loads(output.read_text(encoding='utf-8'))
                cues = result['mouthCues']
                previous = 0.0
                for cue in cues:
                    a, b = cue['start'], cue['end']
                    if cue['value'] not in 'ABCDEFGHX' or a < previous - 0.011 or b <= a or b > length / RATE + 0.02:
                        raise ValueError(f'Invalid cue in {name}: {cue}')
                    previous = b
                lines.append({'file': name, 'mix_start_sample': offset_samples, 'duration_samples': length, 'text': transcript, 'mouth_cues_local_seconds': cues})
            silence = b'\0\0' * round(RATE * pause)
            chunks.append(silence)
            offset_samples += length + len(silence) // 2
    mix = b''.join(chunks)
    with wave.open(str(AUDIO / 'first_call_preview.wav'), 'rb') as w:
        if (w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getcomptype()) != (1, 2, RATE, 'NONE'):
            raise ValueError('Unexpected assembled audio format')
        if w.readframes(w.getnframes()) != mix:
            raise ValueError('Assembled audio differs; refusing to publish misaligned cues')
    result = {'status': 'unreviewed research only; not phoneme-accurate or production lip sync',
              'engine': version, 'binary_sha256': binary_hash, 'recognizer': 'pocketSphinx with dialogue text',
              'mix_rate_hz': RATE, 'mix_pcm_sha256': hashlib.sha256(mix).hexdigest(),
              'mix_samples': offset_samples, 'lines': lines}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
