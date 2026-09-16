import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SITE_SCRIPT = ROOT / "site" / "assets" / "site.js"


class SiteContractTests(unittest.TestCase):
    def test_index_rows_do_not_render_category(self):
        source = SITE_SCRIPT.read_text(encoding="utf-8")
        create_result = source.split("function createResult", 1)[1].split("function render()", 1)[0]

        self.assertNotIn("item.category", create_result)

    def test_category_remains_search_and_filter_metadata(self):
        source = SITE_SCRIPT.read_text(encoding="utf-8")

        self.assertIn("item.category", source.split("function render()", 1)[1])
        self.assertIn("categoryLabels", source)


if __name__ == "__main__":
    unittest.main()
