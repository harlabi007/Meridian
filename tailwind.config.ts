import type { Config } from "tailwindcss";

const themed = (name: string) => {
  const resolve = ({ opacityValue }: { opacityValue?: string }) => {
    const n = Number(opacityValue);
    if (opacityValue === undefined || Number.isNaN(n) || n >= 1) return `var(--color-${name})`;
    return `color-mix(in srgb, var(--color-${name}) ${n * 100}%, transparent)`;
  };
  return resolve as unknown as string;
};

const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: themed("bg"),
        panel: themed("panel"),
        panel2: themed("panel2"),
        border: themed("border"),
        borderHi: themed("borderHi"),
        text: themed("text"),
        muted: themed("muted"),
        faint: themed("faint"),
        amber: themed("accent"),
        amberHi: themed("accentHi"),
        buy: themed("buy"),
        sell: themed("sell"),
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        sm: "6px",
        DEFAULT: "8px",
        md: "10px",
        lg: "14px",
      },
      boxShadow: {
        card: "0 1px 2px var(--shadow-color), 0 1px 1px var(--shadow-color)",
        elevated: "0 4px 16px -4px var(--shadow-color), 0 2px 6px -2px var(--shadow-color)",
      },
      fontSize: {
        xs: ["11px", { lineHeight: "16px", letterSpacing: "0.01em" }],
        sm: ["13px", { lineHeight: "18px" }],
      },
    },
  },
  plugins: [],
};

export default config;