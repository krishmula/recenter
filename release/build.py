"""Build a Chrome Web Store upload ZIP with manifest.json at the archive root."""
from pathlib import Path
import json, zipfile, hashlib
root = Path(__file__).resolve().parent.parent
extension = root / 'extension'
manifest = json.loads((extension / 'manifest.json').read_text())
package = root / 'release' / ('recenter-' + manifest['version'] + '-chrome-web-store.zip')
files = ['manifest.json', 'background.js', 'content.js', 'popup.html', 'popup.js', 'popup.css', 'icon.png']
with zipfile.ZipFile(package, 'w', zipfile.ZIP_DEFLATED) as archive:
    for filename in files:
        archive.write(extension / filename, filename)
with zipfile.ZipFile(package) as archive:
    assert archive.testzip() is None
    assert json.loads(archive.read('manifest.json')) == manifest
print(package)
print('SHA256:', hashlib.sha256(package.read_bytes()).hexdigest())
