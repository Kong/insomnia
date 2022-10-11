import React, { SVGProps, memo } from 'react';
export const SvgIcnClock = memo<SVGProps<SVGSVGElement>>(props => (
  <svg
    width="1em"
    height="1em"
    viewBox="0 0 12 12"
    xmlns="http://www.w3.org/2000/svg"
    fillRule="evenodd"
    clipRule="evenodd"
    strokeLinejoin="round"
    strokeMiterlimit={2}
    {...props}
  >
    <path d="M6 0a6 6 0 110 12A6 6 0 016 0zm0 1.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9zM6.5 3v2.5H9V7H5V3h1.5z" />
  </svg>
));
