"""Deterministic seamless pixel terrain. Adds tiles without rewriting existing artwork."""
from pathlib import Path
import argparse, json, math
source=Path(__file__).with_name('build-pixelart.py').read_text()
exec(source[:source.index('# Fixed foot anchor')])

def noise(x,y):return ((x*374761393+y*668265263)^((x+31)*(y+17)*1274126177))&255

def color(kind,u,v):
 x,y=int(u*64),int(v*64);n=noise(x,y)
 if kind=='parquet':
  row=y//8; t=(x+(row%2)*32)%64
  if y%8==0 or t==0:return '805b3d'
  return ['b58b5a','bd9566','c7a073','af8453'][(row+(x+(row%2)*32)//64)%4] if n%9 else 'd0ae7d'
 if kind=='asphalt':return ['50565a','575d60','60666a','494f53'][n%4]
 if kind=='sidewalk':
  # Concrete slabs: narrow grout, a bevel and restrained clusters of grain.
  xx,yy=x%32,y%32
  if xx==0 or yy==0:return '969b91'
  if xx==1 or yy==1:return 'd9dccf'
  if xx==31 or yy==31:return 'b0b6ab'
  slab=(x//32+y//32)%2
  if noise(x//3,y//3)%13==0:return 'bdc3b7'
  return ['c9cdbf','c4cabb'][slab]
 if kind=='cobble':
  row=y//16; xx=(x+(row%2)*8)%16; yy=y%16
  if ((xx-7.5)/7)**2+((yy-7.5)/7)**2>1:return '85877b'
  return ['b0ac99','c2baa6','a3a691','b7b29e'][(x//16+row)%4]
 if kind=='sand':return ['d8c18e','dfc996','e5d2a3','ceb881'][n%4]
 if kind=='dirt':return ['a88a64','b2956e','9c7e58','b69b75'][n%4]

kinds=['parquet','asphalt','sidewalk','cobble','sand','dirt']
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--only',choices=kinds,help='Regenerate one material without changing the others.')
args=parser.parse_args()
catalog_path=OUT/'catalog.json';catalog=json.loads(catalog_path.read_text())
for kind in [args.only] if args.only else kinds:
 c=Canvas(64,32)
 for y in range(32):
  for x in range(64):
   u=(x+.5-32)/64+(y+.5)/32;v=(y+.5)/32-(x+.5-32)/64
   if 0<=u<1 and 0<=v<1:c.pixel(x,y,color(kind,u,v))
 c.save(OUT/f'{kind}.png');catalog['tiles'][kind]=f'/pixelart/{kind}.png'
catalog_path.write_text(json.dumps(catalog,indent=2)+'\n')
