export const AppLogo = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" {...props}>
    <defs>
      <clipPath id="app-logo-planet">
        <circle cx="248" cy="272" r="140" />
      </clipPath>
    </defs>
    <rect width="512" height="512" rx="112" fill="#5340B6" />
    <circle cx="248" cy="272" r="140" fill="#fff" />
    <g clipPath="url(#app-logo-planet)" fill="#5340B6">
      <rect x="100" y="218" width="320" height="26" opacity="0.28" />
      <rect x="100" y="266" width="320" height="40" opacity="0.5" />
      <rect x="100" y="332" width="320" height="22" opacity="0.28" />
    </g>
    <circle cx="400" cy="128" r="22" fill="#fff" />
  </svg>
);
