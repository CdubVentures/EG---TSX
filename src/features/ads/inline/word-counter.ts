import { countWords as countWordsPure } from './word-counter.mjs';

interface HastText {
  type: 'text';
  value: string;
}

interface HastElement {
  type: 'element';
  tagName: string;
  children?: HastNode[];
}

interface HastRoot {
  type: 'root';
  children: HastNode[];
}

type HastNode = HastText | HastElement | HastRoot | { type: string; children?: HastNode[] };

export const countWords: (tree: HastNode) => number = countWordsPure;
