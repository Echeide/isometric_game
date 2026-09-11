"""Original pixel furniture. Only writes the additional object PNGs/catalog entries."""
from pathlib import Path
import json
# Reuse the raster primitives without executing the starter atlas generator.
source=Path(__file__).with_name('build-pixelart.py').read_text()
exec(source[:source.index('# Fixed foot anchor')])

def block(c,x,y,w,d,h,z,colors,origin):
 ox,oy=origin;px=ox+(x-y)*32;py=oy+(x+y)*16-z;a=w*32;b=d*32
 c.poly([(px,py),(px+a,py+a/2),(px+a-b,py+(a+b)/2),(px-b,py+b/2)],colors[0])
 c.poly([(px-b,py+b/2),(px+a-b,py+(a+b)/2),(px+a-b,py+(a+b)/2+h),(px-b,py+b/2+h)],colors[1])
 c.poly([(px+a,py+a/2),(px+a-b,py+(a+b)/2),(px+a-b,py+(a+b)/2+h),(px+a,py+a/2+h)],colors[2])
wood=('d1a36c','ae7950','815638');metal=('79928a','48685c','304e46');green=('83a184','5f846c','3b6254')
entries={}
def start(w,h,origin):return Canvas(w,h),origin
def save(name,c,origin):
 c.save(OUT/f'{name}.png');entries[f'pixel.{name}']={'image':f'/pixelart/{name}.png','width':c.w,'height':c.h,'origin':list(origin)}
# Shared meeting table, 2 x 1.
c,o=start(128,112,(32,64))
for x,y in [(.08,.08),(1.82,.08),(.08,.83),(1.82,.83)]:block(c,x,y,.1,.1,25,25,metal,o)
block(c,0,0,2,1,5,30,wood,o)
block(c,.55,.25,.55,.4,2,32,('e7dfbb','b8b398','8e947a'),o)
block(c,1.4,.25,.16,.16,7,37,('f0dbaa','cda777','9d7554'),o)
save('table',c,o)
# Sofa with distinct seat cushions, 1 x 3.
c,o=start(144,128,(100,48))
for x,y in [(.12,.12),(.75,.12),(.12,2.75),(.75,2.75)]:block(c,x,y,.1,.1,9,9,wood,o)
block(c,0,0,1,3,15,22,green,o)
block(c,0,0,.23,3,29,43,green,o)
for y in [.28,1.1,1.92]:block(c,.26,y,.69,.78,5,26,('9db38d','719174','4f765e'),o)
block(c,0,0,1,.23,15,35,green,o);block(c,0,2.77,1,.23,15,35,green,o)
save('sofa',c,o)
# Potted plant, 1 x 1.
c,o=start(64,96,(32,64))
block(c,.23,.23,.54,.54,17,17,('e5d3ad','c0a17d','947954'),o)
block(c,.29,.29,.42,.42,2,18,('584b36','584b36','584b36'),o)
c.rect(31,29,3,39,'476449')
for x,y,side in [(31,34,-1),(33,42,1),(31,50,-1),(33,57,1),(32,29,1)]:
 pts=[(x,y+5),(x+side*13,y+1),(x+side*15,y-5),(x+side*7,y-6),(x,y)]
 c.poly(pts,'78994e');c.poly([(x,y+3),(x+side*12,y),(x+side*7,y-4),(x,y)],'a1b768')
save('plant',c,o)
# Planning board, 3 x 1. Paper notes follow the board's projected plane.
c,o=start(128,160,(24,112))
for x in [.15,2.7]:block(c,x,.37,.1,.13,55,55,metal,o)
block(c,0,.3,2.9,.12,43,83,('9cae93','e4ddbf','526d5d'),o)
for col in range(3):
 for row in range(2):
  block(c,.25+col*.86,.44,.55,.025,10,74-row*16,('eee7cf',['86b1b5','d9b869','9aae6b'][col],'6c826c'),o)
save('board',c,o)
# Flags retain a separate completed-state texture.
for completed in [False,True]:
 c,o=start(80,128,(32,80));block(c,0,0,1,1,7,3,('99b26b' if completed else 'c8bf98','89946c','5e7655'),o)
 c.rect(31,24,3,68,'3e5b4d');c.rect(31,24,1,66,'8a9c72')
 c.poly([(34,24),(61,32),(57,40),(34,44)],'a9c766' if completed else 'd7a052')
 c.poly([(35,25),(60,32),(35,35)],'ccdd89' if completed else 'f0c777')
 if completed:
  for x,y in [(39,33),(41,35),(43,37),(45,35),(47,33),(49,31)]:c.rect(x,y,3,3,'3d6544')
 save('goal-completed' if completed else 'goal',c,o)
# Attached office chair, 1 x 1; stored as an auxiliary sprite, not a map entity.
c,o=start(64,96,(32,48))
block(c,.44,.44,.12,.12,15,15,metal,o)
block(c,.1,.42,.8,.12,3,3,metal,o);block(c,.42,.1,.12,.8,3,3,metal,o)
block(c,.15,.15,.7,.7,6,19,green,o);block(c,.15,.15,.65,.1,19,37,green,o)
save('chair',c,o)
p=OUT/'catalog.json';pack=json.loads(p.read_text());pack['objects'].update(entries);p.write_text(json.dumps(pack,indent=2)+'\n')
print('Wrote table, sofa, plant, board, flag variants and chair.')
