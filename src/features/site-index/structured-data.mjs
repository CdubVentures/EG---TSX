// ─── Structured data builder — pure logic ────────────────────────────────────
// WHY: .mjs so node --test can import without Astro transpilation.
// Gateway: structured-data.ts re-exports with TS types.

function normalizeSiteUrl(siteUrl) {
  return siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
}

function toAbsoluteUrl(siteUrl, href, fallbackUrl) {
  if (!href) return fallbackUrl;
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  const normalizedSiteUrl = normalizeSiteUrl(siteUrl);
  const normalizedHref = href.startsWith('/') ? href : `/${href}`;
  return `${normalizedSiteUrl}${normalizedHref}`;
}

export function buildSiteIndexStructuredData({
  siteUrl,
  canonicalUrl,
  title,
  description,
  breadcrumbs,
}) {
  const normalizedSiteUrl = normalizeSiteUrl(siteUrl);
  const breadcrumbId = `${canonicalUrl}#breadcrumb`;

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      '@id': breadcrumbId,
      itemListElement: breadcrumbs.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.label,
        item: toAbsoluteUrl(siteUrl, crumb.href, canonicalUrl),
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': `${canonicalUrl}#collection-page`,
      url: canonicalUrl,
      name: title,
      description,
      inLanguage: 'en-US',
      isPartOf: { '@id': `${normalizedSiteUrl}/#website` },
      publisher: { '@id': `${normalizedSiteUrl}/#organization` },
      breadcrumb: { '@id': breadcrumbId },
    },
  ];
}
