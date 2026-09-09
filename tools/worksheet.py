import argparse
import html
import json
import re
import shutil
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


PROJECT_ROOT = Path(__file__).resolve().parents[1]
TEMPLATE_HTML = PROJECT_ROOT / "templates" / "worksheet.html"
TEMPLATE_CSS = PROJECT_ROOT / "templates" / "worksheet.css"
APPROVED_FONT_SOURCE = PROJECT_ROOT / "assets" / "fonts" / "worksheet"
REQUIRED_METADATA = (
    "id",
    "document_role",
    "audience",
    "source_document",
    "series_title",
    "hero_kicker",
    "hero_title",
    "hero_accent",
    "hero_question",
)
REMOVED_METADATA = ("font_profile",)
CHOICE_RE = re.compile(r"^- \[ \] (.+)$")
H1_RE = re.compile(r"^# (?!#)(.+)$")
H2_RE = re.compile(r"^## (?!#)(\d{2})\s+(.+)$")
H3_RE = re.compile(r"^### (?!#)(.+)$")
MATRIX_RE = re.compile(r"^<!-- matrix-single:\s*(.+?)\s*-->$")
SHORT_RE = re.compile(r"^<!-- short-answer:\s*(.+?)\s*-->$")
LONG_RE = re.compile(r"^<!-- long-answer:\s*(.+?)\s*-->$")
CSS_URL_RE = re.compile(r"url\(\s*(['\"]?)(.*?)\1\s*\)", re.I)


def emit(payload, destination=sys.stdout):
    print(json.dumps(payload, ensure_ascii=True, indent=2), file=destination)


def display_path(path):
    resolved = Path(path).resolve()
    try:
        return resolved.relative_to(PROJECT_ROOT).as_posix()
    except ValueError:
        return str(resolved)


def normalize_text(text):
    lines = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    cleaned = []
    blank_count = 0
    for line in lines:
        line = line.rstrip()
        if line:
            blank_count = 0
            cleaned.append(line)
        else:
            blank_count += 1
            if blank_count <= 2:
                cleaned.append("")
    return "\n".join(cleaned).rstrip() + "\n"


def parse_frontmatter(lines):
    if not lines or lines[0].strip() != "---":
        return {}, 0, [{
            "code": "missing-frontmatter",
            "line": 1,
            "message": "找不到 YAML frontmatter。",
            "fix": "在文件開頭加入 FORMAT_CONTRACT.md 規定的必要欄位。",
        }]
    metadata = {}
    errors = []
    for index in range(1, len(lines)):
        line = lines[index]
        if line.strip() == "---":
            return metadata, index + 1, errors
        if not line.strip():
            continue
        if ":" not in line:
            errors.append({
                "code": "invalid-frontmatter-line",
                "line": index + 1,
                "message": "frontmatter 欄位缺少冒號。",
                "fix": "使用 key: value 格式。",
            })
            continue
        key, value = line.split(":", 1)
        metadata[key.strip()] = value.strip()
    errors.append({
        "code": "unclosed-frontmatter",
        "line": 1,
        "message": "frontmatter 沒有結束標記。",
        "fix": "加入獨立一行 ---。",
    })
    return metadata, len(lines), errors


