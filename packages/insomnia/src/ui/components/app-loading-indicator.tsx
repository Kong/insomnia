import React from 'react';

export const AppLoadingIndicator = () => (
  <div
    id="app-loading-indicator"
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      width: '100%',
    }}
  >
    <div
      style={{
        position: 'relative',
      }}
    >
      <svg
        viewBox="0 0 378 378"
        xmlns="http://www.w3.org/2000/svg"
        fillRule="evenodd"
        clipRule="evenodd"
        width={100}
      >
        <circle
          cx={36}
          cy={36}
          r={36}
          fill="none"
          stroke="var(--hl)"
          strokeOpacity={0.1}
          strokeWidth="4px"
          transform="translate(-323 -111) translate(359.016 147.016) scale(4.24956)"
        />
        <circle
          cx={36}
          cy={36}
          r={36}
          fill="none"
          stroke="var(--hl)"
          strokeOpacity={0.8}
          strokeWidth="4px"
          strokeDasharray="56,172,0,0"
          transform="translate(-323 -111) translate(359.016 147.016) scale(4.24956)"
        >
          <animateTransform
            additive='sum'
            attributeName="transform"
            type="rotate"
            from="0 36 36"
            to="360 36 36"
            dur="0.8s"
            repeatCount="indefinite"
          />
        </circle>
        <path
          d="M19 37.033c9.96 0 18.033-8.073 18.033-18.033S28.96.967 19 .967.967 9.04.967 19 9.04 37.033 19 37.033z"
          fill="#fff"
          fillRule="nonzero"
          transform="translate(-323 -111) translate(431.258 219.258) scale(4.24956)"
        />
        <path
          d="M19 0C8.506 0 0 8.506 0 19s8.506 19 19 19 19-8.506 19-19S29.494 0 19 0zm0 1.932c9.426 0 17.068 7.642 17.068 17.068 0 9.426-7.642 17.068-17.068 17.068-9.426 0-17.068-7.642-17.068-17.068C1.932 9.574 9.574 1.932 19 1.932z"
          fill="#4000bf"
          fillRule="nonzero"
          transform="translate(-323 -111) translate(431.258 219.258) scale(4.24956)"
        />
        <path
          d="M19.214 5.474c7.47 0 13.525 6.057 13.525 13.526 0 7.469-6.055 13.526-13.525 13.526-7.47 0-13.526-6.057-13.526-13.526 0-1.825.362-3.567 1.019-5.156a5.266 5.266 0 004.243 2.15c2.885 0 5.26-2.375 5.26-5.261a5.263 5.263 0 00-2.15-4.242 13.5 13.5 0 015.154-1.017z"
          fill="url(#_Linear1)"
          transform="translate(-323 -111) translate(431.258 219.258) scale(4.24956)"
        />
        <defs>
          <linearGradient
            id="_Linear1"
            x1={0}
            y1={0}
            x2={1}
            y2={0}
            gradientUnits="userSpaceOnUse"
            gradientTransform="rotate(-90 25.87 6.655) scale(27.0508)"
          >
            <stop offset={0} stopColor="#7400e1" />
            <stop offset={1} stopColor="#4000bf" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  </div>
);
