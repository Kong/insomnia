import { twMerge } from 'tailwind-merge';

interface LearnMoreLinkProps {
  href: string;
  children?: React.ReactNode;
  className?: string;
}
export const LearnMoreLink = ({ href, children = 'Learn more ↗', className }: LearnMoreLinkProps) => {
  return (
    <a
      href={href}
      className={twMerge('inline-flex items-center gap-1 text-(--color-font) underline', className)}
      rel="noreferrer"
    >
      {children}
    </a>
  );
};