def lint_text(text, source="<memory>"):
    lines = text.splitlines()
    metadata, body_start, errors = parse_frontmatter(lines)
    warnings = []

    for field in REQUIRED_METADATA:
        if not metadata.get(field):
            errors.append({
                "code": "missing-metadata",
                "line": 1,
                "message": f"缺少必要欄位：{field}。",
                "fix": f"在 frontmatter 加入非空白的 {field}: value。",
            })
    for field in REMOVED_METADATA:
        if field in metadata:
            errors.append({
                "code": "removed-style-metadata",
                "line": 1,
                "message": f"舊樣式欄位 {field} 已移除。",
                "fix": f"刪除 {field}；建置一律套用目前核准的共用樣式。",
            })
    if metadata.get("document_role") and metadata["document_role"] != "student_worksheet":
        errors.append({
            "code": "invalid-document-role",
            "line": 1,
            "message": "學生版的 document_role 必須是 student_worksheet。",
            "fix": "修正角色，或把非學生版內容移到獨立檔案。",
        })
    if metadata.get("id") and metadata["id"] != metadata["id"].upper():
        errors.append({
            "code": "lowercase-id",
            "line": 1,
            "message": "id 內的英文字母必須大寫。",
            "fix": "將 id 改為大寫，例如 EP62。",
        })
    if (
        metadata.get("hero_title")
        and metadata.get("hero_accent")
        and metadata["hero_accent"] not in metadata["hero_title"]
    ):
        errors.append({
            "code": "hero-accent-mismatch",
            "line": 1,
            "message": "hero_accent 不是 hero_title 的一部分。",
            "fix": "讓 hero_accent 完整出現在 hero_title 中，以便套用深綠色強調。",
        })

    h1_lines = []
    h2_numbers = []
    page_breaks = 0
    matrix = None
    current_question = None
    choice_groups = []

    for offset, raw in enumerate(lines[body_start:], start=body_start + 1):
        line = raw.strip()
        if "☐" in line or "☑" in line:
            errors.append({
                "code": "raw-checkbox-symbol",
                "line": offset,
                "message": "發現無法穩定解析的方框字元。",
                "fix": "選項改用 - [ ]。",
            })
        if re.search(r"[＿_]{3,}", line):
            errors.append({
                "code": "manual-blank-line",
                "line": offset,
                "message": "發現以底線控制的填答空間。",
                "fix": "改用 short-answer 或 long-answer 標記。",
            })

        h1 = H1_RE.match(line)
        if h1:
            h1_lines.append(offset)
            current_question = None
            continue
        h2 = H2_RE.match(line)
        if h2:
            h2_numbers.append((offset, int(h2.group(1))))
            current_question = None
            continue
        if line.startswith("## ") and not H2_RE.match(line):
            errors.append({
                "code": "invalid-section-heading",
                "line": offset,
                "message": "H2 未使用兩位數連續編號。",
                "fix": "改為 ## 01 區塊名稱。",
            })
            continue
        h3 = H3_RE.match(line)
        if h3:
            title = h3.group(1)
            if "（單選）" in title:
                kind = "single"
            elif "（可複選）" in title:
                kind = "multiple"
            else:
                kind = None
            current_question = {"line": offset, "kind": kind, "count": 0}
            choice_groups.append(current_question)
            continue
        if line == "<!-- page-break -->":
            page_breaks += 1
            current_question = None
            continue

        matrix_start = MATRIX_RE.match(line)
        if matrix_start:
            if matrix is not None:
                errors.append({
                    "code": "nested-matrix",
                    "line": offset,
                    "message": "矩陣題不可巢狀。",
                    "fix": "先加入 <!-- end-matrix -->。",
                })
            options = [item.strip() for item in matrix_start.group(1).split("|") if item.strip()]
            matrix = {"line": offset, "options": options, "rows": 0}
            if len(options) < 2:
                errors.append({
                    "code": "matrix-options",
                    "line": offset,
                    "message": "單選矩陣至少需要兩個選項。",
                    "fix": "使用 | 分隔兩個以上選項。",
                })
            continue
        if line == "<!-- end-matrix -->":
            if matrix is None:
                errors.append({
                    "code": "orphan-matrix-end",
                    "line": offset,
                    "message": "找不到對應的 matrix-single 起點。",
                    "fix": "移除標記或補上矩陣起點。",
                })
            elif matrix["rows"] == 0:
                errors.append({
                    "code": "empty-matrix",
                    "line": matrix["line"],
                    "message": "矩陣題沒有列。",
                    "fix": "在矩陣標記中加入 - 題目。",
                })
            matrix = None
            continue
        if matrix is not None and line.startswith("- "):
            matrix["rows"] += 1
            continue

        choice = CHOICE_RE.match(line)
        if choice:
            label = choice.group(1).strip()
            if current_question is None or current_question["kind"] is None:
                errors.append({
                    "code": "choice-without-type",
                    "line": offset,
                    "message": "選項前找不到單選或可複選的 H3 題目。",
                    "fix": "在題目結尾加入（單選）或（可複選）。",
                })
            else:
                current_question["count"] += 1
            if label.startswith("其他") and label != "其他（請填寫）":
                errors.append({
                    "code": "invalid-other-option",
                    "line": offset,
                    "message": "其他選項格式不一致。",
                    "fix": "使用其他（請填寫）。",
                })
            continue

        if line.startswith("<!-- section-note:"):
            errors.append({
                "code": "removed-section-note",
                "line": offset,
                "message": "標題後方的簡短描述已從核准樣式移除。",
                "fix": "刪除 section-note；需要的說明改放在標題下方的一般段落。",
            })
            continue
        if line.startswith("<!--") and line.endswith("-->"):
            if not SHORT_RE.match(line) and not LONG_RE.match(line):
                warnings.append({
                    "code": "unknown-directive",
                    "line": offset,
                    "message": "發現 Script 不處理的註解。",
                    "fix": "確認是否應加入 FORMAT_CONTRACT.md 或移除。",
                })
        if line.startswith("####"):
            warnings.append({
                "code": "unsupported-heading",
                "line": offset,
                "message": "Script 只支援 H1 至 H3。",
                "fix": "調整為 H3 或一般段落。",
            })

    if matrix is not None:
        errors.append({
            "code": "unclosed-matrix",
            "line": matrix["line"],
            "message": "矩陣題沒有結束標記。",
            "fix": "加入 <!-- end-matrix -->。",
        })
    if len(h1_lines) != 1:
        errors.append({
            "code": "h1-count",
            "line": h1_lines[0] if h1_lines else body_start + 1,
            "message": f"文件必須剛好有一個 H1，目前有 {len(h1_lines)} 個。",
            "fix": "保留一個 # 主標題。",
        })
    if not h2_numbers:
        errors.append({
            "code": "missing-sections",
            "line": body_start + 1,
            "message": "文件至少需要一個 H2 主要區塊。",
            "fix": "加入 ## 01 區塊名稱。",
        })
    else:
        actual = [number for _, number in h2_numbers]
        expected = list(range(1, len(actual) + 1))
        if actual != expected:
            errors.append({
                "code": "section-sequence",
                "line": h2_numbers[0][0],
                "message": f"H2 編號不是從 01 開始連續排列：{actual}。",
                "fix": f"改為 {expected}。",
            })
    if page_breaks > 1:
        errors.append({
            "code": "page-limit",
            "line": 1,
            "message": f"預設最多兩頁，目前有 {page_breaks + 1} 頁。",
            "fix": "刪減內容，使文件不超過兩頁。",
        })
    for group in choice_groups:
        if group["kind"] and group["count"] < 2:
            warnings.append({
                "code": "small-choice-group",
                "line": group["line"],
                "message": f"選項群只有 {group['count']} 個選項。",
                "fix": "確認題型標記與選項是否完整。",
            })

    status = "fail" if errors else "warning" if warnings else "pass"
    return {
        "status": status,
        "file": source,
        "errors": errors,
        "warnings": warnings,
        "summary": {
            "sections": len(h2_numbers),
            "pages": page_breaks + 1,
            "choice_groups": len([group for group in choice_groups if group["kind"]]),
        },
    }


