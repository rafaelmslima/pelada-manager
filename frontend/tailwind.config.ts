import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Bebas Neue"', "sans-serif"],
        jakarta: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
      },
      borderRadius: {
        "card-lg": "20px",
        "card-md": "16px",
        "card-sm": "14px",
        btn: "14px",
        chip: "20px",
        badge: "6px",
        input: "12px",
        logo: "16px",
      },
      transitionDuration: {
        600: "600ms",
      },
    },
  },
  plugins: [],
} satisfies Config;
