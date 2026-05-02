import { rehypeInlineAds as rehypeInlineAdsPure } from './rehype-inline-ads.mjs';

interface HastNode {
  type: string;
  tagName?: string;
  name?: string;
  properties?: Record<string, unknown>;
  attributes?: unknown[];
  children?: HastNode[];
  value?: string;
}

interface VFile {
  history: string[];
  data?: {
    astro?: {
      frontmatter?: Record<string, unknown>;
    };
  };
}

type RehypeTransformer = (tree: HastNode, file: VFile) => void;
type RehypePlugin = () => RehypeTransformer;

export const rehypeInlineAds: RehypePlugin = rehypeInlineAdsPure;
