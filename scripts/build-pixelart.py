"""Deterministic source artwork for the starter atlas. No image dependencies.
Running this overwrites generated starter PNGs; keep hand-edited copies separately.
"""
from pathlib import Path
import math, struct, zlib, json
OUT=Path(__file__).resolve().parents[1]/'static/pixelart'
class Canvas:
 def __init__(self,w,h):self.w=w;self.h=h;self.data=bytearray(w*h*4)
 def pixel(self,x,y,c):
  if 0<=x<self.w and 0<=y<self.h:
   rgb=tuple(bytes.fromhex(c.lstrip('#'))) if isinstance(c,str) else c
   i=(y*self.w+x)*4;self.data[i:i+4]=bytes((*rgb,255) if len(rgb)==3 else rgb)
 def rect(self,x,y,w,h,c):
  for yy in range(round(y),round(y+h)):
   for xx in range(round(x),round(x+w)):self.pixel(xx,yy,c)
 def poly(self,pts,c):
  for y in range(math.floor(min(p[1] for p in pts)),math.ceil(max(p[1] for p in pts))+1):
   xs=[]
   for a,b in zip(pts,pts[1:]+pts[:1]):
    if (a[1]<=y+.5<b[1]) or (b[1]<=y+.5<a[1]):xs.append(a[0]+(y+.5-a[1])*(b[0]-a[0])/(b[1]-a[1]))
   for x1,x2 in zip(sorted(xs)[::2],sorted(xs)[1::2]):
    for x in range(math.ceil(x1-.5),math.ceil(x2-.5)):self.pixel(x,y,c)
 def paste(self,other,x,y):
  for yy in range(other.h):
   for xx in range(other.w):
    i=(yy*other.w+xx)*4
    if other.data[i+3]:self.pixel(x+xx,y+yy,tuple(other.data[i:i+4]))
 def save(self,path):
  def chunk(t,d):return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
  raw=b''.join(b'\0'+bytes(self.data[y*self.w*4:(y+1)*self.w*4]) for y in range(self.h))
  Path(path).write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',self.w,self.h,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(raw))+chunk(b'IEND',b''))
# Fixed foot anchor: (32,80) in every 64x96 frame.
poses=['idle','walk','sit','work','talk','celebrate'];facings=['ne','se','sw','nw']
counts={'idle':4,'walk':8,'sit':4,'work':4,'talk':4,'celebrate':6}
FPS={'idle':3,'walk':10,'sit':8,'work':8,'talk':5,'celebrate':8}
for name,shirt,light,dark in [('explorer','5686a8','82b2bd','365972'),('lucia','c67c58','e6ac70','95553e'),('marcos','77934f','a8ba68','526e43')]:
 atlas=Canvas(512,96*24)
 for pi,pose in enumerate(poses):
  for di,direction in enumerate(facings):
   for frame in range(counts[pose]):
    c=Canvas(64,96);back=direction in ('ne','nw');right=direction in ('ne','se');side=1 if right else -1
    t=frame/counts[pose]*math.tau;step=round(math.sin(t)*4) if pose=='walk' else 0
    sit=pose in ('sit','work');bob=1 if pose=='walk' and frame%4 in (1,2) else 0
    base=80-bob-(round(abs(math.sin(t))*6) if pose=='celebrate' else 0)
    # Shoes, trouser shading and cuffs; asymmetric frames visibly alternate steps.
    for x,offset in [(24,step),(34,-step)]:
     if sit:c.rect(x,base-19,7,9,'293f49');c.rect(x+side*4,base-12,7,5,'26373d')
     else:c.rect(x,base-19,7,17+offset,'293f49');c.rect(x+1,base-18,2,12+offset,'436173');c.rect(x-1,base-3+offset,9,4,'23323b');c.rect(x,base+offset,8,1,'697c82')
    # Coat silhouette.
    c.rect(21,base-43,22,25,dark);c.rect(23,base-42,18,23,shirt);c.rect(24,base-40,5,18,light);c.rect(23,base-21,18,3,dark)
    if not back:c.rect(31,base-39,1,17,dark);c.rect(34,base-35,5,2,light)
    # Arms and hands: work cycles/talking/celebration remain distinct.
    for x,sgn in [(18,-1),(42,1)]:
     arm_y=base-39+round(step*sgn*.6)
     if pose=='celebrate':arm_y=base-59+(frame%2);c.rect(x,arm_y,5,16,shirt);c.rect(x,arm_y-4,5,5,'e7b48c')
     elif sit:c.rect(x,base-37,5,10,shirt);c.rect(x+side*2,base-28+(frame%2 if pose=='work' else 0),7,5,'e7b48c')
     elif pose=='talk' and sgn==side:c.rect(x,base-40,5,10,shirt);c.rect(x+side*2,base-43+(frame%3),5,8,'e7b48c')
     else:c.rect(x,arm_y,5,12,shirt);c.rect(x,arm_y+11,5,7,'e7b48c');c.rect(x,arm_y+16,5,2,'be866c')
    # Head, stepped hair contour, cheek and readable face in four directions.
    hy=base-59+(1 if pose=='idle' and frame==2 else 0)
    c.rect(25,hy,15,17,'c78c6f');c.rect(24,hy+2,17,11,'e7b48c');c.rect(26,hy+1,12,12,'f2c99a')
    c.rect(25,hy-4,14,4,'253c43');c.rect(23,hy-1,18,6,'253c43');c.rect(26,hy-3,10,3,'42565a')
    if back:c.rect(23,hy+2,18,11,'253c43');c.rect(26,hy+2,12,8,'354d50');c.rect(25,hy+13,14,2,'b87f64')
    else:
     ex=35 if right else 27;c.rect(ex,hy+7,2,3,'23343e');c.rect(ex+side*3,hy+10,2,2,'c78c6f');c.rect(ex-side,hy+14,4,1,'9c6255');c.rect(23 if right else 39,hy+8,3,5,'d59c7b')
    if pose=='celebrate':
     for sx,sy in [(12,base-63),(49,base-68),(46,base-43)]:c.rect(sx,sy,3,3,'e6bf67')
    atlas.paste(c,frame*64,(pi*4+di)*96)
 atlas.save(OUT/f'{name}.png')