def render_inline(value):
    escaped = html.escape(value)
    return re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", escaped)


def render_document(text):
    lines = text.splitlines()
    metadata, body_start, _ = parse_frontmatter(lines)
    body_lines = lines[body_start:]
    title = next((H1_RE.match(line.strip()).group(1) for line in body_lines if H1_RE.match(line.strip())), metadata["id"])
    pages = [[]]
    for line in body_lines:
        if line.strip() == "<!-- page-break -->":
            pages.append([])
        else:
            pages[-1].append(line)

    control_index = 0
    group_index = 0

    def next_control(prefix):
        nonlocal control_index
        control_index += 1
        return f"{prefix}-{control_index}"

    def render_page(page_lines, page_number):
        nonlocal group_index
        page_label = metadata["series_title"]
        video_title = re.sub(r"^Ep\.\d+\s*", "", title, flags=re.IGNORECASE)
        parts = [f'<article class="page worksheet-page" aria-label="第 {page_number} 頁">']
        parts.append(
            f'<header class="page-meta"><strong>{html.escape(metadata["id"])}</strong>'
            f'<span>{html.escape(page_label)}</span>'
            f'<span class="page-count">{page_number:02d} / {len(pages):02d}</span></header>'
        )
        index = 0
        question_kind = None

        def next_nonblank(start):
            cursor = start
            while cursor < len(page_lines) and not page_lines[cursor].strip():
                cursor += 1
            return cursor

        while index < len(page_lines):
            raw = page_lines[index]
            line = raw.strip()
            if not line:
                index += 1
                continue
            h1 = H1_RE.match(line)
            if h1:
                hero_title = metadata["hero_title"]
                hero_accent = metadata["hero_accent"]
                parts.append('<div class="worksheet-hero">')
                parts.append(f'<p class="hero-kicker">{render_inline(metadata["hero_kicker"])}</p>')
                parts.append("<h1>")
                before, after = hero_title.split(hero_accent, 1)
                parts.append(render_inline(before))
                parts.append(f"<em>{render_inline(hero_accent)}</em>")
                parts.append(render_inline(after))
                parts.append("</h1>")
                parts.append('<div class="hero-copy">')
                parts.append(f'<p class="hero-question">{render_inline(metadata["hero_question"])}</p>')
                parts.append("</div>")
                parts.append("</div>")
                question_kind = None
                index += 1
                continue
            h2 = H2_RE.match(line)
            if h2:
                parts.append('<div class="section-heading">')
                parts.append(f'<span class="section-number">{html.escape(h2.group(1))}</span>')
                parts.append(f"<h2>{render_inline(h2.group(2))}</h2>")
                parts.append("</div>")
                question_kind = None
                index += 1
                continue
            h3 = H3_RE.match(line)
            if h3:
                heading = h3.group(1)
                question_kind = "radio" if "（單選）" in heading else "checkbox" if "（可複選）" in heading else None
                display_heading = re.sub(r"\s*（(?:單選|可複選)）\s*$", "", heading).rstrip()
                if question_kind:
                    answer_mode = "單選" if question_kind == "radio" else "可複選"
                    parts.append('<div class="question-heading">')
                    parts.append(f"<h3>{render_inline(display_heading)}</h3>")
                    parts.append(f'<span class="answer-mode">{answer_mode}</span>')
                    parts.append("</div>")
                else:
                    parts.append(f"<h3>{render_inline(heading)}</h3>")
                index += 1
                continue
            matrix = MATRIX_RE.match(line)
            if matrix:
                options = [item.strip() for item in matrix.group(1).split("|") if item.strip()]
                rows = []
                index += 1
                while index < len(page_lines) and page_lines[index].strip() != "<!-- end-matrix -->":
                    row = page_lines[index].strip()
                    if row.startswith("- "):
                        rows.append(row[2:].strip())
                    index += 1
                index += 1
                parts.append('<fieldset class="matrix"><legend class="sr-only">每列單選</legend>')
                for row_number, row in enumerate(rows, start=1):
                    group_index += 1
                    group_name = f"matrix-{group_index}"
                    parts.append('<div class="matrix-row">')
                    parts.append(f'<span class="matrix-label">{render_inline(row)}</span><div class="matrix-options">')
                    for option in options:
                        control_id = next_control("choice")
                        parts.append(
                            f'<label class="choice" for="{control_id}"><input id="{control_id}" type="radio" '
                            f'name="{group_name}" value="{html.escape(option)}"><span>{render_inline(option)}</span></label>'
                        )
                    parts.append("</div></div>")
                parts.append("</fieldset>")
                continue
            choice = CHOICE_RE.match(line)
            if choice:
                group_index += 1
                group_name = f"group-{group_index}"
                parts.append('<div class="choices">')
                while index < len(page_lines):
                    item = CHOICE_RE.match(page_lines[index].strip())
                    if not item:
                        break
                    label = item.group(1).strip()
                    control_id = next_control("choice")
                    if label == "其他（請填寫）":
                        other_id = next_control("other")
                        parts.append(
                            f'<div class="choice other-choice"><label class="choice-toggle" for="{control_id}">'
                            f'<input id="{control_id}" type="{question_kind}" name="{group_name}" '
                            f'value="{html.escape(label)}"><span>其他</span></label>'
                            f'<input class="other-input" id="{other_id}" type="text" '
                            f'aria-label="其他選項內容" autocomplete="off"></div>'
                        )
                    else:
                        parts.append(
                            f'<label class="choice" for="{control_id}"><input id="{control_id}" type="{question_kind}" '
                            f'name="{group_name}" value="{html.escape(label)}"><span>{render_inline(label)}</span></label>'
                        )
                    index += 1
                parts.append("</div>")
                continue
            short_answer = SHORT_RE.match(line)
            if short_answer:
                control_id = next_control("short")
                label = short_answer.group(1)
                if "完成時間" in label:
                    parts.append(
                        f'<label class="inline-answer" for="{control_id}"><span>我預計在</span>'
                        f'<input id="{control_id}" type="text" aria-label="{html.escape(label)}" autocomplete="off">'
                        f'<span>前完成這一步。</span></label>'
                    )
                else:
                    parts.append(
                        f'<div class="answer-field"><label for="{control_id}">{render_inline(label)}：</label>'
                        f'<input class="short-answer" id="{control_id}" type="text" autocomplete="off"></div>'
                    )
                index += 1
                continue
            long_answer = LONG_RE.match(line)
            if long_answer:
                control_id = next_control("long")
                label = long_answer.group(1)
                parts.append(
                    f'<div class="answer-field"><label for="{control_id}">{render_inline(label)}：</label>'
                    f'<textarea id="{control_id}" rows="4"></textarea></div>'
                )
                index += 1
                continue
            if line.startswith("> "):
                parts.append('<aside class="closing"><span class="closing-mark">→</span>')
                parts.append(f"<p>{render_inline(line[2:].strip())}</p></aside>")
                question_kind = None
                index += 1
                continue
            next_index = next_nonblank(index + 1)
            if next_index < len(page_lines) and MATRIX_RE.match(page_lines[next_index].strip()):
                parts.append('<div class="question-heading matrix-heading">')
                parts.append(f'<p class="section-instruction">{render_inline(line)}</p>')
                parts.append('<span class="answer-mode">每列單選</span>')
                parts.append("</div>")
                index += 1
                continue
            if line.startswith("- "):
                parts.append("<ul>")
                while index < len(page_lines) and page_lines[index].strip().startswith("- "):
                    parts.append(f"<li>{render_inline(page_lines[index].strip()[2:].strip())}</li>")
                    index += 1
                parts.append("</ul>")
                continue
            if line.startswith("<!--") and line.endswith("-->"):
                index += 1
                continue
            parts.append(f"<p>{render_inline(line)}</p>")
            index += 1
        parts.append(
            f'<footer class="page-footer"><strong>{html.escape(metadata["id"])}</strong>'
            f'<span>{html.escape(video_title)}</span>'
            f'</footer>'
        )
        parts.append("</article>")
        return "".join(parts)

    rendered_pages = "".join(render_page(page, number) for number, page in enumerate(pages, start=1))
    return metadata, title, rendered_pages, control_index, len(pages)


class ValidationParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.lang = None
        self.has_viewport = False
        self.has_title = False
        self.page_count = 0
        self.controls = []
        self.label_for = set()
        self.external_assets = []
        self.local_assets = []
        self.label_depth = 0
        self.has_clear_draft = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "html":
            self.lang = attrs.get("lang")
        elif tag == "meta" and attrs.get("name") == "viewport":
            self.has_viewport = True
        elif tag == "title":
            self.has_title = True
        classes = set(attrs.get("class", "").split())
        if classes & {"page", "worksheet-page"}:
            self.page_count += 1
        if tag == "label":
            self.label_depth += 1
            if attrs.get("for"):
                self.label_for.add(attrs["for"])
        if tag in {"input", "textarea"}:
            self.controls.append({
                "id": attrs.get("id"),
                "aria": attrs.get("aria-label"),
                "nested_label": self.label_depth > 0,
                "tag": tag,
            })
        if tag == "button" and (attrs.get("id") == "clear-draft" or "data-clear" in attrs):
            self.has_clear_draft = True
        for attribute in ("src", "href"):
            value = attrs.get(attribute, "")
            if value.startswith(("http://", "https://", "//")):
                self.external_assets.append(value)
            elif value and not value.startswith(("#", "data:", "mailto:", "tel:", "javascript:")):
                self.local_assets.append(value)

    def handle_endtag(self, tag):
        if tag == "label" and self.label_depth:
            self.label_depth -= 1


