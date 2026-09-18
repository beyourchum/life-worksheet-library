"""Build compact horizontal web fonts from the checked-in source outlines.

Requires fonttools and brotli. Run from any directory; output is deterministic
for the same source files and tool versions. Original font files stay intact.
"""
import hashlib
import json
import time
from html.parser import HTMLParser
from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[2]
FONTS = ROOT / 'assets/fonts/worksheet'
OUTPUT = FONTS / 'compact'


def save_font(builder, output):
    for attempt in range(5):
        try:
            builder.save(output)
            return
        except OSError as error:
            if error.errno != 22 or attempt == 4:
                raise
            time.sleep(0.2 * (attempt + 1))


class TextCollector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.text = []
        self.ignored = 0

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'):
            self.ignored += 1
        self.text.extend(value for key, value in attrs
                         if key in ('placeholder', 'aria-label', 'value') and value)

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.ignored -= 1

    def handle_data(self, data):
        if not self.ignored:
            self.text.append(data)


families = [
    ('glow-800', 'Glow Sans TC', 800, sorted((FONTS / 'glow').glob('*.woff2'))),
    ('genki-700', 'Genki Gothic TC', 700, sorted((FONTS / 'genki/files').glob('*.woff2'))),
    ('genyo-400', 'GenYo Gothic TC', 400, sorted((FONTS / 'genyo').glob('*.400.*.woff2'))),
    ('genyo-700', 'GenYo Gothic TC', 700, sorted((FONTS / 'genyo').glob('*.700.*.woff2'))),
]

OUTPUT.mkdir(exist_ok=True)
def text_hash(file):
    return hashlib.sha256(file.read_text(encoding='utf-8').encode('utf-8')).hexdigest()


