"""Generate the base prop library without modifying existing sprites."""
from pathlib import Path
source=Path(__file__).with_name('build-pixel-objects.py').read_text()
exec(source[:source.index('# Shared meeting table')])
stone=('a5ad9b','87927f','667560')
# Office storage: cabinet and bookshelf, each 1 x 1.
for name in ['cabinet','bookshelf']:
 c,o=start(80,128,(40,88));block(c,.05,.05,.9,.9,65,65,wood if name=='bookshelf' else metal,o)
 for z in [12,30,48]:
  if name=='cabinet':
   block(c,.1,.96,.8,.025,15,z+15,('b7c6ba','96aa9c','52695f'),o)
   block(c,.42,.99,.2,.035,2,z+9,metal,o)
  else:
   block(c,.1,.82,.8,.2,3,z,wood,o)
   for i in range(5):block(c,.12+i*.15,.85,.1,.12,10+i%3*3,z+13,(['c78d62','87a5a2','b8b781'][i%3],'657e70','485e50'),o)
 save(name,c,o)
# Office printer, 1 x 1.
c,o=start(80,104,(40,68));block(c,.12,.12,.76,.76,22,22,('e0e4d9','aab8ae','758b80'),o);block(c,.2,.22,.6,.25,3,25,metal,o);block(c,.3,.16,.4,.4,2,28,('f7f0dd','d4d6c4','a4b3a3'),o);save('printer',c,o)
# Park bench, 2 x 1.
c,o=start(128,112,(40,64))
for x in [.18,1.7]:block(c,x,.2,.1,.6,19,19,metal,o)
for y in [.15,.4,.65]:block(c,0,y,2,.2,4,23,wood,o)
for z in [34,45]:block(c,0,.05,2,.12,8,z,wood,o)
save('bench',c,o)
# Street furniture.
for name in ['bin','bollard','lamp']:
 c,o=start(80,160,(40,120))
 if name=='bin':
  block(c,.2,.2,.6,.6,32,32,green,o);block(c,.16,.16,.68,.68,4,36,metal,o);block(c,.29,.29,.42,.42,1,37,('263f36','263f36','263f36'),o)
 elif name=='bollard':
  block(c,.25,.25,.5,.5,4,4,stone,o);block(c,.4,.4,.2,.2,30,33,metal,o);block(c,.39,.39,.22,.22,4,30,('dec897','b49c6e','8d805c'),o)
 else:
  block(c,.3,.3,.4,.4,5,5,stone,o);block(c,.46,.46,.08,.08,90,93,metal,o)
  block(c,.2,.2,.6,.6,3,96,metal,o);block(c,.25,.25,.5,.5,14,110,('fff2b1','eed999','c2b482'),o);block(c,.15,.15,.7,.7,4,114,metal,o)
 save(name,c,o)
# Natural props.
for name in ['rock','bush','flowers','pine']:
 c,o=start(96,144,(48,104))
 if name=='rock':
  block(c,.1,.15,.65,.65,14,14,stone,o);block(c,.3,.25,.5,.5,10,23,('bac0ae','98a28d','788770'),o)
 elif name=='pine':
  block(c,.42,.42,.16,.16,25,25,wood,o)
  for z,r in [(25,28),(44,23),(62,17)]:
   c.poly([(48,104-z-30),(48+r,104-z+10),(48,104-z+20),(48-r,104-z+10)],'527b53')
   c.poly([(48,104-z-30),(48,104-z+20),(48-r,104-z+10)],'78985d')
 else:
  for x,y in [(22,117),(39,108),(52,118),(65,112)]:
   c.poly([(x-10,y),(x-12,y-12),(x-4,y-23),(x+8,y-20),(x+14,y-8),(x+9,y+3)],'678a50');c.rect(x-5,y-17,9,6,'92ae64')
   if name=='flowers':
    for dx,dy in [(-5,-15),(7,-7)]:c.rect(x+dx,y+dy,5,5,'dcaab3');c.pixel(x+dx+2,y+dy+2,'f3d87c')
 save(name,c,o)
pack_path=OUT/'catalog.json';pack=json.loads(pack_path.read_text());pack['objects'].update(entries);pack_path.write_text(json.dumps(pack,indent=2)+'\n')
