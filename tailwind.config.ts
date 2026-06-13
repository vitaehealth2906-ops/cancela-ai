import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "Times New Roman", "serif"],
      },
      colors: {
        paper: "#faf8f4",
        surface: "#ffffff",
        sunken: "#f4f1eb",
        ink: "#26231f",
        stone: {
          100: "#f0ede6",
          200: "#e5e1d8",
          300: "#d2ccc0",
          400: "#a8a096",
          500: "#7a7268",
          600: "#5c554c",
          700: "#43403a",
        },
        brand: {
          50: "#eef0fb",
          100: "#dde1f6",
          200: "#bcc3ee",
          500: "#4f46e5",
          600: "#4338ca",
          700: "#3730a3",
          900: "#1e1b4b",
        },
        sev: { calm: "#5e8b6f", soft: "#c99a3e", warn: "#c9742e", high: "#b5503f" },
        danger: { bg: "#f8e9e6", border: "#e3b9b0", fg: "#94402f" },
        ok: { bg: "#eaf1ec", border: "#cfe0d4", fg: "#3d5e4a" },
      },
      borderRadius: { chip: "10px", card: "20px", icon: "14px" },
      boxShadow: {
        sm: "0 1px 2px rgba(38,35,31,.04),0 2px 6px rgba(38,35,31,.05)",
        md: "0 2px 4px rgba(38,35,31,.04),0 8px 20px -6px rgba(38,35,31,.10)",
        lg: "0 4px 8px rgba(38,35,31,.05),0 18px 40px -12px rgba(38,35,31,.16)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "rise-in": {
          "0%": { opacity: "0", transform: "translateY(6px) scale(.99)" },
          "100%": { opacity: "1", transform: "none" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-soft": {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: ".55" },
        },
      },
      animation: {
        "fade-up": "fade-up .5s cubic-bezier(.22,.61,.36,1) both",
        "rise-in": "rise-in .45s cubic-bezier(.22,.61,.36,1) both",
        shimmer: "shimmer 1.6s linear infinite",
        "pulse-soft": "pulse-soft 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