def find_missing_local_assets(html_path, references):
    html_path = Path(html_path).resolve()
    queue = [(html_path.parent, reference) for reference in references]
    visited = set()
    missing = set()

    while queue:
        base_directory, reference = queue.pop()
        if reference.startswith(("http://", "https://", "//", "data:")):
            continue
        reference_path = unquote(urlsplit(reference).path)
        if not reference_path:
            continue
        asset_path = (base_directory / reference_path).resolve()
        if asset_path in visited:
            continue
        visited.add(asset_path)
        if not asset_path.is_file():
            missing.add(display_path(asset_path))
            continue
        if asset_path.suffix.lower() != ".css":
            continue
        try:
            stylesheet = asset_path.read_text(encoding="utf-8-sig")
        except OSError:
            missing.add(display_path(asset_path))
            continue
        for match in CSS_URL_RE.finditer(stylesheet):
            queue.append((asset_path.parent, match.group(2).strip()))

    return sorted(missing)


def validate_html(text, source, visual_qa="pending", source_path=None):
    parser = ValidationParser()
    parser.feed(text)
    errors = []
    warnings = []

    def require(condition, code, message, fix):
        if not condition:
            errors.append({"code": code, "message": message, "fix": fix})

    require(parser.lang == "zh-Hant", "html-lang", "html lang 不是 zh-Hant。", "在根元素設定 lang=\"zh-Hant\"。")
    require(parser.has_viewport, "viewport", "缺少 viewport。", "加入 width=device-width 的 viewport meta。")
    require(parser.has_title, "title", "缺少 title。", "在 head 加入 title。")
    require(parser.page_count >= 1, "page-container", "找不到 .page 容器。", "每頁使用一個 .page。")
    require(parser.page_count <= 2, "page-limit", f"HTML 有 {parser.page_count} 頁，超過兩頁上限。", "刪減內容，使文件不超過兩頁。")
    require(len(parser.controls) >= 1, "controls", "找不到填答控制項。", "確認題型標記與 build 輸出。")
    unlabeled = [
        item for item in parser.controls
        if not item["aria"] and not item["nested_label"] and item["id"] not in parser.label_for
    ]
    require(not unlabeled, "control-labels", f"有 {len(unlabeled)} 個控制項沒有標籤。", "加入 label for 或 aria-label。")
    require(not parser.external_assets, "external-assets", "HTML 含有外部網路資產。", "改用內嵌或專案內資產。")
    if source_path is not None:
        missing_assets = find_missing_local_assets(source_path, parser.local_assets)
        if missing_assets:
            errors.append({
                "code": "missing-local-assets",
                "message": f"HTML 缺少 {len(missing_assets)} 個本機資產。",
                "files": missing_assets,
                "fix": "還原列出的檔案，或修正 HTML／CSS 中的相對路徑。",
            })
    require("sessionStorage" in text, "session-storage", "缺少 sessionStorage 暫存。", "使用共用 worksheet template。")
    require(parser.has_clear_draft, "clear-draft", "缺少清除暫存按鈕。", "加入 id=\"clear-draft\" 或 data-clear 的按鈕。")
    require(re.search(r"@page\s*\{[^}]*size:\s*A4\s+portrait", text, re.S | re.I), "a4-print", "缺少 A4 直式列印設定。", "在 CSS 設定 @page size: A4 portrait。")
    require("@media print" in text, "print-media", "缺少列印樣式。", "加入 @media print。")
    require(re.search(r"@media\s+print\s*\{.*?\.(?:worksheet-)?toolbar\s*\{\s*display:\s*none", text, re.S), "print-toolbar", "列印時未明確隱藏工具列。", "在 print media 中隱藏工具列。")
    require('href="fonts/ep62-fonts.css"' in text and 'href="fonts/genki/swap/700.css"' in text, "approved-fonts", "缺少核准樣式的本機字型。", "使用共用 worksheet template 並保留兩個本機字型連結。")
    require('class="worksheet-hero"' in text and 'class="hero-kicker"' in text and 'class="hero-question"' in text, "approved-hero", "主視覺不是核准結構。", "補齊必要 frontmatter 後重新 build。")
    require('class="page-meta"' in text and 'class="section-number"' in text, "approved-hierarchy", "頁首或區塊編號不是核准結構。", "使用共用 renderer 重新 build。")
    require('class="answer-mode"' in text, "answer-mode", "題目未顯示作答模式。", "為選項題加上（單選）或（可複選）後重新 build。")
    require('class="page-footer"' in text, "approved-footer", "缺少核准頁尾。", "使用共用 renderer 重新 build。")
    require(not re.search(r'<footer class="page-footer">(?:(?!</footer>).)*\d{2}\s*/\s*\d{2}', text, re.S), "footer-page-number", "頁尾不應顯示頁碼。", "頁碼只保留在頁首。")
    require('class="section-note"' not in text, "removed-section-note", "HTML 仍含已移除的標題旁描述。", "刪除 section-note 並重新 build。")
    require(re.search(r"@media\s+print\s*\{.*?height:\s*297mm", text, re.S), "fixed-a4-page", "列印頁面未固定為一張 A4。", "使用核准的 print CSS。")
    require(re.search(r"@media\s+print\s*\{.*?\.choice\s*\{[^}]*background:\s*var\(--soft-green\)", text, re.S), "print-choice-blocks", "列印選項未保留色塊。", "使用核准的 print CSS，選項不要改成底線樣式。")
    require("{{" not in text and "}}" not in text, "template-markers", "HTML 留有未解析模板標記。", "檢查 build 的模板替換。")
    require(not re.search(r"\b(fetch|XMLHttpRequest|sendBeacon)\b", text), "network-upload", "HTML 含有可能傳送答案的網路 API。", "移除網路傳輸程式。")

    if visual_qa == "pending":
        warnings.append({
            "code": "visual-qa-pending",
            "message": "瀏覽器與列印 QA 尚未全部完成。",
            "fix": "完成工作流列出的響應式、互動與 A4 列印預覽檢查。",
        })
    elif visual_qa == "failed":
        errors.append({
            "code": "visual-qa-failed",
            "message": "人工視覺 QA 未通過。",
            "fix": "修正模板或內容後重新 build 與 validate。",
        })

    status = "fail" if errors else "warning" if warnings else "pass"
    return {
        "status": status,
        "file": source,
        "machine_checks": "fail" if errors else "pass",
        "visual_qa": visual_qa,
        "errors": errors,
        "warnings": warnings,
        "summary": {"pages": parser.page_count, "controls": len(parser.controls)},
    }


