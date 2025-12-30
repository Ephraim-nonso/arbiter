export function MantleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Mantle-style sunburst (approx) */}
      <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
        <path d="M12 2.6v2.6" />
        <path d="M12 18.8v2.6" />
        <path d="M2.6 12h2.6" />
        <path d="M18.8 12h2.6" />
        <path d="M5.1 5.1l1.9 1.9" />
        <path d="M17 17l1.9 1.9" />
        <path d="M18.9 5.1 17 7" />
        <path d="M7 17l-1.9 1.9" />
        {/* Extra rays */}
        <path d="M12 6.1v1.4" opacity="0.85" />
        <path d="M12 16.5v1.4" opacity="0.85" />
        <path d="M6.1 12h1.4" opacity="0.85" />
        <path d="M16.5 12h1.4" opacity="0.85" />
      </g>
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}


