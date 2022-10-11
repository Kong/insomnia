import React, { SVGProps, memo } from 'react';
export const SvgIcnElevator = memo<SVGProps<SVGSVGElement>>(props => (
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
      d="M2 6l5-5 5 5H2zM12 8l-5 5-5-5h10z"
      fill=""
    />
  </svg>
));