def command_normalize(args):
    source = args.input.resolve()
    output = args.output.resolve()
    if not source.is_file():
        emit({"status": "fail", "file": display_path(source), "error": "輸入檔案不存在。", "action": "確認 --input 路徑。"})
        return 2
    if output.exists() and not args.force:
        emit({"status": "fail", "file": display_path(output), "error": "輸出檔案已存在。", "action": "改用其他路徑，或確認後加入 --force。"})
        return 2
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(normalize_text(source.read_text(encoding="utf-8-sig")), encoding="utf-8")
    emit({"status": "normalized", "input": display_path(source), "output": display_path(output)})
    return 0


def command_lint(args):
    source = args.input.resolve()
    if not source.is_file():
        emit({"status": "fail", "file": display_path(source), "errors": [{"message": "輸入檔案不存在。", "fix": "確認路徑。"}], "warnings": []})
        return 2
    result = lint_text(source.read_text(encoding="utf-8-sig"), display_path(source))
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    emit(result)
    return 1 if result["status"] == "fail" else 0


def command_build(args):
    source = args.input.resolve()
    output = args.output.resolve()
    if not source.is_file():
        emit({"status": "fail", "file": display_path(source), "error": "輸入檔案不存在。", "action": "確認路徑。"})
        return 2
    golden_root = (PROJECT_ROOT / "golden").resolve()
    try:
        output.relative_to(golden_root)
        emit({"status": "fail", "file": display_path(output), "error": "build 不可覆寫 golden。", "action": "改用 output/ 或 tmp/。"})
        return 2
    except ValueError:
        pass
    text = source.read_text(encoding="utf-8-sig")
    lint = lint_text(text, display_path(source))
    if lint["status"] == "fail":
        emit({"status": "fail", "file": display_path(source), "errors": lint["errors"], "action": "修正 lint fail 後重新 build。"})
        return 1
    output.parent.mkdir(parents=True, exist_ok=True)
    template = TEMPLATE_HTML.read_text(encoding="utf-8")
    styles = TEMPLATE_CSS.read_text(encoding="utf-8")
    metadata, title, body, controls, pages = render_document(text)
    if not APPROVED_FONT_SOURCE.is_dir():
        emit({
            "status": "fail",
            "file": display_path(APPROVED_FONT_SOURCE),
            "error": "核准樣式的本機字型資產不存在。",
            "action": "還原 assets/fonts/worksheet 後重新 build。",
        })
        return 2
    shutil.copytree(APPROVED_FONT_SOURCE, output.parent / "fonts", dirs_exist_ok=True)
    document_title = metadata["hero_title"]
    document = template
    document = document.replace("{{TITLE}}", html.escape(f'{metadata["id"]}｜{document_title}'))
    document = document.replace("{{STYLES}}", styles)
    document = document.replace("{{WORKSHEET_ID}}", html.escape(metadata["id"]))
    document = document.replace("{{BODY}}", body)
    output.write_text(document, encoding="utf-8")
    emit({
        "status": "built",
        "input": display_path(source),
        "output": display_path(output),
        "pages": pages,
        "controls": controls,
        "lint_warnings": lint["warnings"],
    })
    return 0


