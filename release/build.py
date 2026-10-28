from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parent.parent
extension = root / 'extension'
manifest = json.loads((extension / 'manifest.json').read_text())
version = manifest['version']
files = ['manifest.json', 'background.js', 'content.js', 'popup.html', 'popup.js', 'popup.css', 'icon.png']
packages = {
    f'recenter-{version}-chrome-web-store.zip': {
        **{name: extension / name for name in files},
        'LICENSE': root / 'LICENSE',
    },
    f'recenter-{version}.zip': {
        **{f'recenter/{name}': extension / name for name in files},
        'README.md': root / 'README.md',
        'LICENSE': root / 'LICENSE',
    },
}
for filename, members in packages.items():
    package = root / 'release' / filename
    with zipfile.ZipFile(package, 'w') as archive:
        for name, source in sorted(members.items()):
            info = zipfile.ZipInfo(name)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, source.read_bytes())
    with zipfile.ZipFile(package) as archive:
        assert archive.testzip() is None
        assert set(archive.namelist()) == set(members)
        for name, source in members.items():
            assert archive.read(name) == source.read_bytes(), name
    print(package)
    print('SHA256:', hashlib.sha256(package.read_bytes()).hexdigest())
