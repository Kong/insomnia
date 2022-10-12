import React, { SVGProps, memo } from 'react';
export const SvgIcnWarning = memo<SVGProps<SVGSVGElement>>(props => (
  <svg
    width="1em"
    height="1em"
    viewBox="0 0 12 12"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    {...props}
  >
    <path d="M.096 10.546c-.212.482-.061 1.08.337 1.338.119.076.251.116.385.116h10.364c.452 0 .818-.443.818-.989 0-.162-.033-.322-.096-.465L7.27.916C6.829 0 5.903-.274 5.2.302c-.19.157-.351.367-.47.616L.095 10.546Z" />
    <path
      className="icn-warning_svg__fill-notice-fg"
      d="M6.5 8a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h1Zm0-5a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-3a.5.5 0 0 1 .5-.5h1Z"
      fill="currentColor"
      opacity={0.9}
    />
  </svg>
));
