/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      colors: {
        ink: "#0B0F14",
        panel: "#151B23",
        "panel-hi": "#1B222B",
        bone: "#E8E6E1",
        emerald: { seal: "#2FBF71" },
        rose: { seal: "#F43F5E" },
        amber: { seal: "#F59E0B" },
        hair: "rgba(232,230,225,0.12)",
        background: "#0B0F14",
        foreground: "#E8E6E1",
        border: "rgba(232,230,225,0.12)",
        input: "rgba(232,230,225,0.12)",
        ring: "#2FBF71",
        primary: { DEFAULT: "#2FBF71", foreground: "#0B0F14" },
        secondary: { DEFAULT: "#151B23", foreground: "#E8E6E1" },
        muted: { DEFAULT: "#151B23", foreground: "rgba(232,230,225,0.6)" },
        accent: { DEFAULT: "#1B222B", foreground: "#E8E6E1" },
        destructive: { DEFAULT: "#F43F5E", foreground: "#E8E6E1" },
        popover: { DEFAULT: "#151B23", foreground: "#E8E6E1" },
        card: { DEFAULT: "#151B23", foreground: "#E8E6E1" },
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