generator_hash = text_hash(Path(__file__))
source_hash = hashlib.sha256(b''.join(file.read_bytes() for *_, sources in families for file in sources)).hexdigest()
old_file = OUTPUT / 'manifest.json'
old = json.loads(old_file.read_text(encoding='utf-8')) if old_file.exists() else {}
manifest = {'generatorHash': generator_hash, 'sourceHash': source_hash, 'inputs': {}, 'scopes': {}}
scopes = [('home', ROOT / 'index.html'), *[(p.parent.name, p) for p in sorted((ROOT / 'worksheets').glob('*/index.html'))]]
for scope, file in scopes:
    parser = TextCollector()
    parser.feed(file.read_text(encoding='utf-8'))
    script = ROOT / ('assets/site.js' if scope == 'home' else 'assets/worksheet.js')
    hashes = {source.relative_to(ROOT).as_posix(): text_hash(source) for source in [file, script]}
    manifest['inputs'].update(hashes)
    previous = old.get('scopes', {}).get(scope)
    if (previous and old.get('generatorHash') == generator_hash and old.get('sourceHash') == source_hash
            and all(old.get('inputs', {}).get(name) == value for name, value in hashes.items())
            and all((OUTPUT / scope / (name + '.woff2')).exists()
                    and hashlib.sha256((OUTPUT / scope / (name + '.woff2')).read_bytes()).hexdigest() == font.get('sha256')
                    for name, font in previous['fonts'].items())
            and (OUTPUT / scope / 'fonts.css').exists()
            and text_hash(OUTPUT / scope / 'fonts.css') == previous.get('cssHash')):
        manifest['scopes'][scope] = previous
        print(f'{scope}: unchanged')
        continue
    source_text = ''.join(parser.text) + script.read_text(encoding='utf-8')
    characters = {name: set(map(ord, source_text)) | set(range(32, 127)) for name, *_ in families}
    selected_families = families[:1] if scope == 'home' else families
    destination = OUTPUT / scope
    destination.mkdir(exist_ok=True)
    scope_manifest = {'fonts': {}}
    manifest['scopes'][scope] = scope_manifest
    rules = []
    for filename, family, weight, sources in selected_families:
        fonts = [TTFont(file) for file in sources]
        base = fonts[0]
        units = base['head'].unitsPerEm
        glyphs, metrics, cmap = {}, {}, {}
        glyphs['.notdef'] = TTGlyphPen(None).glyph()
        metrics['.notdef'] = (units, 0)
        for source in fonts:
            assert source['head'].unitsPerEm == units
            glyph_set = source.getGlyphSet()
            for codepoint, original_name in source.getBestCmap().items():
                if codepoint not in characters[filename] or codepoint in cmap:
                    continue
                name = f'uni{codepoint:04X}'
                pen = TTGlyphPen(None)
                # CFF source subsets cannot be directly merged; preserve their
                # outlines as quadratic curves within one design unit of error.
                glyph_set[original_name].draw(Cu2QuPen(pen, max_err=1.0, reverse_direction=True))
                glyphs[name] = pen.glyph()
                metrics[name] = source['hmtx'][original_name]
                cmap[codepoint] = name
        builder = FontBuilder(units, isTTF=True)
        builder.setupGlyphOrder(list(glyphs))
        builder.setupCharacterMap(cmap)
        builder.setupGlyf(glyphs)
        builder.setupHorizontalMetrics(metrics)
        builder.setupHorizontalHeader(ascent=base['hhea'].ascent, descent=base['hhea'].descent,
                                      lineGap=base['hhea'].lineGap)
        names = {'familyName': family, 'styleName': 'Regular' if weight == 400 else 'Bold',
                 'fullName': family + ' Web ' + str(weight),
                 'psName': filename.replace('-', '') + 'Web'}
        for name_id, key in [(0, 'copyright'), (7, 'trademark'), (8, 'manufacturer'),
                             (9, 'designer'), (13, 'licenseDescription'), (14, 'licenseInfoURL')]:
            value = base['name'].getDebugName(name_id)
            if value:
                names[key] = value
        builder.setupNameTable(names)
        os2 = base['OS/2']
        builder.setupOS2(sTypoAscender=os2.sTypoAscender, sTypoDescender=os2.sTypoDescender,
                         sTypoLineGap=os2.sTypoLineGap, usWinAscent=os2.usWinAscent,
                         usWinDescent=os2.usWinDescent, usWeightClass=weight,
                         usWidthClass=os2.usWidthClass, fsType=os2.fsType)
        builder.setupPost()
        builder.font['head'].created = base['head'].created
        builder.font['head'].modified = base['head'].modified
        builder.font.recalcTimestamp = False
        builder.font.flavor = 'woff2'
        output = destination / (filename + '.woff2')
        save_font(builder, output)
        check = TTFont(output)
        assert set(check.getBestCmap()) == set(cmap)
        check.close()
        for source in fonts:
            source.close()
        # Coverage lets the browser select a fallback for absent characters without
        # trying a download that cannot render them.
        points = sorted(cmap)
        ranges = []
        start = end = points[0]
        for point in points[1:] + [None]:
            if point is not None and point == end + 1:
                end = point
            else:
                ranges.append(f'U+{start:X}' if start == end else f'U+{start:X}-{end:X}')
                start = end = point
        rules.append('@font-face {\n'
                     f'  font-family: "{family}";\n  font-style: normal;\n'
                     f'  font-weight: {weight};\n'
                     + ('  font-stretch: condensed;\n' if family == 'Glow Sans TC' else '')
                     + '  font-display: block;\n'
                     f'  src: url({filename}.woff2) format("woff2");\n'
                     f'  unicode-range: {", ".join(ranges)};\n}}\n')
        scope_manifest['fonts'][filename] = {'bytes': output.stat().st_size, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'characters': points}
        print(f'{scope}/{filename}: {len(cmap)} characters, {output.stat().st_size} bytes')
    (destination / 'fonts.css').write_text('\n'.join(rules), encoding='utf-8')
    scope_manifest['cssHash'] = text_hash(destination / 'fonts.css')
    for source in [file, script]:
        manifest['inputs'][source.relative_to(ROOT).as_posix()] = hashlib.sha256(source.read_text(encoding='utf-8').encode('utf-8')).hexdigest()
(OUTPUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
