// FILE: account-research-ui/tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class', // Keep dark mode if needed, otherwise remove
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Supervity Brand Colors
        primary: '#000000', // Black
        'primary-foreground': '#ffffff', // White (for text on black)
        white: '#ffffff',
        navy: '#000b37', // Navy Blue
        lime: '#85c20b', // Lime Green
        'gray-dk': '#474747', // Dark Gray
        'gray-lt': '#c7c7c7', // Light Gray
        blue: '#8289ec', // Soft Blue
        'lime-lt': '#c3fb54', // Light Lime
        orange: '#ff9a5a', // Coral Orange
        purple: '#b181ff', // Soft Purple
        cyan: '#31b8e1', // Bright Cyan
        pink: '#ff94a8', // Light Pink

        // Shadcn UI semantic mapping (example)
        background: '#000000', // Use black as main background
        foreground: '#ffffff', // White text on black
        card: '#000b37', // Navy for cards/containers
        'card-foreground': '#ffffff',
        popover: '#000b37',
        'popover-foreground': '#ffffff',
        secondary: '#474747', // Dark gray as secondary
        'secondary-foreground': '#ffffff',
        muted: '#474747', // Dark gray for muted elements
        'muted-foreground': '#c7c7c7', // Light gray text on dark gray
        accent: '#85c20b', // Lime green as accent
        'accent-foreground': '#000000', // Black text on lime
        destructive: '#ff9a5a', // Orange for destructive actions
        'destructive-foreground': '#000000',
        border: '#474747', // Dark gray for borders
        input: '#474747', // Dark gray for input borders/backgrounds
        ring: '#85c20b', // Lime green for focus rings
      },
      keyframes: {
        'gradient-x': {
          '0%, 100%': { 'background-position': '0% 50%' },
          '50%': { 'background-position': '100% 50%' },
        },
        'indeterminate-progress': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'accordion-down': {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        'accordion-up': {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        'gradient-x': 'gradient-x 15s ease infinite',
        'indeterminate-progress': 'indeterminate-progress 1.5s ease-in-out infinite',
        'accordion-down': "accordion-down 0.2s ease-out",
        'accordion-up': "accordion-up 0.2s ease-out",
      },
      backgroundSize: {
        'auto': 'auto',
        'cover': 'cover',
        'contain': 'contain',
        '200%': '200%',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")], // Make sure to install tailwindcss-animate: npm install tailwindcss-animate
}

export default config