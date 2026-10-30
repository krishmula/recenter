from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parent.parent
release = root / 'release'
extension = root / 'extension'
manifest = json.loads((extension / 'manifest.json').read_text())
version = manifest['version']
files = ['background.js', 'content.js', 'popup.html', 'popup.js', 'popup.css', 'icon.png']
assets = {name: (extension / name).read_bytes() for name in files}
license_bytes = (root / 'LICENSE').read_bytes()
browsers = json.loads((release / 'browsers.json').read_text())
packages = {}
report = {'version': version, 'packages': {}, 'browsers': {}}

for browser, overrides in browsers.items():
    browser_manifest = {**manifest, **overrides}
    manifest_bytes = ((json.dumps(browser_manifest, indent=2) + '\n').encode()
                      if overrides else (extension / 'manifest.json').read_bytes())
    members = {**assets, 'manifest.json': manifest_bytes, 'LICENSE': license_bytes}
    directory = release / 'unpacked' / browser
    directory.mkdir(parents=True, exist_ok=True)
    unexpected = {p.name for p in directory.iterdir()} - set(members)
    if unexpected:
        raise RuntimeError(f'Unexpected files in {directory}: {sorted(unexpected)}')
    for name, data in members.items():
        (directory / name).write_bytes(data)
    report['browsers'][browser] = {
        name: hashlib.sha256(data).hexdigest() for name, data in sorted(members.items())
    }
    if browser == 'chrome':
        packages[f'recenter-{version}-chrome-web-store.zip'] = members
        packages[f'recenter-{version}.zip'] = {
            **{f'recenter/{name}': data for name, data in members.items() if name != 'LICENSE'},
            'README.md': (root / 'README.md').read_bytes(),
            'LICENSE': license_bytes,
        }
    else:
        packages[f'recenter-{version}-{browser}-unsigned.zip'] = members

for filename, members in packages.items():
    package = release / filename
    with zipfile.ZipFile(package, 'w') as archive:
        for name, data in sorted(members.items()):
            info = zipfile.ZipInfo(name)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, data)
    with zipfile.ZipFile(package) as archive:
        if archive.testzip() is not None or set(archive.namelist()) != set(members):
            raise RuntimeError(f'Invalid archive: {package}')
        for name, data in members.items():
            if archive.read(name) != data:
                raise RuntimeError(f'Archive differs: {package}: {name}')
    digest = hashlib.sha256(package.read_bytes()).hexdigest()
    report['packages'][filename] = digest
    print(f'{package}\nSHA256: {digest}')

(release / 'build-manifest.json').write_text(json.dumps(report, indent=2, sort_keys=True) + '\n')
(release / 'SHA256SUMS').write_text(''.join(
    f'{digest}  {name}\n' for name, digest in sorted(report['packages'].items())
))
print('Verified archive contents; wrote release/build-manifest.json and release/SHA256SUMS')
