#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ "$(uname -s)" != Darwin ]; then
    echo 'Safari packaging requires macOS and Xcode.' >&2
    exit 1
fi
python3 release/build.py
xcrun safari-web-extension-converter release/unpacked/safari \
    --project-location release/safari-project --app-name Recenter \
    --bundle-identifier io.github.krishmula.recenter --swift --macos-only \
    --copy-resources --no-open --no-prompt --force
python3 - <<'PYTHON'
from pathlib import Path
project = Path('release/safari-project/Recenter/Recenter.xcodeproj/project.pbxproj')
text = project.read_text()
# Xcode 26.5 capitalizes the app identifier but leaves the extension prefix lowercase.
text = text.replace('PRODUCT_BUNDLE_IDENTIFIER = io.github.krishmula.Recenter;',
                    'PRODUCT_BUNDLE_IDENTIFIER = io.github.krishmula.recenter;')
project.write_text(text)
PYTHON
xcodebuild -project release/safari-project/Recenter/Recenter.xcodeproj \
    -scheme Recenter -configuration Debug -sdk macosx -destination 'generic/platform=macOS' \
    -derivedDataPath release/safari-derived-data CODE_SIGNING_ALLOWED=NO build
