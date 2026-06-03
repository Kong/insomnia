import { isMac } from 'insomnia-data/common';
import type { PressEvent } from 'react-aria';

export const isPrimaryClickModifier = (e: React.MouseEvent | MouseEvent | PressEvent) => {
  return isMac ? e.metaKey : e.ctrlKey;
};
