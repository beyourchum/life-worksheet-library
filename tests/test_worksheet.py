import json
import re
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
    def test_report_versions_detect_changes_and_missing_files(self):
        self.assertEqual("unverified", worksheet.check_report_versions({})["status"])
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "source.md"
            corrected = Path(directory) / "corrected.md"
            source.write_text("source", encoding="utf-8")
            corrected.write_text("corrected", encoding="utf-8")
            report = {"changes": [], "fingerprints": {
                "source": worksheet.file_fingerprint(source),
                "corrected": worksheet.file_fingerprint(corrected),
            }}
            self.assertEqual("current", worksheet.check_report_versions(report)["status"])
            for path in (source, corrected):
                before = path.read_bytes()
                path.write_bytes(before + b"changed")
                self.assertEqual("stale", worksheet.check_report_versions(report)["status"])
                path.write_bytes(before)
            corrected.unlink()
            self.assertEqual("stale", worksheet.check_report_versions(report)["status"])
            report["fingerprints"].pop("corrected")
            self.assertEqual("unverified", worksheet.check_report_versions(report)["status"])

    def test_bind_and_check_report_cli_preserve_review_status(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "source.md"
            corrected = Path(directory) / "corrected.md"
            report_path = Path(directory) / "correction.json"
            source.write_text("source", encoding="utf-8")
            corrected.write_text("corrected", encoding="utf-8")
            original = {"status": "pending", "changes": [], "needs_confirmation": ["確認題型"]}
            report_path.write_text(json.dumps(original), encoding="utf-8")
            result = subprocess.run([sys.executable, str(TOOL), "bind-correction", str(report_path), "--source", str(source), "--corrected", str(corrected)], capture_output=True, text=True)
            self.assertEqual(0, result.returncode, result.stdout + result.stderr)
            saved = json.loads(report_path.read_text(encoding="utf-8"))
            self.assertEqual(original, {key: saved[key] for key in original})
            for changed in (False, True):
                if changed:
                    source.write_text("updated", encoding="utf-8")
                before = report_path.read_bytes()
                result = subprocess.run([sys.executable, str(TOOL), "check-report", str(report_path)], cwd=directory, capture_output=True, text=True)
                self.assertEqual(1 if changed else 0, result.returncode)
                self.assertEqual("stale" if changed else "current", json.loads(result.stdout)["status"])
                self.assertEqual(before, report_path.read_bytes())

    def test_markdown_tables_fail_with_header_line(self):
        original = SOURCE.read_text(encoding="utf-8")
        for table in (
            "| 項目 | 內容 |\n| --- | --- |\n| 甲 | 乙 |",
            "項目 | 內容\n:--- | ---:\n甲 | 乙",
            "| 項目 | 內容 |\n| :---: | ---: |\n| 甲 | 乙 |",
            "| 項目 |\n| --- |\n| 甲 |",
        ):
            with self.subTest(table=table):
                text = original + "\n" + table + "\n"
                result = worksheet.lint_text(text)
                self.assertEqual("fail", result["status"])
                error = next(item for item in result["errors"] if item["code"] == "unsupported-table")
                self.assertEqual(len(original.splitlines()) + 2, error["line"])

    def test_pipe_in_prose_and_matrix_is_not_a_table(self):
        text = SOURCE.read_text(encoding="utf-8") + "\n甲 | 乙是兩個名稱。\n\n---\n"
        self.assertEqual("pass", worksheet.lint_text(text)["status"])

    def test_build_rejects_table_without_creating_output(self):
        text = SOURCE.read_text(encoding="utf-8") + "\n| 項目 | 內容 |\n| --- | --- |\n| 甲 | 乙 |\n"
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "EP62_corrected.md"
            output = Path(directory) / "EP62.html"
            source.write_text(text, encoding="utf-8")
            result = subprocess.run(
                [sys.executable, str(TOOL), "build", str(source), "--output", str(output)],
                capture_output=True, text=True, check=False,
            )
            self.assertEqual(1, result.returncode)
            self.assertIn("unsupported-table", result.stdout)
            self.assertFalse(output.exists())
            self.assertEqual(text, source.read_text(encoding="utf-8"))

    def test_matrix_rejects_content_that_would_be_lost(self):
        original = SOURCE.read_text(encoding="utf-8")
        for extra in (
            "請依最近一週的情況作答。",
            "### 矩陣內標題",
            "<!-- short-answer: 補充說明 -->",
            "<!-- page-break -->",
        ):
            with self.subTest(extra=extra):
                text = original.replace("- 目前的薪水\n", f"- 目前的薪水\n{extra}\n", 1)
                result = worksheet.lint_text(text)
                self.assertEqual("fail", result["status"])
                error = next(item for item in result["errors"] if item["code"] == "unsupported-matrix-content")
                self.assertEqual(text.splitlines().index(extra) + 1, error["line"])

    def test_matrix_allows_blank_lines_and_external_instructions(self):
        text = SOURCE.read_text(encoding="utf-8").replace(
            "- 目前的薪水\n", "- 目前的薪水\n\n", 1
        )
        self.assertEqual("pass", worksheet.lint_text(text)["status"])
        body = worksheet.render_document(text)[2]
        self.assertIn("請先勾選目前的感受。", body)
        self.assertIn("目前的薪水", body)
        self.assertIn("目前的工作內容", body)

    def test_build_rejects_invalid_matrix_without_overwriting_output(self):
        text = SOURCE.read_text(encoding="utf-8").replace(
            "- 目前的薪水\n", "- 目前的薪水\n請保留這段說明。\n", 1
        )
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "EP62_corrected.md"
            output = Path(directory) / "EP62.html"
            source.write_text(text, encoding="utf-8")
            output.write_text("existing-output", encoding="utf-8")
            result = subprocess.run(
                [sys.executable, str(TOOL), "build", str(source), "--output", str(output)],
                capture_output=True, text=True, check=False,
            )
            self.assertEqual(1, result.returncode)
            self.assertIn("unsupported-matrix-content", result.stdout)
            self.assertEqual("existing-output", output.read_text(encoding="utf-8"))

    def test_blank_lines_preserve_choice_groups(self):
        original = SOURCE.read_text(encoding="utf-8")
        metadata = original.split("---", 2)[1]
        for mode, input_type in (("單選", "radio"), ("可複選", "checkbox")):
            with self.subTest(mode=mode):
                text = f"---{metadata}---\n# Ep.62 測試\n\n## 01 測試\n\n" + (
                    f"### 第一題（{mode}）\n\n"
                    "- [ ] 甲\n\n \t\n- [ ] 其他（請填寫）\n\n"
                    f"### 第二題（{mode}）\n\n"
                    "- [ ] 乙\n\n- [ ] 丙\n\n"
                )
                self.assertEqual("pass", worksheet.lint_text(text)["status"])
                body = worksheet.render_document(text)[2]
                groups = re.findall(f'type="{input_type}" name="([^"]+)"', body)
                self.assertEqual(4, len(groups))
                self.assertEqual(groups[0], groups[1])
                self.assertEqual(groups[2], groups[3])
                self.assertNotEqual(groups[0], groups[2])
                self.assertIn('aria-label="其他選項內容"', body)

    def test_long_choice_stacks_entire_choice_group(self):
        original = SOURCE.read_text(encoding="utf-8")
        metadata = original.split("---", 2)[1]
        text = (
            f"---{metadata}---\n# Ep.62 測試\n\n## 01 測試\n\n"
            "### 第一題（可複選）\n\n"
            "- [ ] 短選項\n"
            "- [ ] 這是一個超過十二個字元的選項文字\n"
        )
        body = worksheet.render_document(text)[2]
        self.assertIn('<div class="choices choices-stacked">', body)

    def test_short_choices_keep_compact_grid(self):
        original = SOURCE.read_text(encoding="utf-8")
        metadata = original.split("---", 2)[1]
        text = (
            f"---{metadata}---\n# Ep.62 測試\n\n## 01 測試\n\n"
            "### 第一題（可複選）\n\n"
            "- [ ] 甲\n"
            "- [ ] 乙\n"
        )
        body = worksheet.render_document(text)[2]
        self.assertIn('<div class="choices">', body)
        self.assertNotIn('<div class="choices choices-stacked">', body)

    def test_example_directive_renders_on_a_gray_separate_line(self):
        text = SOURCE.read_text(encoding="utf-8").replace(
            "- [ ] 薪水\n", "- [ ] 薪水\n<!-- example: 每月實領金額 -->\n", 1
        )
        self.assertEqual("pass", worksheet.lint_text(text)["status"])
        body = worksheet.render_document(text)[2]
        self.assertIn('<p class="choice-example">例如：每月實領金額</p>', body)

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

    def test_marked_quote_keeps_arrow_and_prompt_quote_uses_separate_container(self):
        text = SOURCE.read_text(encoding="utf-8") + "\n<!-- with-arrow -->\n> 小提醒：提示內容。\n"
        body = worksheet.render_document(text)[2]
        self.assertIn('<aside class="closing"><span class="closing-mark">→</span><p>小提醒：提示內容。</p></aside>', body)
        prompt_text = SOURCE.read_text(encoding="utf-8") + (
            "\n<!-- with-arrow -->\n> AI 溝通教練幫幫忙：操作說明。\n\n<!-- prompt-quote -->\n\n第一段。\n\n- 條件一\n- 條件二\n\n<!-- end-prompt-quote -->\n"
        )
        prompt_body = worksheet.render_document(prompt_text)[2]
        self.assertIn('<aside class="closing prompt-intro"><span class="closing-mark">→</span>', prompt_body)
        self.assertIn('<aside class="prompt-quote"><div class="prompt-copy-text" data-prompt-text><p>第一段。</p><ul><li>條件一</li><li>條件二</li></ul></div><button class="prompt-copy-button" type="button" data-prompt-copy>複製提示詞</button></aside>', prompt_body)

    def test_untyped_h3_renders_as_subheading(self):
        text = SOURCE.read_text(encoding="utf-8").replace(
            "## 01 先看看我的現況\n",
            "## 01 先看看我的現況\n\n### 先看自己\n",
            1,
        )
        body = worksheet.render_document(text)[2]
        self.assertIn('<h3 class="subheading">先看自己</h3>', body)
        css = (ROOT / "templates" / "worksheet.css").read_text(encoding="utf-8")
        subheading_rule = css.split(".subheading {", 1)[1].split("}", 1)[0]
        self.assertIn("background: var(--soft-gray)", subheading_rule)

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
            self.assertEqual("current", worksheet.check_report_versions(result)["status"])
            output.write_text(built_text + "\n", encoding="utf-8")
            self.assertEqual("stale", worksheet.check_report_versions(result)["status"])

            for machine_ok in (True, False):
                candidate = built_text if machine_ok else built_text.replace('lang="zh-Hant"', 'lang="en"')
                output.write_text(candidate, encoding="utf-8")
                for visual_qa in ("pending", "passed", "failed"):
                    with self.subTest(machine_ok=machine_ok, visual_qa=visual_qa):
                        validation = subprocess.run(
                            [sys.executable, str(TOOL), "validate", str(output), "--visual-qa", visual_qa],
                            cwd=ROOT, capture_output=True, text=True, check=False,
                        )
                        result = json.loads(validation.stdout)
                        expected_status = "fail" if not machine_ok or visual_qa == "failed" else "warning" if visual_qa == "pending" else "pass"
                        self.assertEqual("pass" if machine_ok else "fail", result["machine_checks"])
                        self.assertEqual(visual_qa, result["visual_qa"])
                        self.assertEqual(expected_status, result["status"])
                        self.assertEqual(1 if expected_status == "fail" else 0, validation.returncode)
                        error_codes = {item["code"] for item in result["errors"]}
                        warning_codes = {item["code"] for item in result["warnings"]}
                        self.assertEqual(not machine_ok, "html-lang" in error_codes)
                        self.assertEqual(visual_qa == "failed", "visual-qa-failed" in error_codes)
                        self.assertEqual(visual_qa == "pending", "visual-qa-pending" in warning_codes)

    def test_render_uses_approved_structure_and_video_title_footer(self):
        text = SOURCE.read_text(encoding="utf-8")
        _, title, body, _, _ = worksheet.render_document(text)
        self.assertIn('class="answer-mode">可複選</span>', body)
        self.assertIn('class="answer-mode">每列單選</span>', body)
        self.assertIn('class="section-number">01</span>', body)
        self.assertIn('class="choice other-choice"', body)
        self.assertIn('class="answer-field"', body)
        self.assertIn('class="short-answer"', body)
        self.assertIn('預計完成期限（年／月／日）：</label>', body)
        self.assertNotIn("（可複選）", body)
        self.assertNotIn('class="section-note"', body)
        self.assertIn('<p class="hero-kicker">這點薪水憑什麼要我拚？</p>', body)
        self.assertIn('<h1>努力，<em>有回報嗎？</em></h1>', body)
        self.assertIn("<footer class=\"page-footer\"><strong>EP62</strong><span>這點薪水憑什麼要我拚？｜Z世代整頓職場，談談努力與回報的交換關係</span></footer>", body)
        self.assertNotRegex(body, r'<footer class="page-footer">(?:(?!</footer>).)*\d{2}\s*/\s*\d{2}')

    def test_score_total_sums_scored_single_choices(self):
        text = SOURCE.read_text(encoding="utf-8") + "\n### 評分（單選）\n\n- [ ] 選項 A（3 分）\n- [ ] 選項 B（1 分）\n\n<!-- score-total: 總得分 -->\n"
        self.assertEqual("pass", worksheet.lint_text(text)["status"])
        body = worksheet.render_document(text)[2]
        self.assertIn('data-score="3"', body)
        self.assertIn('data-score="1"', body)
        self.assertIn('data-score-total readonly', body)

    def test_with_arrow_marker_adds_the_prompt_arrow(self):
        text = SOURCE.read_text(encoding="utf-8") + "\n> 分數解讀。\n\n<!-- with-arrow -->\n> 小提醒。\n"
        self.assertEqual("pass", worksheet.lint_text(text)["status"])
        body = worksheet.render_document(text)[2]
        self.assertIn('<aside class="closing no-arrow"><p>分數解讀。</p></aside>', body)
        self.assertIn('<aside class="closing"><span class="closing-mark">→</span><p>小提醒。</p></aside>', body)


    def test_time_labels_preserve_task_meaning(self):
        original = SOURCE.read_text(encoding="utf-8")
        for label in (
            "實際完成時間（年／月／日、幾點幾分）",
            "預計完成日期（年／月／日）",
            "執行頻率（每週幾次）",
            "投入時間（幾分鐘）",
            "持續期間（幾週）",
        ):
            with self.subTest(label=label):
                text = original.replace("<!-- short-answer: 預計完成期限（年／月／日） -->", f"<!-- short-answer: {label} -->")
                self.assertEqual("pass", worksheet.lint_text(text)["status"])
                body = worksheet.render_document(text)[2]
                self.assertIn(f">{label}：</label>", body)
                self.assertNotIn("前完成這一步", body)
                self.assertNotIn("<span>我預計在</span>", body)


if __name__ == "__main__":
    unittest.main()
