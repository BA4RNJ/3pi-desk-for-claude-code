#!/usr/bin/env python3
"""Reuse Electron's translation dictionary in the native string resources."""
import json
import re
from pathlib import Path
root = Path(__file__).resolve().parents[2]
source = (root / 'src/renderer/src/i18n.ts').read_text()
pairs = []
for match in re.finditer(r'^\s*("(?:\\.|[^"\\])*"):\s*("(?:\\.|[^"\\])*"),?\s*$', source, re.M):
    try: pairs.append((json.loads(match[1]), json.loads(match[2])))
    except ValueError: pass
source_count = len(pairs)
extras = json.loads((root / 'apps/macos/Localization.json').read_text())
pairs.extend((chinese, english) for english, chinese in extras.items())
for language in ['en', 'zh-Hans']:
    path = root / 'apps/macos/Sources/DeskNative/Resources' / (language + '.lproj') / 'Localizable.strings'
    original = path.read_text().split('// Imported Electron dictionary')[0]
    existing = set(re.findall(r'^"((?:\\.|[^"\\])*)"\s*=', original, re.M))
    entries = {}
    for chinese, english in pairs:
        for key in [chinese, english]:
            escaped = json.dumps(key, ensure_ascii=False)[1:-1]
            if escaped not in existing: entries[key] = english if language == 'en' else chinese
    path.write_text(original + '// Imported Electron dictionary\n' + '\n'.join(json.dumps(key, ensure_ascii=False) + ' = ' + json.dumps(value, ensure_ascii=False) + ';' for key, value in sorted(entries.items())) + '\n')
print(f'Imported {source_count} Electron translations and {len(extras)} native entries')
