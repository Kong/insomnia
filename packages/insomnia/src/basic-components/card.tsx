import { twMerge } from 'tailwind-merge';

export const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return <div className={twMerge('rounded-sm border border-(--hl-sm) p-6', className)}>{children}</div>;
};
