export type Size = 'sm' | 'md' | 'lg';
export type ButtonColor = 'primary' | 'danger' | 'default';

export function getSizeClasses(size: Size) {
  return {
    sm: 'h-7 px-2 text-sm gap-1 rounded-sm',
    md: 'h-8 px-3 text-base gap-2 rounded-md',
    lg: 'h-9 px-4 text-lg gap-3 rounded-lg',
  }[size];
}

export function getStateClasses() {
  return 'box-border data-[focus-visible=true]:ring-2 disabled:cursor-not-allowed';
}

export function getTextColorClasses(color: ButtonColor) {
  return {
    primary: 'text-(--color-font-surprise)',
    danger: 'text-(--color-font-danger)',
    default: 'text-(--color-font)',
  }[color];
}

export function getBorderColorClasses(color: ButtonColor) {
  return {
    primary: '',
    danger: '',
    default: 'border border-[--hl]',
  }[color];
}

export function getBackgroundColorClasses(color: ButtonColor) {
  return {
    primary: 'bg-(--color-surprise) data-disabled:bg-(--color-surprise)/50 data-hovered:bg-(--color-surprise)/80',
    danger: 'bg-(--color-danger) data-disabled:bg-(--color-danger)/50 data-hovered:bg-(--color-danger)/80',
    default: 'bg-transparent',
  }[color];
}
