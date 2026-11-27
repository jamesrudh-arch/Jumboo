#!/usr/bin/env python3
"""Tests timing against the actual dialogue mix and rejects changed inputs."""
import json
import shutil
import tempfile
import unittest
import wave
from pathlib import Path
from build_call_timeline import AUDIO, RATE, build_timeline


class CallTimelineTests(unittest.TestCase):
    def test_actual_timeline_and_existing_cues_agree(self):
        result = build_timeline(AUDIO)
        events = result['events']
        self.assertEqual([e['speaker'] for e in events], ['marcus', 'brother', 'marcus', 'brother', 'marcus', 'brother', 'marcus'])
        self.assertEqual(events[0]['start_sample'], 0)
        for a, b in zip(events, events[1:]):
            self.assertGreater(a['end_sample'], a['start_sample'])
            self.assertEqual(a['pause_end_sample'], b['start_sample'])
        self.assertEqual(events[-1]['pause_end_sample'], result['mix_samples'])
        cues = json.loads((AUDIO / 'marcus_viseme_candidates.json').read_text())
        self.assertEqual(cues['mix_pcm_sha256'], result['mix_pcm_sha256'])
        self.assertEqual([e['start_sample'] for e in events if e['speaker'] == 'marcus'],
                         [line['mix_start_sample'] for line in cues['lines']])
        self.assertEqual(result['sample_rate_hz'], RATE)

    def test_changed_mix_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            dst = Path(tmp)
            for name in ['first_call_preview.wav', 'marcus_01.wav', 'brother_01.wav', 'marcus_02.wav', 'brother_02.wav', 'marcus_03.wav', 'brother_03.wav', 'marcus_04.wav']:
                shutil.copyfile(AUDIO / name, dst / name)
            path = dst / 'first_call_preview.wav'
            with wave.open(str(path), 'rb') as w:
                params, pcm = w.getparams(), bytearray(w.readframes(w.getnframes()))
            pcm[0] ^= 1
            with wave.open(str(path), 'wb') as w:
                w.setparams(params)
                w.writeframes(pcm)
            with self.assertRaisesRegex(ValueError, 'differ'):
                build_timeline(dst)


if __name__ == '__main__':
    unittest.main()
