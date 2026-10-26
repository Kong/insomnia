import { Button as BasicButton } from '~/basic-components/button';

import { Icon } from '../../../icon';

export const NewProjectButton = ({ onPress, isDisabled }: { onPress: () => void; isDisabled?: boolean }) => (
  <BasicButton
    aria-label="Create new Project"
    onPress={onPress}
    isDisabled={isDisabled}
    className="flex h-full items-center justify-center gap-1 rounded-xs px-2 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
  >
    <Icon icon="plus" className="h-2.5 w-2.5" />
    <span>New Project</span>
  </BasicButton>
);
