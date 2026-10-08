export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect
        x="0.5"
        y="0.5"
        width="25"
        height="25"
        rx="6"
        style={{ fill: "var(--color-panel)", stroke: "var(--color-border)" }}
      />
      <path
        d="M4.5 19.5C10 19.5 9 6.5 21.5 6.5"
        style={{ stroke: "var(--color-accent)" }}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="21.5" cy="6.5" r="1.6" style={{ fill: "var(--color-accent)" }} />
    </svg>
  );
}
