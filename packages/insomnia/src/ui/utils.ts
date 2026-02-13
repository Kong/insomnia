import type { PressEvent } from 'react-aria';

import { isMac } from '~/common/constants';

export const isPrimaryClickModifier = (e: React.MouseEvent | MouseEvent | PressEvent) => {
  return isMac() ? e.metaKey : e.ctrlKey;
};
