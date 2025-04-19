// FILE: account-research-ui/tailwind.config.ts
import type { Config } from 'tailwindcss'

// Helper function to convert hex to HSL string for CSS variables
function hexToHSL(hex: string): string {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex[1] + hex[2], 16);
    g = parseInt(hex[3] + hex[4], 16);
    b = parseInt(hex[5] + hex[6], 16);
  }
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  // Format for CSS variable: hue saturation% lightness%
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// Define brand colors first
const brandColors = {
  black: '#000000',
  white: '#ffffff',
  navy: '#000b37',
  lime: '#85c20b',
  'gray-dk': '#474747',
  'gray-lt': '#c7c7c7',
  blue: '#8289ec',
  'lime-lt': '#c3fb54',
  orange: '#ff9a5a',
  purple: '#b181ff',
  cyan: '#31b8e1',
  pink: '#ff94a8',
};

const config: Config = {
  darkMode: 'class', // Keep dark mode strategy consistent (using class)
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/pages/**/*.{js,ts,jsx,tsx}", // Ensure pages are scanned
    "./src/components/**/*.{js,ts,jsx,tsx}", // Ensure components are scanned
    "./src/layouts/**/*.{js,ts,jsx,tsx}", // Ensure layouts are scanned
  ],
  theme: {
    container: { // Add container settings for centering
        center: true,
        padding: {
            DEFAULT: '1rem',
            sm: '2rem',
            lg: '4rem',
            xl: '5rem',
        },
        screens: {
            '2xl': '1400px',
        },
    },
    extend: {
      colors: {
        ...brandColors, // Spread brand colors directly

        // shadcn/ui semantic mapping using brand colors
        border: `hsl(var(--border))`, // Map to CSS variable
        input: `hsl(var(--input))`,     // Map to CSS variable
        ring: `hsl(var(--ring))`,       // Map to CSS variable
        background: `hsl(var(--background))`,
        foreground: `hsl(var(--foreground))`,
        primary: {
          DEFAULT: `hsl(var(--primary))`,
          foreground: `hsl(var(--primary-foreground))`,
        },
        secondary: {
          DEFAULT: `hsl(var(--secondary))`,
          foreground: `hsl(var(--secondary-foreground))`,
        },
        destructive: {
          DEFAULT: `hsl(var(--destructive))`,
          foreground: `hsl(var(--destructive-foreground))`,
        },
        muted: {
          DEFAULT: `hsl(var(--muted))`,
          foreground: `hsl(var(--muted-foreground))`,
        },
        accent: {
          DEFAULT: `hsl(var(--accent))`,
          foreground: `hsl(var(--accent-foreground))`,
        },
        popover: {
          DEFAULT: `hsl(var(--popover))`,
          foreground: `hsl(var(--popover-foreground))`,
        },
        card: {
          DEFAULT: `hsl(var(--card))`,
          foreground: `hsl(var(--card-foreground))`,
        },
      },
      borderRadius: {
        lg: `var(--radius)`,
        md: `calc(var(--radius) - 2px)`,
        sm: `calc(var(--radius) - 4px)`,
      },
      keyframes: {
        'gradient-x': {
          '0%, 100%': { 'background-position': '0% 50%' },
          '50%': { 'background-position': '100% 50%' },
        },
        'indeterminate-progress': {
          '0%': { transform: 'translateX(-100%) scaleX(0.5)', opacity: '0.8' },
          '50%': { transform: 'translateX(0) scaleX(0.5)', opacity: '1' },
          '100%': { transform: 'translateX(100%) scaleX(0.5)', opacity: '0.8' },
        },
        'accordion-down': {
          from: { height: "0", opacity: "0" }, // Add opacity
          to: { height: "var(--radix-accordion-content-height)", opacity: "1" },
        },
        'accordion-up': {
          from: { height: "var(--radix-accordion-content-height)", opacity: "1" },
          to: { height: "0", opacity: "0" }, // Add opacity
        },
        // Add fadeIn (can be used instead of Framer Motion for simple fades)
        "fade-in": {
            "0%": { opacity: "0" },
            "100%": { opacity: "1" },
        },
        // Add slide-up-fade-in
        "slide-up-fade-in": {
            "0%": { opacity: "0", transform: "translateY(15px)" },
            "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        'gradient-x': 'gradient-x 15s ease infinite',
        'indeterminate-progress': 'indeterminate-progress 1.5s ease-in-out infinite',
        'accordion-down': "accordion-down 0.25s ease-out", // Slightly slower
        'accordion-up': "accordion-up 0.2s ease-out", // Slightly faster closing
        "fade-in": "fade-in 0.5s ease-out forwards",
        "slide-up-fade-in": "slide-up-fade-in 0.5s ease-out forwards",
      },
      backgroundSize: {
        'auto': 'auto',
        'cover': 'cover',
        'contain': 'contain',
        '200%': '200%',
      },
    },
  },
  plugins: [(require as any)("tailwindcss-animate")],
}

export default config