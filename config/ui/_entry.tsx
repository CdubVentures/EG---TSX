import { createRoot } from 'react-dom/client';

import { ConfigDesktopApp } from './app';

const root = document.getElementById('root');

if (root) {
  createRoot(root).render(<ConfigDesktopApp />);
}
