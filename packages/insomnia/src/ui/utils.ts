import type { PressEvent } from 'react-aria';

import { isMac } from '~/insomnia-data/common';

export const isPrimaryClickModifier = (e: React.MouseEvent | MouseEvent | PressEvent) => {
  return isMac ? e.metaKey : e.ctrlKey;
};
