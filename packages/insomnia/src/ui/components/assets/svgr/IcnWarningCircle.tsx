import React, { SVGProps, memo } from 'react';
export const SvgIcnWarningCircle = memo<SVGProps<SVGSVGElement>>(props => (
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
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M14 7A7 7 0 1 0 0 7a7 7 0 0 0 14 0ZM1.5 7a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0ZM8 3.5 7.75 8h-1.5L6 3.5h2Zm-.25 7V9h-1.5v1.5h1.5Z"
      fill=""
    />
  </svg>
));
