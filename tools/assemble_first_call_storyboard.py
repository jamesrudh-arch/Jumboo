#!/usr/bin/env python3
"""Assemble an offline timing storyboard from previously approved studies.

Requires imageio-ffmpeg. This is not an animated call or game scene: the handoff
is an editorial cut and the last pose is held while dialogue plays.
"""
from pathlib import Path
import subprocess
import wave
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parents[1]
ring = ROOT/'docs/previews/intro/incoming_call_motion.mp4'
body = ROOT/'docs/previews/intro/phone_at_ear_motion.gif'
voice = ROOT/'brand/intro/call_audio/first_call_preview.wav'
out = ROOT/'docs/previews/intro/first_call_storyboard.mp4'
with wave.open(str(voice), 'rb') as wav:
    voice_seconds = wav.getnframes()/wav.getframerate()
# Input studies: 3 seconds of ringtone and 61 GIF frames at 80ms each.
# The dialogue starts after the ear-motion study has finished.
start_ms = 7880
filters = (
    '[0:v]fps=25,scale=768:432:force_original_aspect_ratio=decrease,'
    'pad=768:432:(ow-iw)/2:(oh-ih)/2:black,setsar=1,format=yuv420p,setpts=PTS-STARTPTS[v0];'
    f'[1:v]fps=25,scale=432:432,pad=768:432:(ow-iw)/2:0:black,setsar=1,format=yuv420p,'
    f'tpad=stop_mode=clone:stop_duration={voice_seconds:.4f},setpts=PTS-STARTPTS[v1];'
    '[v0][v1]concat=n=2:v=1:a=0[video];'
    f'[2:a]adelay={start_ms}:all=1[dialogue];'
    '[0:a][dialogue]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[audio]'
)
subprocess.run([
    imageio_ffmpeg.get_ffmpeg_exe(), '-hide_banner', '-y', '-i', str(ring),
    '-ignore_loop', '1', '-i', str(body), '-i', str(voice),
    '-filter_complex', filters, '-map', '[video]', '-map', '[audio]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-shortest', str(out)
], check=True)
print(f'Wrote {out}; static hold is a storyboard, not facial animation.')
