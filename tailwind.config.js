/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Brandastic brand colors
        brand: {
          orange: "#F7931E",      // Primary Brandastic orange
          blue: "#00AEEF",        // Brandastic blue
          dark: "#1A1A2E",        // Dark navy
          coral: "#FF6B6B",       // Accent coral
          teal: "#00D4AA",        // Vibrant teal
          purple: "#8B5CF6",      // Modern purple
          gold: "#FBBF24",        // Warm gold
          pink: "#EC4899",        // Hot pink accent
        },
        status: {
          todo: "#94A3B8",
          inprogress: "#3B82F6",
          done: "#10B981",
        },
        priority: {
          low: "#22C55E",
          medium: "#EAB308",
          high: "#F97316",
          urgent: "#EF4444",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["Helvetica Neue", "Helvetica", "Arial", "sans-serif"],
        display: ["Helvetica Neue", "Helvetica", "Arial", "sans-serif"],
        mono: ["'SF Mono'", "Monaco", "Consolas", "monospace"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(247, 147, 30, 0.4)" },
          "50%": { boxShadow: "0 0 20px 10px rgba(247, 147, 30, 0)" },
        },
        "slide-up": {
          from: { transform: "translateY(10px)", opacity: 0 },
          to: { transform: "translateY(0)", opacity: 1 },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        gleam: {
          "0%": { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "border-flow": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "scale-in": {
          "0%": { transform: "scale(0.95)", opacity: 0 },
          "100%": { transform: "scale(1)", opacity: 1 },
        },
        "fade-in-up": {
          "0%": { transform: "translateY(20px)", opacity: 0 },
          "100%": { transform: "translateY(0)", opacity: 1 },
        },
        glow: {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.5 },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-glow": "pulse-glow 2s infinite",
        "slide-up": "slide-up 0.3s ease-out",
        shimmer: "shimmer 2s infinite",
        gleam: "gleam 3s ease-in-out infinite",
        float: "float 3s ease-in-out infinite",
        "border-flow": "border-flow 3s ease infinite",
        "scale-in": "scale-in 0.2s ease-out",
        "fade-in-up": "fade-in-up 0.4s ease-out",
        glow: "glow 2s ease-in-out infinite",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-brand": "linear-gradient(135deg, #F7931E 0%, #00AEEF 100%)",
        "gradient-brandastic": "linear-gradient(135deg, #F7931E 0%, #FF6B6B 50%, #00AEEF 100%)",
        "gradient-dark": "linear-gradient(135deg, #1A1A2E 0%, #16213E 100%)",
        "gradient-gleam": "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
        "gradient-shine": "linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.15) 50%, transparent 75%)",
        "noise": "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
