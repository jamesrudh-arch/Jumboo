# D’YOUNGS GAMES — studio identity

The owner directed the 3D studio identity to be polished and carried forward to the title stage. The previously rejected 2D/faux-depth vector presentation and its generation scripts were removed from the current tree; they remain in Git history. The generated concept selected earlier remains as historical context, not a 3D asset.

- `dyoungs_studio_ident.blend`: editable Blender 4.2 scene with volumetric D/Y mark and Inter-based 3D lettering.
- `dyoungs_studio_mark_3d.glb`: exported geometry and materials, also copied into the prototype opening.
- `dyoungs_studio_sting.wav`: original synthesized sound, also used in the prototype opening.
- `docs/previews/dyoungs_3d_front.png`, `dyoungs_3d_three_quarter.png`, `dyoungs_3d_side.png`, `dyoungs_3d_rear.png`: Blender Cycles renders.
- `docs/previews/dyoungs_studio_3d_motion.gif`: silent 32-frame camera/light study, not the in-game opening.
- `tools/build_studio_ident_3d.py`, `tools/render_studio_ident_3d_motion.py`, `tools/create_studio_sting.py`: sources for the assets. The Blender scripts need bpy 4.2 and system libraries; the motion script also needs Pillow. Font licensing is in `game/assets/fonts/`.

The mark imported structurally in Godot 4.7.2 headless as three mesh instances, approximately 56,708 triangles. The current prototype synchronizes the sting to its real-time opening; neither the visual result, audio mix, frame rate nor Xogot/iPhone behavior have been verified on a device. Trademark clearance and device profiling are open; improve the approved design during production without silently replacing it.
