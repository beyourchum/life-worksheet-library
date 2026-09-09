import re
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "EP62_complete.html"
FONT_DIR = Path(__file__).resolve().parents[3] / "assets" / "fonts" / "worksheet"


class VisibleText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.skip_depth = 0
        self.heading_depth = 0
        self.heading_end_tags = []
        self.all_text = []
        self.heading_text = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in {"style", "script"}:
            self.skip_depth += 1
        classes = set(attrs.get("class", "").split())
        if tag in {"h1", "h2", "h3"} or classes & {"section-number", "goal-label", "closing-mark"}:
            self.heading_depth += 1
            self.heading_end_tags.append(tag)

    def handle_endtag(self, tag):
        if tag in {"style", "script"} and self.skip_depth:
            self.skip_depth -= 1
        if self.heading_end_tags and tag == self.heading_end_tags[-1]:
            self.heading_end_tags.pop()
            self.heading_depth -= 1

    def handle_data(self, data):
        if self.skip_depth:
            return
        self.all_text.append(data)
        if self.heading_depth:
            self.heading_text.append(data)


def parse_unicode_range(value):
    ranges = []
    for item in value.split(","):
        token = item.strip().upper().removeprefix("U+")
        if not token:
            continue
        if "?" in token:
            lo = int(token.replace("?", "0"), 16)
            hi = int(token.replace("?", "F"), 16)
        elif "-" in token:
            start, end = token.split("-", 1)
            lo, hi = int(start, 16), int(end, 16)
        else:
            lo = hi = int(token, 16)
        ranges.append((lo, hi))
    return ranges


def select_faces(css, characters):
    codepoints = {ord(char) for char in characters}
    selected = []
    for block in re.findall(r"@font-face\s*\{.*?\}", css, flags=re.S):
        match = re.search(r"unicode-range:\s*([^;]+)", block, flags=re.I)
        if not match:
            selected.append(block)
            continue
        ranges = parse_unicode_range(match.group(1))
        if any(any(lo <= codepoint <= hi for lo, hi in ranges) for codepoint in codepoints):
            selected.append(block)
    return selected


def localize(css_path, remote_base, characters, subdir):
    css = css_path.read_text(encoding="utf-8")
    faces = select_faces(css, characters)
    destination = FONT_DIR / subdir
    destination.mkdir(parents=True, exist_ok=True)
    localized = []
    for face in faces:
        match = re.search(r"url\((?:['\"])?([^)'\"]+)", face)
        if not match:
            localized.append(face)
            continue
        relative_url = match.group(1)
        remote_url = urllib.parse.urljoin(remote_base, relative_url)
        filename = Path(urllib.parse.urlparse(remote_url).path).name
        target = destination / filename
        if not target.exists():
            urllib.request.urlretrieve(remote_url, target)
        localized.append(face.replace(relative_url, f"{subdir}/{filename}"))
    return "\n\n".join(localized)


def main():
    parser = VisibleText()
    parser.feed(HTML_PATH.read_text(encoding="utf-8"))
    heading_characters = "".join(parser.heading_text) + "0123456789"
    body_characters = "".join(parser.all_text)

    glow = localize(
        FONT_DIR / "glow-sans-tc-extrabold.css",
        "https://cdn.jsdelivr.net/npm/@vp-tw/cjk-web-fonts-glow-sans-tc-condensed@0.0.1/dist/ExtraBold/",
        heading_characters,
        "glow",
    )
    genyo = localize(
        FONT_DIR / "genyo-gothic-tc-400.css",
        "https://cdn.jsdelivr.net/npm/@hanzi.pro/webfonts-genyo-gothic-tc@0.1.0/swap/",
        body_characters,
        "genyo",
    )
    genyo_bold = localize(
        FONT_DIR / "genyo-gothic-tc-700.css",
        "https://cdn.jsdelivr.net/npm/@hanzi.pro/webfonts-genyo-gothic-tc@0.1.0/swap/",
        heading_characters,
        "genyo",
    )
    (FONT_DIR / "ep62-fonts.css").write_text(
        glow + "\n\n" + genyo + "\n\n" + genyo_bold + "\n",
        encoding="utf-8",
    )
    print(f"Glow faces: {len(select_faces((FONT_DIR / 'glow-sans-tc-extrabold.css').read_text(encoding='utf-8'), heading_characters))}")
    print(f"GenYo faces: {len(select_faces((FONT_DIR / 'genyo-gothic-tc-400.css').read_text(encoding='utf-8'), body_characters))}")


if __name__ == "__main__":
    main()
