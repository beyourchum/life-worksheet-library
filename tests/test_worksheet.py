import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from tools import worksheet


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "content" / "EP62" / "EP62_corrected.md"
TOOL = ROOT / "tools" / "worksheet.py"


class WorksheetTests(unittest.TestCase):
    def test_ep62_lint_passes(self):
        result = worksheet.lint_text(SOURCE.read_text(encoding="utf-8"), "EP62_corrected.md")
        self.assertEqual("pass", result["status"])
        self.assertEqual(4, result["summary"]["sections"])
        self.assertEqual(2, result["summary"]["pages"])

    def test_missing_audience_fails(self):
        text = SOURCE.read_text(encoding="utf-8").replace(
            "audience: 台灣大專生與初入職場者\n", ""
        )
        result = worksheet.lint_text(text, "missing-audience.md")
        self.assertEqual("fail", result["status"])
        self.assertIn("missing-metadata", {item["code"] for item in result["errors"]})

    def test_missing_approved_style_metadata_fails(self):
        text = SOURCE.read_text(encoding="utf-8").replace(
            "hero_question: 工作薪水和付出不成比例，該繼續努力、溝通，還是換工作？\n",
            "",
        )
        result = worksheet.lint_text(text, "missing-hero-question.md")
        self.assertEqual("fail", result["status"])
        self.assertIn("missing-metadata", {item["code"] for item in result["errors"]})

    def test_legacy_style_metadata_fails(self):
        text = SOURCE.read_text(encoding="utf-8").replace(
            "series_title: 職場生存攻略\n",
            "series_title: 職場生存攻略\nfont_profile: ep62\n",
        )
        result = worksheet.lint_text(text, "legacy-style.md")
        self.assertEqual("fail", result["status"])
        self.assertIn("removed-style-metadata", {item["code"] for item in result["errors"]})

    def test_removed_section_note_fails(self):
        text = SOURCE.read_text(encoding="utf-8").replace(
            "## 01 先看看我的現況\n",
            "## 01 先看看我的現況\n\n<!-- section-note: 舊簡化描述 -->\n",
        )
        result = worksheet.lint_text(text, "legacy-section-note.md")
        self.assertEqual("fail", result["status"])
        self.assertIn("removed-section-note", {item["code"] for item in result["errors"]})

    def test_hero_accent_must_be_in_title(self):
        text = SOURCE.read_text(encoding="utf-8").replace(
            "hero_accent: 有回報嗎？",
            "hero_accent: 不存在的文字",
        )
        result = worksheet.lint_text(text, "accent-mismatch.md")
        self.assertEqual("fail", result["status"])
        self.assertIn("hero-accent-mismatch", {item["code"] for item in result["errors"]})

    def test_approved_template_accepts_another_episode(self):
        text = """---
id: EP63
document_role: student_worksheet
audience: 台灣大專生
source_document: local-test
series_title: 職場生存攻略
hero_kicker: 新影片的小標
hero_title: 新主題，有選擇嗎？
hero_accent: 有選擇嗎？
hero_question: 我可以怎麼選？
---

# Ep.63 新影片完整標題

**使用說明：** 請依序完成。

## 01 第一區

### 第一題（單選）

- [ ] 選項一
- [ ] 選項二
"""
        result = worksheet.lint_text(text, "EP63_corrected.md")
        self.assertEqual("pass", result["status"])
        _, _, body, controls, pages = worksheet.render_document(text)
        self.assertIn("<strong>EP63</strong><span>職場生存攻略</span>", body)
        self.assertIn('<h1>新主題，<em>有選擇嗎？</em></h1>', body)
        self.assertIn("<footer class=\"page-footer\"><strong>EP63</strong><span>新影片完整標題</span></footer>", body)
        self.assertNotIn("EP62", body)
        self.assertEqual(2, controls)
        self.assertEqual(1, pages)

    def test_choice_without_type_fails(self):
        text = SOURCE.read_text(encoding="utf-8").replace(
            "### 我目前比較想怎麼做？（單選）",
            "### 我目前比較想怎麼做？",
        )
        result = worksheet.lint_text(text, "missing-type.md")
        self.assertEqual("fail", result["status"])
        self.assertIn("choice-without-type", {item["code"] for item in result["errors"]})

    def test_more_than_two_pages_fails(self):
        text = SOURCE.read_text(encoding="utf-8") + "\n<!-- page-break -->\n"
        result = worksheet.lint_text(text, "three-pages.md")
        self.assertEqual("fail", result["status"])
        self.assertIn("page-limit", {item["code"] for item in result["errors"]})

    def test_short_and_long_answer_mapping(self):
        text = SOURCE.read_text(encoding="utf-8").replace(
            "<!-- short-answer: 目前最需要改善的一項是 -->",
            "<!-- short-answer: 目前最需要改善的一項是 -->\n\n"
            "<!-- long-answer: 我想補充的是 -->",
        )
        _, _, body, _, _ = worksheet.render_document(text)
        self.assertRegex(body, r'<input class="short-answer" id="short-\d+" type="text"')
        self.assertNotRegex(body, r'<textarea id="short-\d+"')
        self.assertRegex(body, r'<textarea id="long-\d+" rows="4"></textarea>')

    def test_local_asset_check_follows_linked_css(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            html_path = root / "worksheet.html"
            css_path = root / "styles" / "worksheet.css"
            font_path = root / "fonts" / "worksheet.woff2"
            css_path.parent.mkdir()
            html_path.write_text('<link rel="stylesheet" href="styles/worksheet.css">', encoding="utf-8")
            css_path.write_text('@font-face { src: url("../fonts/worksheet.woff2"); }', encoding="utf-8")

            missing = worksheet.find_missing_local_assets(html_path, ["styles/worksheet.css"])
            self.assertEqual([str(font_path.resolve())], missing)

            font_path.parent.mkdir()
            font_path.write_bytes(b"font")
            self.assertEqual([], worksheet.find_missing_local_assets(html_path, ["styles/worksheet.css"]))

    def test_build_and_validate(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            output = Path(temporary_directory) / "EP62.html"
            build = subprocess.run(
                [sys.executable, str(TOOL), "build", str(SOURCE), "--output", str(output)],
                cwd=ROOT,
                check=False,
                capture_output=True,
                text=True,
            )
            self.assertEqual(0, build.returncode, build.stdout + build.stderr)
            self.assertEqual("built", json.loads(build.stdout)["status"])
            self.assertTrue(output.is_file())
            built_text = output.read_text(encoding="utf-8")
            self.assertIn('href="fonts/ep62-fonts.css"', built_text)
            self.assertIn('href="fonts/genki/swap/700.css"', built_text)
            self.assertTrue((output.parent / "fonts" / "ep62-fonts.css").is_file())

            validate = subprocess.run(
                [sys.executable, str(TOOL), "validate", str(output), "--visual-qa", "passed"],
                cwd=ROOT,
                check=False,
                capture_output=True,
                text=True,
            )
            self.assertEqual(0, validate.returncode, validate.stdout + validate.stderr)
            result = json.loads(validate.stdout)
            self.assertEqual("pass", result["status"])
            self.assertEqual("pass", result["machine_checks"])

    def test_render_uses_approved_structure_and_video_title_footer(self):
        text = SOURCE.read_text(encoding="utf-8")
        _, title, body, _, _ = worksheet.render_document(text)
        self.assertIn('class="answer-mode">可複選</span>', body)
        self.assertIn('class="answer-mode">每列單選</span>', body)
        self.assertIn('class="section-number">01</span>', body)
        self.assertIn('class="choice other-choice"', body)
        self.assertIn('class="answer-field"', body)
        self.assertIn('class="short-answer"', body)
        self.assertIn('class="inline-answer"', body)
        self.assertNotIn("（可複選）", body)
        self.assertNotIn('class="section-note"', body)
        self.assertIn('<p class="hero-kicker">這點薪水憑什麼要我拚？</p>', body)
        self.assertIn('<h1>努力，<em>有回報嗎？</em></h1>', body)
        self.assertIn("<footer class=\"page-footer\"><strong>EP62</strong><span>這點薪水憑什麼要我拚？｜Z世代整頓職場，談談努力與回報的交換關係</span></footer>", body)
        self.assertNotRegex(body, r'<footer class="page-footer">(?:(?!</footer>).)*\d{2}\s*/\s*\d{2}')


if __name__ == "__main__":
    unittest.main()
