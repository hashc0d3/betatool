type SnakeLogoProps = {
  className?: string;
  title?: string;
};

export function SnakeLogo({
  className = "h-10 w-10",
  title = "ПИТОН",
}: SnakeLogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
    >
      <defs>
        <linearGradient id="piton-body" x1="8" y1="8" x2="56" y2="56">
          <stop stopColor="#86efac" />
          <stop offset="0.45" stopColor="#22c55e" />
          <stop offset="1" stopColor="#15803d" />
        </linearGradient>
        <linearGradient id="piton-scale" x1="20" y1="16" x2="48" y2="48">
          <stop stopColor="#bbf7d0" stopOpacity="0.9" />
          <stop offset="1" stopColor="#4ade80" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <rect
        x="2"
        y="2"
        width="60"
        height="60"
        rx="18"
        fill="#052e16"
        stroke="url(#piton-body)"
        strokeWidth="2"
      />
      <path
        d="M16 38c4-10 10-14 16-14s10 5 14 5 8-3 10-8"
        stroke="url(#piton-body)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 36c3.5-8 9-11.5 14-11.5s9 4 12.5 4 7-2.5 9-6.5"
        stroke="url(#piton-scale)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="46.5" cy="20" r="5.5" fill="#bbf7d0" />
      <circle cx="48.2" cy="19" r="1.6" fill="#052e16" />
      <path
        d="M51.5 22.5c1.2.8 2.4 1 3.6.4"
        stroke="#4ade80"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M14 42c-1.5 2-1.2 4 .6 5.2"
        stroke="#86efac"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
