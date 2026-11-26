#!/usr/bin/env python3
"""Inspect the approved Marcus source GLB without altering it."""
import hashlib,json,struct
from pathlib import Path
root=Path(__file__).resolve().parents[1];path=root/'brand/characters/marcus/marcus_approved_source.glb';data=path.read_bytes()
magic,version,total=struct.unpack_from('<4sII',data);assert magic==b'glTF' and version==2 and total==len(data)
length,kind=struct.unpack_from('<I4s',data,12);assert kind==b'JSON';gltf=json.loads(data[20:20+length]);accessors=gltf['accessors']
triangles=sum(accessors[p['indices']]['count']//3 for m in gltf['meshes'] for p in m['primitives'] if 'indices' in p and p.get('mode',4)==4)
assert len(gltf.get('skins',[]))==1
names=[a.get('name') for a in gltf.get('animations',[])];assert set(names)=={'walk','run'}
report={'file':str(path.relative_to(root)),'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'meshes':len(gltf['meshes']),'skins':len(gltf['skins']),'joints':len(gltf['skins'][0]['joints']),'triangles':triangles,'animations':names,'notes':'Container structure only: not rig, visual quality, license, animation-foot-contact, engine or device validation.'}
out=root/'docs/previews/character_research/casual_man_structure.json';out.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
