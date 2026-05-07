// ─── Games structured data — pure logic ──────────────────────────────────────
// Port of EG-HBS routes/site_index_games.routes.js `jsonLdCollection` (lines 339-373).
// Emits CollectionPage + BreadcrumbList + ItemList<VideoGame>.

function normalizeSiteUrl(siteUrl) {
  return String(siteUrl ?? '').replace(/\/+$/, '');
}

function abs(siteUrl, u) {
  const base = normalizeSiteUrl(siteUrl);
  const s = String(u ?? '');
  if (/^https?:\/\//i.test(s)) return s;
  return s.startsWith('/') ? `${base}${s}` : `${base}/${s}`;
}

/**
 * @param {{
 *   siteUrl: string,
 *   canonicalUrl: string,
 *   title: string,
 *   description: string,
 *   breadcrumbs: Array<{ label: string, href?: string }>,
 *   items: Array<{ slug: string, name: string, url: string, boxCoverArt: string }>,
 * }} opts
 * @returns {object[]} JSON-LD objects (caller serializes)
 */
export function buildGamesStructuredData({
  siteUrl,
  canonicalUrl,
  title,
  description,
  breadcrumbs,
  items,
}) {
  const breadcrumbId = `${canonicalUrl}#breadcrumb`;

  const breadcrumbList = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': breadcrumbId,
    itemListElement: breadcrumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.label,
      item: abs(siteUrl, crumb.href || canonicalUrl),
    })),
  };

  const videoGames = (items || []).map((it, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    item: {
      '@type': 'VideoGame',
      '@id': abs(siteUrl, it.url),
      url: abs(siteUrl, it.url),
      name: it.name,
      image: abs(siteUrl, `${it.boxCoverArt}_l.webp`),
    },
  }));

  const collectionPage = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${canonicalUrl}#collection-page`,
    name: title,
    description,
    url: canonicalUrl,
    inLanguage: 'en',
    isPartOf: { '@type': 'WebSite', name: 'EG Gear', url: `${normalizeSiteUrl(siteUrl)}/` },
    mainEntity: {
      '@type': 'ItemList',
      itemListOrder: 'https://schema.org/ItemListOrderAscending',
      numberOfItems: videoGames.length,
      itemListElement: videoGames,
    },
    breadcrumb: { '@id': breadcrumbId },
  };

  return [breadcrumbList, collectionPage];
}