def command_validate(args):
    source = args.input.resolve()
    if not source.is_file():
        emit({"status": "fail", "file": display_path(source), "errors": [{"message": "HTML 檔案不存在。", "fix": "先執行 build。"}], "warnings": []})
        return 2
    result = validate_html(
        source.read_text(encoding="utf-8-sig"),
        display_path(source),
        args.visual_qa,
        source_path=source,
    )
    if args.report:
        report = args.report.resolve()
        report.parent.mkdir(parents=True, exist_ok=True)
        report.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    emit(result)
    return 1 if result["status"] == "fail" else 0


def build_parser():
    parser = argparse.ArgumentParser(description="Normalize, lint, build, and validate worksheet files.")
    commands = parser.add_subparsers(dest="command", required=True)

    normalize = commands.add_parser("normalize", help="Normalize Markdown without changing meaning.")
    normalize.add_argument("input", type=Path)
    normalize.add_argument("--output", type=Path, required=True)
    normalize.add_argument("--force", action="store_true")
    normalize.set_defaults(handler=command_normalize)

    lint = commands.add_parser("lint", help="Check Markdown against the format contract.")
    lint.add_argument("input", type=Path)
    lint.add_argument("--report", type=Path)
    lint.set_defaults(handler=command_lint)

    build = commands.add_parser("build", help="Build HTML from corrected Markdown.")
    build.add_argument("input", type=Path)
    build.add_argument("--output", type=Path, required=True)
    build.set_defaults(handler=command_build)

    validate = commands.add_parser("validate", help="Run deterministic HTML checks.")
    validate.add_argument("input", type=Path)
    validate.add_argument("--report", type=Path)
    validate.add_argument("--visual-qa", choices=("pending", "passed", "failed"), default="pending")
    validate.set_defaults(handler=command_validate)
    return parser


def main():
    args = build_parser().parse_args()
    return args.handler(args)


if __name__ == "__main__":
    raise SystemExit(main())
