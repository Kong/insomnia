import classNames from 'classnames';

interface Props {
  percent: number;
  className?: string;
  status?: 'success' | 'error' | 'normal';
}

export const Progress = ({ className, percent, status }: Props) => {
  return (
    <div
      // FIXME: use css variables for colors
      className={classNames(
        'h-[10px] grow overflow-hidden rounded-full bg-[#f1e6ff]',
        status === 'error' && 'bg-[#db110040]',
        status === 'success' && 'bg-[#00bf7340]',
        className,
      )}
    >
      <div
        className={classNames(
          'transition-width h-full rounded-full bg-(--color-surprise) duration-1000 ease-in-out',
          status === 'error' && 'bg-(--color-danger)',
          status === 'success' && 'bg-(--color-success)',
        )}
        style={{
          width: `${percent}%`,
        }}
      />
    </div>
  );
};
