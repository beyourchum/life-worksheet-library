import json
import shutil
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SITE_SCRIPT = ROOT / "site" / "assets" / "site.js"
SITE_INDEX = ROOT / "site" / "index.html"
SITE_DATA = ROOT / "site" / "worksheets.json"
SEARCH_CONFIG = ROOT / "site" / "search-config.json"
SEARCH_CORE = ROOT / "site" / "assets" / "search-core.js"
SEARCH_CASES = ROOT / "tests" / "fixtures" / "site_search_cases.json"


class SiteContractTests(unittest.TestCase):
    def test_search_core_loads_before_site_script(self):
        source = SITE_INDEX.read_text(encoding="utf-8")

        self.assertLess(
            source.index("assets/search-core.js"),
            source.index("assets/site.js"),
        )

    def test_index_rows_do_not_render_category(self):
        source = SITE_SCRIPT.read_text(encoding="utf-8")
        create_result = source.split("function createResult", 1)[1].split("function render()", 1)[0]

        self.assertNotIn("item.category", create_result)

    def test_index_has_no_empty_detail_column(self):
        script = SITE_SCRIPT.read_text(encoding="utf-8")
        index = SITE_INDEX.read_text(encoding="utf-8")
        create_result = script.split("function createResult", 1)[1].split("function render()", 1)[0]

        self.assertNotIn("<span>DETAIL</span>", index)
        self.assertNotIn("result-detail", create_result)
        self.assertIn("result-match", create_result)

    def test_category_remains_search_and_filter_metadata(self):
        script = SITE_SCRIPT.read_text(encoding="utf-8")
        search_core = SEARCH_CORE.read_text(encoding="utf-8")

        self.assertIn("item.category", search_core)
        self.assertIn("categoryLabels", script)

    def test_search_supports_normalization_synonyms_scoring_and_related_fallback(self):
        source = SEARCH_CORE.read_text(encoding="utf-8")

        self.assertIn("normalize('NFKC')", source)
        self.assertIn("synonymGroups", source)
        self.assertIn("weights.searchTerms", source)
        self.assertIn("matchMode = 'related'", source)

    def test_search_copy_explains_multiple_terms_and_empty_recovery(self):
        source = SITE_INDEX.read_text(encoding="utf-8")

        self.assertIn("可輸入多個詞", source)
        self.assertIn("請換個說法或改選主題", source)

    def test_search_terms_follow_the_public_index_contract(self):
        worksheets = json.loads(SITE_DATA.read_text(encoding="utf-8"))
        expected_kinds = {"situations", "feelings", "decisions", "phrases", "concepts"}

        for item in worksheets:
            with self.subTest(ep=item["ep"]):
                self.assertNotIn("keywords", item)
                self.assertEqual(set(item["searchTerms"]), expected_kinds)
                flattened = [term.strip() for terms in item["searchTerms"].values() for term in terms]
                self.assertTrue(all(len(term) >= 2 for term in flattened))
                self.assertEqual(len(flattened), len(set(flattened)))
                self.assertGreaterEqual(len(item["searchTerms"]["situations"]), 2)
                self.assertGreaterEqual(len(item["searchTerms"]["feelings"]), 2)
                self.assertGreaterEqual(len(item["searchTerms"]["decisions"]), 2)

    def test_search_config_matches_search_term_kinds(self):
        config = json.loads(SEARCH_CONFIG.read_text(encoding="utf-8"))

        self.assertEqual(
            set(config["weights"]["searchTerms"]),
            {"situations", "feelings", "decisions", "phrases", "concepts"},
        )

    def test_search_ranking_cases_use_the_production_algorithm(self):
        node = shutil.which("node")
        self.assertIsNotNone(node, "Node.js is required to verify browser search ranking cases.")
        completed = subprocess.run(
            [node, str(ROOT / "tests" / "search-ranking.test.js")],
            cwd=ROOT,
            capture_output=True,
            text=True,
            encoding="utf-8",
            check=False,
        )

        self.assertEqual(completed.returncode, 0, completed.stderr or completed.stdout)
        expected_count = len(json.loads(SEARCH_CASES.read_text(encoding="utf-8")))
        self.assertIn(f"Verified {expected_count} search ranking cases.", completed.stdout)


if __name__ == "__main__":
    unittest.main()
