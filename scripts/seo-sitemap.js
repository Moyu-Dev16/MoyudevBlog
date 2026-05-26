'use strict';

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toIsoDate(value) {
  const date = value && value.toDate ? value.toDate() : new Date(value || Date.now());
  return date.toISOString();
}

function normalizeBaseUrl(hexo) {
  return String(hexo.config.url || '').replace(/\/+$/, '');
}

function normalizePath(path) {
  return String(path || '')
    .replace(/^\/+/, '')
    .replace(/index\.html$/, '');
}

function shouldSkip(path) {
  const normalized = normalizePath(path);
  return /^google[^/]*\.html$/i.test(normalized)
    || /^baidu[^/]*\.html$/i.test(normalized);
}

function collectUrls(hexo, locals) {
  const baseUrl = normalizeBaseUrl(hexo);
  const urls = [];
  const seen = new Set();

  function add(path, updated, priority) {
    const normalized = normalizePath(path);
    if (shouldSkip(normalized)) return;
    const loc = `${baseUrl}/${normalized}`;
    if (seen.has(loc)) return;
    seen.add(loc);
    urls.push({
      loc,
      lastmod: toIsoDate(updated),
      priority
    });
  }

  add('', Date.now(), '1.0');

  locals.posts.sort('-date').forEach(post => {
    add(post.path, post.updated || post.date, '0.8');
  });

  locals.pages.sort('path').forEach(page => {
    add(page.path, page.updated || page.date, '0.6');
  });

  locals.categories.forEach(category => {
    add(category.path, Date.now(), '0.5');
  });

  locals.tags.forEach(tag => {
    add(tag.path, Date.now(), '0.5');
  });

  add('archives/', Date.now(), '0.5');

  return urls;
}

function buildSitemap(urls) {
  const body = urls.map(item => [
    '  <url>',
    `    <loc>${escapeXml(item.loc)}</loc>`,
    `    <lastmod>${item.lastmod}</lastmod>`,
    '    <changefreq>weekly</changefreq>',
    `    <priority>${item.priority}</priority>`,
    '  </url>'
  ].join('\n')).join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    body,
    '</urlset>'
  ].join('\n');
}

hexo.extend.generator.register('seo_sitemap', function(locals) {
  const urls = collectUrls(hexo, locals);
  const sitemap = buildSitemap(urls);

  return [
    {
      path: 'sitemap.xml',
      data: sitemap
    },
    {
      path: 'baidusitemap.xml',
      data: sitemap
    }
  ];
});
