function numberedHtmlHeadings(html) {
  return [...html.matchAll(/<h3(?:\s+[^>]*)?>\s*(\d+[.、]\s*[^<]*)/g)].map((match) => match[1].trim());
}

function numberedMarkdownHeadings(markdown) {
  return [...markdown.matchAll(/^###\s+(\d+[.、]\s*.+)$/gm)].map((match) => match[1].trim());
}

module.exports = { numberedHtmlHeadings, numberedMarkdownHeadings };
