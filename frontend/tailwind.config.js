/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "surface-container-lowest": "#0b0e11",
        "surface-container-low": "#191c1f",
        "surface-container": "#1d2023",
        "surface-container-high": "#272a2e",
        "surface-container-highest": "#323538",
        surface: "#111417",
        "surface-bright": "#37393d",
        "surface-variant": "#323538",
        "on-surface": "#e1e2e7",
        "on-surface-variant": "#bbc9cf",
        primary: "#a4e6ff",
        "primary-container": "#00d1ff",
        "on-primary-fixed": "#001f28",
        secondary: "#44e092",
        "secondary-container": "#03c177",
        tertiary: "#ffd2cc",
        "tertiary-container": "#ffaba0",
        outline: "#859399",
        "outline-variant": "#3c494e",
        error: "#ffb4ab",
        background: "#111417",
      },
      borderRadius: {
        DEFAULT: "0.125rem",
        md: "0.375rem",
        lg: "0.5rem",
        xl: "0.75rem",
      },
      fontFamily: {
        headline: ['"Space Grotesk"', "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        ambient: "0 24px 48px rgba(0, 0, 0, 0.5)",
        "primary-glow": "0 0 24px rgba(164, 230, 255, 0.15)",
      },
    },
  },
  plugins: [],
};
