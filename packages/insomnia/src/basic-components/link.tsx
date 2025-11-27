import { twMerge } from 'tailwind-merge';

import { Icon } from './icon';

interface LearnMoreLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}
export const LearnMoreLink = ({ href, children, className }: LearnMoreLinkProps) => {
  return (
    <a
      href={href}
      target="_blank"
      className={twMerge(
        'inline-flex items-center gap-1 border-b border-solid border-(--color-font) text-(--color-font) hover:no-underline!',
        className,
      )}
      rel="noreferrer"
    >
      {children}
      <Icon className="-rotate-45" icon="arrow-right" />
    </a>
  );
};
