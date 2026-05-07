import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      colors: {
        // Brand green from the mockup. Used for primary CTA + "applied" state.
        brand: {
          50: "#e8f5ec",
          100: "#bfe3c9",
          500: "#34c759",
          600: "#2aa84a",
          700: "#219c46",
          800: "#1b7f3a",
        },
        // Dark slate palette for the app shell.
        ink: {
          0: "#0a0d12",
          50: "#0f141b",
          100: "#141a23",
          200: "#1b232f",
          300: "#27313f",
          400: "#3a4555",
          500: "#586577",
          600: "#8e9aaa",
          700: "#b9c3d2",
          800: "#dde3ec",
          900: "#f2f5fa",
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
