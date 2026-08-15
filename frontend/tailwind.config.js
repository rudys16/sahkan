/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      colors: {
        // Light theme tokens (names kept for reuse across components):
        // "ink"  = base surface (white)
        // "bone" = primary text (deep navy)
        // "panel"= raised light panel
        // emerald.seal = brand teal (approved / primary)
        ink: "#FFFFFF",
        panel: "#F4F7F9",
        "panel-hi": "#EAF1F4",
        bone: "#14344E",
        emerald: { seal: "#12A093" },
        rose: { seal: "#E24C3C" },
        amber: { seal: "#D98324" },
        navy: { DEFAULT: "#163C5C", deep: "#0F2E47" },
        hair: "rgba(20,52,78,0.12)",
        background: "#FFFFFF",
        foreground: "#14344E",
        border: "rgba(20,52,78,0.12)",
        input: "rgba(20,52,78,0.14)",
        ring: "#12A093",
        primary: { DEFAULT: "#12A093", foreground: "#FFFFFF" },
        secondary: { DEFAULT: "#F4F7F9", foreground: "#14344E" },
        muted: { DEFAULT: "#F4F7F9", foreground: "rgba(20,52,78,0.6)" },
        accent: { DEFAULT: "#EAF1F4", foreground: "#14344E" },
        destructive: { DEFAULT: "#E24C3C", foreground: "#FFFFFF" },
        popover: { DEFAULT: "#FFFFFF", foreground: "#14344E" },
        card: { DEFAULT: "#FFFFFF", foreground: "#14344E" },
      },
      fontFamily: {
        sans: ["'IBM Plex Sans'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "monospace"],
      },
      borderRadius: { lg: "4px", md: "3px", sm: "2px" },
      keyframes: {
        "stamp-in": {
          "0%": { opacity: "0", transform: "scale(1.6) rotate(-18deg)" },
          "60%": { opacity: "1", transform: "scale(0.94) rotate(-8deg)" },
          "100%": { opacity: "1", transform: "scale(1) rotate(-6deg)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
      },
      animation: {
        "stamp-in": "stamp-in 0.5s cubic-bezier(0.2,0.8,0.2,1) both",
        "fade-up": "fade-up 0.5s ease-out both",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
