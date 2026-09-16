import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SITE_SCRIPT = ROOT / "site" / "assets" / "site.js"
SITE_INDEX = ROOT / "site" / "index.html"
SITE_DATA = ROOT / "site" / "worksheets.json"


class SiteContractTests(unittest.TestCase):
    def test_index_rows_do_not_render_category(self):
        source = SITE_SCRIPT.read_text(encoding="utf-8")
        create_result = source.split("function createResult", 1)[1].split("function render()", 1)[0]

        self.assertNotIn("item.category", create_result)

    def test_category_remains_search_and_filter_metadata(self):
        source = SITE_SCRIPT.read_text(encoding="utf-8")

        self.assertIn("item.category", source)
        self.assertIn("categoryLabels", source)

    def test_search_supports_normalization_synonyms_scoring_and_related_fallback(self):
        source = SITE_SCRIPT.read_text(encoding="utf-8")

        self.assertIn("normalize('NFKC')", source)
        self.assertIn("synonymGroups", source)
        self.assertIn("score += 50", source)
        self.assertIn("matchMode = 'related'", source)

    def test_search_copy_explains_multiple_terms_and_empty_recovery(self):
        source = SITE_INDEX.read_text(encoding="utf-8")

        self.assertIn("可輸入多個詞", source)
        self.assertIn("請換個說法或改選主題", source)

    def test_ep108_search_keywords_describe_communication(self):
        source = SITE_DATA.read_text(encoding="utf-8")
        ep108 = source.split('"ep": "EP108"', 1)[1].split('"ep": "EP109"', 1)[0]

        self.assertIn('"溝通"', ep108)
        self.assertNotIn('"粉籍"', ep108)


if __name__ == "__main__":
    unittest.main()
