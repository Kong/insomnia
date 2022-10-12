import React, { SVGProps, memo } from 'react';
export const SvgIcnInfo = memo<SVGProps<SVGSVGElement>>(props => (
  <svg
    width="1em"
    height="1em"
    viewBox="0 0 14 14"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    {...props}
  >
    <path
      d="M7 0a7 7 0 1 1 0 14A7 7 0 0 1 7 0Zm0 1.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM7.75 9v1.5h-1.5V9h1.5Zm0-5.5V8h-1.5V3.5h1.5Z"
      fill=""
      fillRule="nonzero"
    />
  </svg>
));
