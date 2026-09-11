"""Editable original character artwork: one compact PNG per action and four facings."""
from pathlib import Path
import json,math
source=Path(__file__).with_name('build-pixelart.py').read_text()
exec(source[:source.index('# Fixed foot anchor')])
INK='28242c';SKIN='efb785';SKIN_DARK='c78365'
actions={'idle':(4,3),'walk':(8,10),'work':(4,8),'talk':(4,5),'celebrate':(6,8)}
facings=['ne','se','sw','nw']

def limb(c,a,b,width,color):
 dx=b[0]-a[0];dy=b[1]-a[1];length=max(1,math.hypot(dx,dy));nx=-dy/length*width/2;ny=dx/length*width/2
 c.poly([(a[0]+nx,a[1]+ny),(b[0]+nx,b[1]+ny),(b[0]-nx,b[1]-ny),(a[0]-nx,a[1]-ny)],color)
 c.rect(a[0]-width/2,a[1]-width/2,width,width,color);c.rect(b[0]-width/2,b[1]-width/2,width,width,color)

def draw(pose,frame,count,facing,shirt,hair,pack):
 c=Canvas(64,96);back=facing in ['ne','nw'];left=facing in ['sw','nw']
 t=frame/count*math.tau;stride=round(math.sin(t)*6) if pose=='walk' else 0
 bob=(1 if pose=='walk' and frame%4 in [1,2] else 0)+(1 if pose=='idle' and frame==2 else 0)
 seated=pose=='work';jump=round(abs(math.sin(t))*5) if pose=='celebrate' else 0
 y=-bob-jump;hip=62+y
 # Diagonal stride: moving away lifts the forward boot; coming toward camera lowers it.
 for x,s in [(28,-stride),(37,stride)]:
  knee=(x+(3 if seated else round(s/2)),hip+(5 if seated else 8))
  foot=(x+(8 if seated else s),hip+(9 if seated else 16)+(-round(s/2) if back else round(s/2)))
  limb(c,(x,hip),knee,8,INK);limb(c,knee,foot,8,INK)
  limb(c,(x,hip),knee,4,'384c5a');limb(c,knee,foot,4,'445e6a')
  c.rect(foot[0]-3,foot[1]-1,10,5,INK);c.rect(foot[0]-1,foot[1],7,2,'654642')
 # Rear arm and backpack silhouette in front views.
 if not back:
  c.poly([(19,44+y),(27,41+y),(31,47+y),(30,62+y),(20,64+y),(17,59+y)],INK)
  c.rect(20,46+y,8,14,pack);c.rect(19,48+y,2,10,'658087')
 farhand=(25-round(stride*.5),61+y)
 limb(c,(25,48+y),farhand,7,INK);limb(c,(25,49+y),farhand,4,SKIN_DARK)
 # Shirt and shoulders, angled slightly toward facing.
 c.poly([(25,43+y),(36,42+y),(43,48+y),(41,63+y),(25,64+y),(22,57+y)],INK)
 c.poly([(26,45+y),(36,44+y),(40,48+y),(39,61+y),(26,61+y),(25,54+y)],shirt)
 c.rect(28,46+y,6,14,'f1dfb5');c.rect(27,60+y,13,2,'b7ac94')
 if not back:
  c.poly([(33,45+y),(36,47+y),(34,50+y),(37,57+y),(33,60+y),(31,56+y),(32,49+y)],'943f42')
  c.rect(25,46+y,3,12,pack)
 # Visible near sleeve and gesture; working hands reach toward the monitor.
 shoulder=(41,49+y)
 if pose=='celebrate':hand=(49,29+y+frame%2);elbow=(48,41+y)
 elif seated:elbow=(44,53+y);hand=(49,49+y+frame%2)
 elif pose=='talk':elbow=(45,54+y);hand=(49,46+y+frame%2)
 else:elbow=(42-round(stride*.4),55+y);hand=(42-round(stride*.65),62+y)
 limb(c,shoulder,elbow,8,INK);limb(c,shoulder,elbow,5,shirt)
 limb(c,elbow,hand,6,INK);limb(c,elbow,hand,3,SKIN);c.rect(hand[0]-2,hand[1]-1,4,4,SKIN)
 if back:
  c.poly([(24,44+y),(35,46+y),(39,51+y),(37,65+y),(22,63+y),(20,49+y)],INK)
  c.poly([(24,47+y),(34,49+y),(35,61+y),(24,60+y)],pack)
  c.rect(25,53+y,8,7,'476575');c.rect(26,54+y,6,2,'72909a')
  c.rect(22,48+y,2,10,'73939a')
 # Large stepped head, dark outline and asymmetrical hair/face make direction readable.
 c.poly([(22,20+y),(29,17+y),(39,18+y),(46,23+y),(48,34+y),(44,43+y),(37,47+y),(24,43+y),(19,36+y),(19,25+y)],INK)
 c.poly([(24,23+y),(39,22+y),(45,27+y),(45,38+y),(39,44+y),(26,41+y),(23,34+y)],SKIN)
 c.rect(26,37+y,13,5,'eaa775');c.rect(43,32+y,4,6,SKIN_DARK)
 c.poly([(22,23+y),(28,19+y),(38,20+y),(44,24+y),(45,30+y),(40,29+y),(37,34+y),(34,28+y),(31,32+y),(27,28+y),(26,36+y),(22,33+y)],hair)
 c.poly([(25,22+y),(30,20+y),(38,21+y),(42,24+y),(33,25+y),(28,24+y)],'855139')
 if back:
  c.poly([(21,26+y),(42,26+y),(44,34+y),(40,42+y),(33,45+y),(24,40+y),(21,35+y)],hair)
  c.rect(26,28+y,10,9,hair);c.rect(41,34+y,4,6,SKIN);c.rect(28,40+y,9,2,'3c2c2b')
 else:
  c.rect(32,33+y,3,5,INK);c.rect(41,32+y,3,5,INK);c.rect(37,40+y,4,2,'a65a53');c.rect(28,37+y,3,2,'d9896d')
 if left:
  mirrored=Canvas(64,96)
  for yy in range(96):
   for xx in range(64):
    i=(yy*64+xx)*4
    if c.data[i+3]:mirrored.pixel(63-xx,yy,tuple(c.data[i:i+4]))
  c=mirrored
 return c

characters=[('explorer','e9dfbd','493029','315163'),('lucia','d9a475','70422e','7e4543'),('marcos','a2ad74','3b2b29','4e6151')]
for name,shirt,hair,packcolor in characters:
 folder=OUT/'characters'/name;folder.mkdir(parents=True,exist_ok=True)
 for pose,(count,fps) in actions.items():
  sheet=Canvas(count*64,384)
  for row,facing in enumerate(facings):
   for frame in range(count):sheet.paste(draw(pose,frame,count,facing,shirt,hair,packcolor),frame*64,row*96)
  sheet.save(folder/f'{pose}.png')
p=OUT/'catalog.json';catalog=json.loads(p.read_text());character=catalog['character']
character['image']='/pixelart/characters/explorer/idle.png';character.pop('variants',None)
character['animations']={pose:{'image':f'/pixelart/characters/explorer/{pose}.png','variants':{'ce936a':f'/pixelart/characters/lucia/{pose}.png','819582':f'/pixelart/characters/marcos/{pose}.png'},'row':0,'frames':n,'fps':fps} for pose,(n,fps) in actions.items()}
character['animations']['sit']={**character['animations']['work'],'frames':1}
p.write_text(json.dumps(catalog,indent=2)+'\n')
print('Built 15 action sheets; sit shares the first work frame. Original atlases retained.')
