import React, { SVGProps, memo } from 'react';
export const SvgIcnPlaceholder = memo<SVGProps<SVGSVGElement>>(props => (
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
      d="M0 1.5A1.5 1.5 0 011.5 0H4v1.5H1.5V4H0V1.5zM7 5.94L5.53 4.47 4.47 5.53 5.94 7 4.47 8.47l1.06 1.06L7 8.06l1.47 1.47 1.06-1.06L8.06 7l1.47-1.47-1.06-1.06L7 5.94zM1.5 6H0v2h1.5V6zM12.5 6H14v2h-1.5V6zM1.5 14A1.5 1.5 0 010 12.5V10h1.5v2.5H4V14H1.5zM12.5 0A1.5 1.5 0 0114 1.5V4h-1.5V1.5H10V0h2.5zM14 12.5a1.5 1.5 0 01-1.5 1.5H10v-1.5h2.5V10H14v2.5zM6 0h2v1.5H6V0zM8 14v-1.5H6V14h2z"
      fill=""
    />
  </svg>
));
