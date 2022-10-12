import React, { SVGProps, memo } from 'react';
export const SvgIcnClock = memo<SVGProps<SVGSVGElement>>(props => (
  <svg
    width="1em"
    height="1em"
    viewBox="0 0 12 12"
    xmlns="http://www.w3.org/2000/svg"
    style={{
      fillRule: 'evenodd',
      clipRule: 'evenodd',
      strokeLinejoin: 'round',
      strokeMiterlimit: 2,
    }}
    role="img"
    {...props}
  >
    <path d="M6 0a6 6 0 1 1 0 12A6 6 0 0 1 6 0Zm0 1.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9ZM6.5 3v2.5H9V7H5V3h1.5Z" />
  </svg>
));
