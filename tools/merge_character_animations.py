"""Combine matching Quaternius skeleton/animation GLBs; see game/assets/characters/README.md."""
import copy, json, struct
from pathlib import Path
D=Path('game/assets/characters')
def read(path):
 b=path.read_bytes(); n=struct.unpack_from('<I',b,12)[0]; j=json.loads(b[20:20+n]); p=20+n; sz,kind=struct.unpack_from('<II',b,p); assert kind==0x004e4942; return j,b[p+8:p+8+sz]
def save(path,j,b):
 raw=json.dumps(j,separators=(',',':')).encode(); raw+=b' '*((-len(raw))%4); b+=b'\0'*((-len(b))%4)
 path.write_bytes(struct.pack('<4sII',b'glTF',2,12+8+len(raw)+8+len(b))+struct.pack('<I4s',len(raw),b'JSON')+raw+struct.pack('<I4s',len(b),b'BIN\0')+b)
a,ab=read(D/'anims.glb')
for part in ['body_m','outfit_m']:
 j,b=read(D/(part+'.glb')); assert [x.get('name') for x in j['nodes'][:65]]==[x.get('name') for x in a['nodes'][:65]]
 off=(len(b)+3)&~3; b+=b'\0'*(off-len(b)); viewbase=len(j['bufferViews']); accbase=len(j['accessors'])
 for v in a['bufferViews']:
  v=copy.deepcopy(v); v['byteOffset']=v.get('byteOffset',0)+off; j['bufferViews'].append(v)
 for acc in a['accessors']:
  acc=copy.deepcopy(acc); acc['bufferView']+=viewbase; j['accessors'].append(acc)
 j['animations']=copy.deepcopy(a['animations'])
 for anim in j['animations']:
  for s in anim['samplers']: s['input']+=accbase; s['output']+=accbase
 j['buffers'][0]['byteLength']=off+len(ab); save(D/(part+'_animated.glb'),j,b+ab)
