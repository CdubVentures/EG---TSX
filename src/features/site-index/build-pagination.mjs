// build-pagination.mjs — Pure pagination builder
// Port of HBS buildPagination() from site_index.routes.js
// .mjs gateway: importable by node --test without transpilation

/**
 * @param {{ baseUrl: string, current: number, total: number }} opts
 * @returns {{ pages: Array<{num: number|string, url: string, active?: boolean, ellipsis?: boolean}>, prevUrl: string, nextUrl: string, total: number, current: number, baseUrl: string }}
 */
export function buildPagination({ baseUrl, current, total }) {
  const base = baseUrl.replace(/\/+$/, '');
  const makeUrl = (n) => n <= 1 ? `${base}/` : `${base}/page/${n}/`;

  const pages = [];

  function add(num, active = false) {
    pages.push({ num, url: makeUrl(num), active, ellipsis: false });
  }

  if (total <= 7) {
    for (let i = 1; i <= total; i++) add(i, i === current);
  } else {
    add(1, current === 1);
    add(2, current === 2);

    if (current > 4) {
      pages.push({ ellipsis: true, num: '…', url: '' });
    }

    const start = Math.max(3, current - 1);
    const end = Math.min(total - 2, current + 1);
    for (let i = start; i <= end; i++) add(i, i === current);

    if (current < total - 3) {
      pages.push({ ellipsis: true, num: '…', url: '' });
    }

    add(total - 1, current === total - 1);
    add(total, current === total);
  }

  const prevUrl = current > 1 ? makeUrl(current - 1) : '';
  const nextUrl = current < total ? makeUrl(current + 1) : '';

  return { pages, prevUrl, nextUrl, total, current, baseUrl };
}
