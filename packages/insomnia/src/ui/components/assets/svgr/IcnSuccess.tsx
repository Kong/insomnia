import React, { SVGProps, memo } from 'react';
export const SvgIcnSuccess = memo<SVGProps<SVGSVGElement>>(props => (
  <svg
    viewBox="0 0 12 12"
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    role="img"
    {...props}
  >
    <circle cx={6} cy={6} r={6} opacity={0.9} />
    <path
      fill="#fff"
      d="m8.336 3.811.902.902L4.95 9C3.582 7.674 2.625 6.674 2.625 6.674l.902-.901 1.424 1.423 3.385-3.385Z"
    />
  </svg>
));
