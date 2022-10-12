import React, { SVGProps, memo } from 'react';
export const SvgIcnEllipsisCircle = memo<SVGProps<SVGSVGElement>>(props => (
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
      d="M8 7a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM10 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM5 7a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"
      fill=""
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M7 0a7 7 0 1 1 0 14A7 7 0 0 1 7 0Zm0 1.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z"
      fill=""
    />
  </svg>
));
