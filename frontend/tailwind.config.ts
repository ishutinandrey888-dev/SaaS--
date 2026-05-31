import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Onest", "system-ui", "sans-serif"],
        display: ["Unbounded", "system-ui", "sans-serif"],
      },
      colors: {
        // Brand green from the mockup. Used for primary CTA + "applied" state.
        brand: {
          50: "#e8f5ec",
          100: "#bfe3c9",
          400: "#4ade80",
          500: "#34c759",
          600: "#2aa84a",
          700: "#219c46",
          800: "#1b7f3a",
        },
        // Dark slate palette aligned with admin mockup (#1A1D2E base).
        ink: {
          0: "#1a1d2e",
          50: "#1f2238",
          100: "#22253a",
          200: "#272a40",
          300: "#33374f",
          400: "#454a66",
          500: "#5d6483",
          600: "#8e95b3",
          700: "#b3b9d2",
          800: "#dadee9",
          900: "#f1f3f8",
        },
      },
      boxShadow: {
        soft: "0 4px 30px rgba(0, 0, 0, 0.3)",
        card: "0 8px 40px rgba(0, 0, 0, 0.4)",
      },
    },
  },
  plugins: [],
};

export default config;
