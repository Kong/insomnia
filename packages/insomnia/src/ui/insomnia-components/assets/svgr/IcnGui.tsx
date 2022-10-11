import React, { SVGProps, memo } from 'react';
export const SvgIcnGui = memo<SVGProps<SVGSVGElement>>(props => (
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
      d="M12 0a2 2 0 012 2v10a2 2 0 01-2 2H2a2 2 0 01-2-2V2a2 2 0 012-2h10zm.5 4.5h-11V12a.5.5 0 00.41.492L2 12.5h10a.5.5 0 00.492-.41L12.5 12V4.5zM2 1.5h1V3H1.5V2l.008-.09A.5.5 0 012 1.5zm4 0H4.5V3H6V1.5zm1.5 0H12l.09.008A.5.5 0 0112.5 2v1h-5V1.5z"
      fill=""
    />
  </svg>
));
