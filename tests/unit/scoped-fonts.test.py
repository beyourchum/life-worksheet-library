import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen


def fixture_font(output):
    output.parent.mkdir(parents=True, exist_ok=True)
    names = ['.notdef', 'space', 'a', 'b']
    builder = FontBuilder(1000, isTTF=True)
    builder.setupGlyphOrder(names)
    builder.setupCharacterMap({32: 'space', 65: 'a', 0x4e00: 'b'})
    builder.setupGlyf({name: TTGlyphPen(None).glyph() for name in names})
    builder.setupHorizontalMetrics({name: (500, 0) for name in names})
    builder.setupHorizontalHeader(ascent=800, descent=-200)
    builder.setupNameTable({'familyName': 'Fixture', 'styleName': 'Regular', 'fullName': 'Fixture', 'psName': 'Fixture'})
    builder.setupOS2(sTypoAscender=800, sTypoDescender=-200, usWinAscent=800, usWinDescent=200)
    builder.setupPost()
    builder.font.flavor = 'woff2'
    builder.save(output)


work = Path(__file__).resolve().parents[2] / '.qa/work/general'
work.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(prefix='worksheet-scoped-fonts-', dir=work) as temporary:
    root = Path(temporary)
    assert root.resolve().is_relative_to(work.resolve())
    script = root / 'scripts/generate/fonts.py'
    script.parent.mkdir(parents=True)
    shutil.copyfile(Path(__file__).resolve().parents[2] / 'scripts/generate/fonts.py', script)
    for folder, name in [('glow', 'font.woff2'), ('genki/files', 'font.woff2'), ('genyo', 'font.400.test.woff2'), ('genyo', 'font.700.test.woff2')]:
        fixture_font(root / 'assets/fonts/worksheet' / folder / name)
    for file in ['index.html', 'worksheets/EP1/index.html', 'worksheets/EP2/index.html']:
        target = root / file
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text('<p>A</p>', encoding='utf8')
    for file in ['assets/site.js', 'assets/worksheet.js']:
        (root / file).write_text('', encoding='utf8')
    result = subprocess.run([sys.executable, str(script)], cwd=root, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    manifest_file = root / 'assets/fonts/worksheet/compact/manifest.json'
    before = json.loads(manifest_file.read_text(encoding='utf8'))
    assert all(0x4e00 not in font['characters'] for font in before['scopes']['EP1']['fonts'].values())
    (root / 'worksheets/EP1/index.html').write_text('<p>A\u4e00</p>', encoding='utf8')
    result = subprocess.run([sys.executable, str(script), '--scope', 'EP1'], cwd=root, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    after = json.loads(manifest_file.read_text(encoding='utf8'))
    for font in after['scopes']['EP1']['fonts'].values():
        assert 0x4e00 in font['characters'], 'Scoped generation must include newly added text'
    assert after['inputs']['worksheets/EP1/index.html'] != before['inputs']['worksheets/EP1/index.html']
    assert after['scopes']['EP2'] == before['scopes']['EP2'], 'Other scopes must stay unchanged'
print('Scoped font regeneration includes new characters and preserves other scopes.')
