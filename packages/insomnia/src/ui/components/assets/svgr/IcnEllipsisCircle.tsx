import React, { SVGProps, memo } from 'react';
export const SvgIcnEllipsisCircle = memo<SVGProps<SVGSVGElement>>(props => (
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
      d="M8 7a1 1 0 11-2 0 1 1 0 012 0zM10 8a1 1 0 100-2 1 1 0 000 2zM5 7a1 1 0 11-2 0 1 1 0 012 0z"
      fill=""
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M7 0a7 7 0 110 14A7 7 0 017 0zm0 1.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11z"
      fill=""
    />
  </svg>
));
