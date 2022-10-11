import React, { SVGProps, memo } from 'react';
export const SvgIcnWarningCircle = memo<SVGProps<SVGSVGElement>>(props => (
  <svg
    width="1em"
    height="1em"
    viewBox="0 0 14 14"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path fill="none" d="M0 0h14v14H0z" />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M14 7A7 7 0 100 7a7 7 0 0014 0zM1.5 7a5.5 5.5 0 1111 0 5.5 5.5 0 01-11 0zM8 3.5L7.75 8h-1.5L6 3.5h2zm-.25 7V9h-1.5v1.5h1.5z"
      fill=""
    />
  </svg>
));
