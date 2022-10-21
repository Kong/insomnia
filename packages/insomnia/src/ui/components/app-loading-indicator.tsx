import React from 'react';

export const AppLoadingIndicator = () => (
  <div
    id="app-loading-indicator"
    style={{
      position: 'fixed',
      top: '0',
      left: '0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      width: '100%',
    }}
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={32}
      height={32}
      viewBox="0 0 32 32"
      fill="none"
    >
      <path
        d="M16 31.186c8.387 0 15.186-6.799 15.186-15.186S24.387.814 16 .814.814 7.613.814 16 7.613 31.186 16 31.186z"
        fill="#fff"
      />
      <path
        d="M16 0C7.163 0 0 7.163 0 16s7.163 16 16 16 16-7.163 16-16S24.837 0 16 0zm0 1.627c7.938 0 14.373 6.435 14.373 14.373S23.938 30.373 16 30.373 1.627 23.938 1.627 16 8.062 1.627 16 1.627z"
        fill="#4000BF"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M16.18 4.61c6.291 0 11.39 5.1 11.39 11.39 0 6.29-5.099 11.39-11.39 11.39-6.29 0-11.39-5.1-11.39-11.39 0-1.537.305-3.004.858-4.342a4.43 4.43 0 106.192-6.192 11.357 11.357 0 014.34-.856z"
        fill="url(#paint0_linear)"
      />
      <defs>
        <linearGradient
          id="paint0_linear"
          x1={16.1807}
          y1={27.3898}
          x2={16.1807}
          y2={4.61017}
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#7400E1" />
          <stop offset={1} stopColor="#4000BF" />
        </linearGradient>
      </defs>
    </svg>
  </div>
);
