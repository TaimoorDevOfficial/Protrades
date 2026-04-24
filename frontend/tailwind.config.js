/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Light (Rupeezy-like) theme: white surfaces + blue accents
        "surface-container-lowest": "#f5f8ff",
        "surface-container-low": "#ffffff",
        "surface-container": "#ffffff",
        "surface-container-high": "#f3f7ff",
        "surface-container-highest": "#eaf1ff",
        surface: "#ffffff",
        "surface-bright": "#f2f6ff",
        "surface-variant": "#eef3ff",
        "on-surface": "#0f172a", // slate-900
        "on-surface-variant": "#475569", // slate-600
        primary: "#1d4ed8", // blue-700
        "primary-container": "#3b82f6", // blue-500
        "on-primary-fixed": "#ffffff",
        secondary: "#16a34a", // green-600
        "secondary-container": "#22c55e", // green-500
        tertiary: "#f97316", // orange-500
        "tertiary-container": "#ea580c", // orange-600
        outline: "#cbd5e1", // slate-300
        "outline-variant": "#e2e8f0", // slate-200
        error: "#ef4444", // red-500
        background: "#f5f8ff",
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
        ambient: "0 24px 48px rgba(2, 6, 23, 0.10)",
        "primary-glow": "0 0 24px rgba(59, 130, 246, 0.20)",
      },
    },
  },
  plugins: [],
};
