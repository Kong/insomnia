import React, { SVGProps, memo } from 'react';
export const SvgIcnIndentation = memo<SVGProps<SVGSVGElement>>(props => (
  <svg
    width="1em"
    height="1em"
    viewBox="0 0 14 14"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    {...props}
  >
    <path fill="none" d="M0 0h14v14H0z" />
    <path d="M4.5 0v9.5H14V11H4.5A1.5 1.5 0 0 1 3 9.5V0h1.5Z" fill="" />
  </svg>
));
