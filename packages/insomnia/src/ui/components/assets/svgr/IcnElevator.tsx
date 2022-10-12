import React, { SVGProps, memo } from 'react';
export const SvgIcnElevator = memo<SVGProps<SVGSVGElement>>(props => (
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
      d="m2 6 5-5 5 5H2ZM12 8l-5 5-5-5h10Z"
      fill=""
    />
  </svg>
));
