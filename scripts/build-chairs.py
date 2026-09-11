"""Directional chair layers from the original editable pixel primitives."""
from pathlib import Path
import json
source=Path(__file__).with_name('build-pixel-objects.py').read_text()
exec(source[:source.index('# Shared meeting table')])
for facing in ['ne','sw','se','nw']:
 c,o=start(64,96,(32,48))
 block(c,.44,.44,.12,.12,15,15,metal,o)
 block(c,.1,.42,.8,.12,3,3,metal,o);block(c,.42,.1,.12,.8,3,3,metal,o)
 block(c,.15,.15,.7,.7,6,19,green,o)
 save('chair-base',c,o)
 b=Canvas(64,96)
 if facing in ['ne','sw']:block(b,.15,.75 if facing=='ne' else .15,.7,.1,19,37,green,o)
 else:block(b,.15 if facing=='se' else .75,.15,.1,.7,19,37,green,o)
 save('chair-back-'+facing,b,o)
 c.paste(b,0,0);save('chair-'+facing,c,o)
p=OUT/'catalog.json';pack=json.loads(p.read_text());pack['objects'].update(entries);p.write_text(json.dumps(pack,indent=2)+'\n')
