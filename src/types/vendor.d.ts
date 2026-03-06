// WHY: typed window.VanillaTilt eliminates `(window as any).VanillaTilt` casts
// in NavLinks.astro and GamesScroller.astro inline scripts.

interface VanillaTiltOptions {
  max?: number;
  speed?: number;
  scale?: number;
  perspective?: number;
  glare?: boolean;
  'max-glare'?: number;
}

interface VanillaTiltStatic {
  init(elements: HTMLElement[], options?: VanillaTiltOptions): void;
}

interface Window {
  VanillaTilt?: VanillaTiltStatic;
}
