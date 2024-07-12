import React from 'react';

export const InsomniaLogo = ({
  loading,
  ...props
}: {
  loading?: boolean;
} & React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 128 128"
    width="28px"
    xmlns="http://www.w3.org/2000/svg"
    fillRule="evenodd"
    clipRule="evenodd"
    strokeLinejoin="round"
    strokeMiterlimit={2}
    style={{
      zIndex: 1,
    }}
    {...props}
  >
    <path
      d="M16 32.187c8.387 0 15.186-6.8 15.186-15.187S24.387 1.814 16 1.814.813 8.613.813 17 7.613 32.187 16 32.187z"
      fill="#fff"
      fillRule="nonzero"
      transform="translate(-448 -236) translate(448.128 232.136) scale(3.99198)"
    />
    <path
      d="M16 1C7.163 1 0 8.163 0 17s7.163 16 16 16 16-7.163 16-16S24.837 1 16 1zm0 1.627c7.938 0 14.373 6.435 14.373 14.373S23.938 31.373 16 31.373 1.627 24.938 1.627 17 8.062 2.627 16 2.627z"
      fill="#4000bf"
      fillRule="nonzero"
      transform="translate(-448 -236) translate(448.128 232.136) scale(3.99198)"
    />
    <path
      d="M16.181 5.61c6.29 0 11.39 5.1 11.39 11.39 0 6.291-5.1 11.39-11.39 11.39-6.291 0-11.39-5.099-11.39-11.39 0-1.537.305-3.004.857-4.341a4.43 4.43 0 106.191-6.192 11.362 11.362 0 014.342-.857z"
      fill="url(#_Linear1)"
      transform="translate(-448 -236) translate(448.128 232.136) scale(3.99198)"
    >
      {loading && (
        <animate
          attributeName="opacity"
          values="0.4;1;0.4"
          dur="4s"
          repeatCount="indefinite"
        />
      )}
    </path>
    <defs>
      <linearGradient
        id="_Linear1"
        x1={0}
        y1={0}
        x2={1}
        y2={0}
        gradientUnits="userSpaceOnUse"
        gradientTransform="rotate(-90 22.285 6.105) scale(22.7797)"
      >
        <stop offset={0} stopColor="#7400e1" />
        <stop offset={1} stopColor="#4000bf" />
      </linearGradient>
    </defs>
  </svg>
);