# Tile diamonds use exactly the same 2:1 projection as navigation.
for name,base,shade,line in [('floor','c7bea0','b4ac91','a39980'),('grass','88a35d','799750','a1b975'),('path','c9b684','bba577','dac897')]:
 c=Canvas(64,32);c.poly([(32,0),(64,16),(32,32),(0,16)],shade);c.poly([(32,1),(62,16),(32,31),(2,16)],base)
 for y in range(4,29,5):
  for x in range(4,60,7):
   if abs(x-32)/32+abs(y-16)/16<.8:c.rect(x,y,3 if name=='floor' else 2,1,line)
 c.save(OUT/f'{name}.png')
# Desk: top-left footprint origin is at PNG coordinate (32,64).
c=Canvas(128,96)
for x,y in [(32,67),(89,82),(4,82),(62,96)]:c.rect(x,y-27,4,26,'354a49');c.rect(x,y-27,1,24,'72817a')
c.poly([(32,34),(96,66),(64,82),(0,50)],'61472f');c.poly([(32,32),(96,64),(64,80),(0,48)],'ae7950');c.poly([(32,32),(94,63),(64,77),(2,47)],'d1a36c')
for x,y in [(19,47),(35,48),(52,61),(65,64)]:c.rect(x,y,9,1,'bb8b55')
c.poly([(40,7),(61,17),(61,43),(40,33)],'263c43');c.poly([(43,12),(58,19),(58,36),(43,29)],'7bb1bb');c.poly([(44,13),(56,19),(44,25)],'a6d7ca');c.rect(49,39,3,8,'384e4f');c.poly([(43,45),(53,50),(59,47),(49,42)],'435959')
c.poly([(23,49),(45,60),(54,56),(32,45)],'5b6863');c.poly([(25,48),(45,58),(51,55),(31,45)],'dad5b5');c.rect(74,53,6,8,'f0ddb0');c.rect(74,52,6,2,'7e6045');c.rect(80,55,2,4,'c4af83')
c.save(OUT/'desk.png')
# Empty templates are separate from runtime PNGs; guides must not be shipped as frames.
c=Canvas(512,384)
for row in range(4):
 for col in range(8):
  x=col*64;y=row*96
  c.rect(x,y,64,1,'657f8b');c.rect(x,y,1,96,'657f8b');c.rect(x+31,y+76,1,9,'d79c62');c.rect(x+28,y+80,9,1,'d79c62')
c.save(OUT/'templates/character-64x96.png')
c=Canvas(128,128);c.poly([(32,64),(96,96),(64,112),(0,80)],(106,157,88,75));c.rect(28,64,9,1,'cf9464');c.rect(32,60,1,9,'cf9464');c.save(OUT/'templates/object-2x1.png')
manifest={'version':1,'character':{'image':'/pixelart/explorer.png','variants':{'ce936a':'/pixelart/lucia.png','819582':'/pixelart/marcos.png'},'frameWidth':64,'frameHeight':96,'anchor':[32,80],'directions':facings,'animations':{p:{'row':i*4,'frames':counts[p],'fps':FPS[p]} for i,p in enumerate(poses)}},'objects':{'pixel.desk':{'image':'/pixelart/desk.png','width':128,'height':96,'origin':[32,64]},'pixel.tree':{'image':'/pixelart/tree.png','width':72,'height':108,'origin':[36,81]}},'tiles':{'office':'/pixelart/floor.png','grass':'/pixelart/grass.png','path':'/pixelart/path.png'}}
if (OUT/'catalog.json').exists():
 previous=json.loads((OUT/'catalog.json').read_text())
 if any('image' in clip for clip in previous.get('character',{}).get('animations',{}).values()):
  manifest['character']=previous['character']
 manifest['objects']={**previous.get('objects',{}),**manifest['objects']}
 if previous.get('objects',{}).get('pixel.desk',{}).get('image')=='/pixelart/desk-v2.png':
  manifest['objects']['pixel.desk']=previous['objects']['pixel.desk']
(OUT/'catalog.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Pixel atlas: 3 characters, 6 poses × 4 directions. Objects, tiles and guides written.')
