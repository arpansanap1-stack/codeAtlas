import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        workspace: "#0c0e14",   // primary app background (deep slate charcoal)
        panel: "#12151d",       // sidebars, top headers, drawer panels
        surface: "#181c26",     // cards, container blocks
        surfaceElevated: "#202532", // modals, popovers, active highlights
        surfaceHover: "#282f3f",    // hover interaction states
        borderSubtle: "#232938",    // quiet dividers
        borderDefault: "#2d3548",   // standard component borders
        borderFocus: "#434f6c",     // focused or active borders
        accent: {
          indigo: "#6366f1",
          indigoLight: "#818cf8",
          sky: "#38bdf8",
          emerald: "#34d399",
          amber: "#fbbf24",
          rose: "#f43f5e",
          purple: "#c084fc",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "Fira Code",
          "Cascadia Code",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.16, 1, 0.3, 1)",
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      animation: {
        "fade-in": "fadeIn 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "slide-up": "slideUp 240ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "slide-down": "slideDown 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "scale-in": "scaleIn 180ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "pulse-glow": "pulseGlow 2.5s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.97)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        card: "0 2px 8px -2px rgba(0, 0, 0, 0.4), 0 1px 4px -1px rgba(0, 0, 0, 0.3)",
        elevated: "0 12px 36px -4px rgba(0, 0, 0, 0.5), 0 4px 12px -2px rgba(0, 0, 0, 0.4)",
        glowIndigo: "0 0 20px -4px rgba(99, 102, 241, 0.35)",
        glowSky: "0 0 20px -4px rgba(56, 189, 248, 0.35)",
        glowEmerald: "0 0 20px -4px rgba(52, 211, 153, 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
