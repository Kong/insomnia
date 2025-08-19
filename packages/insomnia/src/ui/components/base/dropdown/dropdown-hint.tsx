import type { PlatformKeyCombinations } from '../../../../common/settings';
import { Hotkey } from '../../hotkey';

interface Props {
  keyBindings: PlatformKeyCombinations;
}

export const DropdownHint = (props: Props) => {
  return <Hotkey className="ml-auto pl-[--padding-lg] text-[--hl-xl]" keyBindings={props.keyBindings} />;
};
