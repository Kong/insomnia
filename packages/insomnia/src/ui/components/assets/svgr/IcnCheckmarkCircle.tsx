import React, { SVGProps, memo } from 'react';
export const SvgIcnCheckmarkCircle = memo<SVGProps<SVGSVGElement>>(props => (
  <svg
    width="1em"
    height="1em"
    viewBox="0 0 14 14"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    {...props}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M14 7A7 7 0 1 0 0 7a7 7 0 0 0 14 0ZM1.5 7a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0Zm9.03-1.47L9.47 4.47 6 7.94 4.53 6.47 3.47 7.53 6 10.06l4.53-4.53Z"
      fill="#12C76C"
    />
  </svg>
));
