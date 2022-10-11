import React, { SVGProps, memo } from 'react';
export const SvgIcnInfo = memo<SVGProps<SVGSVGElement>>(props => (
  <svg
    width="1em"
    height="1em"
    viewBox="0 0 14 14"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M7 0a7 7 0 110 14A7 7 0 017 0zm0 1.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM7.75 9v1.5h-1.5V9h1.5zm0-5.5V8h-1.5V3.5h1.5z"
      fill=""
      fillRule="nonzero"
    />
  </svg>
));
