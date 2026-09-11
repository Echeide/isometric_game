"""Verify shipped PNG dimensions against the runtime atlas manifest."""
import json
import struct
from pathlib import Path
root = Path(__file__).resolve().parents[1] / 'static'
pack = json.loads((root / 'pixelart/catalog.json').read_text())
def dimensions(url):
    data = (root / url.lstrip('/')).read_bytes()
    assert data[:8] == b'\x89PNG\r\n\x1a\n', url
    return struct.unpack('>II', data[16:24])
c = pack['character']
for name, clip in c['animations'].items():
    urls = [clip.get('image', c['image']), *clip.get('variants', c.get('variants', {})).values()]
    for url in urls:
        width, height = dimensions(url)
        assert clip['frames'] * c['frameWidth'] <= width, (url, name)
        assert (clip['row'] + len(c['directions'])) * c['frameHeight'] <= height, (url, name)
for item in pack['objects'].values():
    dimensions(item['image'])
for url in pack['tiles'].values():
    assert dimensions(url) == (64, 32), url
print('All shipped textures exist; animation frames fit their PNG sheets.')
