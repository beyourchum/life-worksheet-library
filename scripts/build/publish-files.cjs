function publicPath(file, directory = false) {
  file = file.replaceAll('\\', '/');
  if (directory) return ['data', 'worksheets', 'articles', 'assets'].includes(file) ||
    /^worksheets\/EP\d+$/.test(file) ||
    /^articles\/(?:[^./][^/]*\/)*[^./][^/]*$/.test(file) ||
    /^assets\/fonts(?:\/worksheet(?:\/compact(?:\/(?:EP\d+|home))?)?)?$/.test(file);
  return ['index.html', '404.html', '.nojekyll', 'CNAME'].includes(file) ||
    /^data\/(?:catalog|search-index)\.json$/.test(file) ||
    /^worksheets\/EP\d+\/(?:index\.html|metadata\.json)$/.test(file) ||
    /^articles\/(?:[^./][^/]*\/)*[^/]+\.(?:html|png|jpe?g|webp|gif|svg)$/.test(file) ||
    /^assets\/[^/]+\.(?:css|js)$/.test(file) ||
    /^assets\/fonts\/worksheet\/compact\/(?:EP\d+|home)\/(?:fonts\.css|[^/]+\.woff2)$/.test(file);
}

module.exports = { publicPath };
