import React, { SVGProps, memo } from 'react';
export const SvgIcnKey = memo<SVGProps<SVGSVGElement>>(props => (
  <svg
    width="1em"
    height="1em"
    viewBox="0 0 12 12"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M5.621 7.5l3 3H10.5v-1h-1v-1h-1v-1h-1V3A1.5 1.5 0 006 1.5H3A1.5 1.5 0 001.5 3v3A1.5 1.5 0 003 7.5h2.621zM12 8v3a1 1 0 01-1 1H8L5 9H3a3 3 0 01-3-3V3a3 3 0 013-3h3a3 3 0 013 3v3h1v1h1v1h1zM2.5 3.5a1 1 0 102 0 1 1 0 00-2 0z"
    />
  </svg>
));
