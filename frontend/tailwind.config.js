/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        glow: "0 0 24px rgba(56, 189, 248, 0.35)"
      },
      keyframes: {
        pulseLine: {
          "0%": { strokeDashoffset: "80" },
          "100%": { strokeDashoffset: "0" }
        },
        floaty: {
          "0%,100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-4px)" }
        }
      },
      animation: {
        pulseLine: "pulseLine 1.2s linear infinite",
        floaty: "floaty 2.2s ease-in-out infinite"
      }
    }
  },
  plugins: []
};

