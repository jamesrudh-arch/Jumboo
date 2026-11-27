#!/usr/bin/env python3
"""Assemble existing studies after the owner chose to proceed provisionally.

This editorial cut is not a continuous scene or a production cinematic. It
retains the known-imperfect pickup and uses the earlier reaction render.
Requires imageio-ffmpeg; never overwrites the approved timing storyboard.
"""
from pathlib import Path
import subprocess
import wave
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parents[1]
PREVIEW = ROOT / 'docs/previews/intro'
ring = PREVIEW / 'incoming_call_motion.mp4'
pickup = PREVIEW / 'table_pickup_contact_study.mp4'
reaction = PREVIEW / 'call_reaction_study.mp4'
voice = ROOT / 'brand/intro/call_audio/first_call_preview.wav'
out = PREVIEW / 'provisional_call_assembly.mp4'
with wave.open(str(voice), 'rb') as f:
    duration = f.getnframes() / f.getframerate()
# Source clips are independently rendered at 12, 12 and 8 fps. Cuts rather
# than a simulated blend preserve the sampled animation, with no claim of
# spatial or grip continuity across the separate scenes.
normalize = ('fps=24,scale=768:432:force_original_aspect_ratio=decrease,'
             'pad=768:432:(ow-iw)/2:(oh-ih)/2:black,setsar=1,format=yuv420p')
filters = (
    f'[0:v]trim=duration=3,{normalize},setpts=PTS-STARTPTS[v0];'
    f'[1:v]trim=duration=3.75,{normalize},setpts=PTS-STARTPTS[v1];'
    f'[2:v]trim=duration={duration:.9f},{normalize},setpts=PTS-STARTPTS[v2];'
    '[v0][v1][v2]concat=n=3:v=1:a=0[v];'
    '[0:a]atrim=duration=3,asetpts=PTS-STARTPTS[ring];'
    '[3:a]adelay=6750:all=1[voice];'
    '[ring][voice]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[a]'
)
subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-hide_banner', '-y',
                '-i', str(ring), '-i', str(pickup), '-i', str(reaction),
                '-i', str(voice), '-filter_complex', filters,
                '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-crf', '20',
                '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k',
                '-movflags', '+faststart', '-shortest', str(out)], check=True)
print('Wrote provisional assembly:', out)
