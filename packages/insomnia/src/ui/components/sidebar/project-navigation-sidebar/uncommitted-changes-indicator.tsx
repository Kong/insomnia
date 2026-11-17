import { Icon } from '../../icon';

export const UncommittedChangesIndicator = () => (
  <div className="flex aspect-square h-6 shrink-0 items-center justify-center">
    <Icon icon="circle" className="h-2 w-2" color="var(--color-warning)" />
  </div>
);
