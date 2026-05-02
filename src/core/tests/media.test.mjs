import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

let importCounter = 0;

async function freshMedia() {
  importCounter++;
  return import(`../media.ts?test=${importCounter}`);
}

function baseMedia(overrides = {}) {
  return {
    defaultColor: 'white',
    colors: ['white', 'black'],
    editions: [],
    images: [],
    ...overrides,
  };
}

describe('core/media image resolver', () => {
  it('picks right before top for mouse fallback chains when right exists', async () => {
    const { getImageWithFallback } = await freshMedia();
    const media = baseMedia({
      images: [
        { stem: 'top---white', view: 'top', color: 'white' },
        { stem: 'right---white', view: 'right', color: 'white' },
        { stem: 'sangle---white', view: 'sangle', color: 'white' },
      ],
    });

    const image = getImageWithFallback(media, ['right', 'top', 'left', 'sangle']);
    assert.equal(image?.stem, 'right---white');
  });

  it('falls back to top when right is missing', async () => {
    const { getImageWithFallback } = await freshMedia();
    const media = baseMedia({
      images: [
        { stem: 'top---white+black', view: 'top', color: 'white+black' },
        { stem: 'sangle', view: 'sangle' },
      ],
      defaultColor: 'white+black',
      colors: ['white+black'],
    });

    const image = getImageWithFallback(media, ['right', 'top', 'left', 'sangle']);
    assert.equal(image?.stem, 'top---white+black');
  });

  it('prefers editionless image when defaultEdition is not set', async () => {
    const { getImage } = await freshMedia();
    const media = baseMedia({
      images: [
        { stem: 'top___limited---white', view: 'top', color: 'white', edition: 'limited' },
        { stem: 'top---white', view: 'top', color: 'white' },
      ],
      editions: ['limited'],
    });

    const image = getImage(media, 'top');
    assert.equal(image?.stem, 'top---white');
  });

  it('uses alphabetical edition fallback when only editioned images exist', async () => {
    const { getImage } = await freshMedia();
    const media = baseMedia({
      images: [
        { stem: 'top___zeta---white', view: 'top', color: 'white', edition: 'zeta' },
        { stem: 'top___alpha---white', view: 'top', color: 'white', edition: 'alpha' },
      ],
      editions: ['alpha', 'zeta'],
    });

    const image = getImage(media, 'top');
    assert.equal(image?.stem, 'top___alpha---white');
  });

  it('honors media.defaultEdition when present', async () => {
    const { getImage } = await freshMedia();
    const media = baseMedia({
      defaultEdition: 'zeta',
      images: [
        { stem: 'top___alpha---white', view: 'top', color: 'white', edition: 'alpha' },
        { stem: 'top___zeta---white', view: 'top', color: 'white', edition: 'zeta' },
      ],
      editions: ['alpha', 'zeta'],
    });

    const image = getImage(media, 'top');
    assert.equal(image?.stem, 'top___zeta---white');
  });
});
