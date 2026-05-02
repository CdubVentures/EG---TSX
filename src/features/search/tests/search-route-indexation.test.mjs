import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

let importCounter = 0;

async function freshSearchRoute() {
  importCounter += 1;
  return import(`../../../pages/api/search.ts?test=${importCounter}`);
}

describe('search route indexation', () => {
  it('marks the search endpoint as noindex even when returning early', async () => {
    const { GET } = await freshSearchRoute();
    const response = await GET({
      url: new URL('http://localhost:4321/api/search?q='),
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('X-Robots-Tag'), 'noindex,nofollow');
  });
});
