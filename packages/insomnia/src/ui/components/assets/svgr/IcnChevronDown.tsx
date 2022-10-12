import React, { SVGProps, memo } from 'react';
export const SvgIcnChevronDown = memo<SVGProps<SVGSVGElement>>(props => (
  <svg
    width="1em"
    height="1em"
    viewBox="0 0 10 10"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    {...props}
  >
    <path d="M1 2 0 3l5 5 5-5-1-1-4 4-4-4Z" />
  </svg>
));
