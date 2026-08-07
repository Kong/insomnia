// Common tailwind classes
export const ROW_CLASS =
  'relative flex h-(--line-height-xs) w-full items-center gap-1 overflow-hidden text-[rgba(var(--color-font-rgb),0.8)] outline-hidden transition-colors select-none group-hover:bg-(--hl-xs) group-aria-selected:bg-(--hl-xs) group-focus:bg-(--hl-sm) group-aria-selected:text-(--color-font) pr-4';

export const ACTIVE_BORDER_CLASS =
  'absolute top-0 left-0 h-full w-0.5 bg-transparent transition-colors group-aria-selected:bg-(--color-surprise)';
export const GUIDE_LINE_CSS = 'absolute inset-y-0 w-px bg-transparent transition-colors';

// for toggle button
export const TOGGLE_BTN_CLASS =
  'flex shrink-0 items-center justify-center text-base text-[rgba(var(--color-font-rgb),0.8)] hover:text-(--color-font) focus:outline-none w-4 h-4';
export const ICON_CLASS = 'h-3 w-3 shrink-0';

export const INDENT_PX = 16;
