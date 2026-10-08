import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    '*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-jakarta)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Brand blue ramp (#1668F5). The default blue/violet/indigo scales are remapped
        // onto it so every existing utility picks up the brand colour.
        blue: {
          50: '#EEF4FF', 100: '#DCE8FE', 200: '#BDD3FD', 300: '#8FB5FB', 400: '#5C90F8',
          500: '#1668F5', 600: '#1156D6', 700: '#0F4FC4', 800: '#143F94', 900: '#16336F', 950: '#0D1F45',
        },
        violet: {
          50: '#EEF4FF', 100: '#DCE8FE', 200: '#BDD3FD', 300: '#8FB5FB', 400: '#5C90F8',
          500: '#1668F5', 600: '#1156D6', 700: '#0F4FC4', 800: '#143F94', 900: '#16336F', 950: '#0D1F45',
        },
        indigo: {
          50: '#EEF4FF', 100: '#DCE8FE', 200: '#BDD3FD', 300: '#8FB5FB', 400: '#5C90F8',
          500: '#1668F5', 600: '#1156D6', 700: '#0F4FC4', 800: '#143F94', 900: '#16336F', 950: '#0D1F45',
        },
        // Dark-mode neutrals tinted to the blue theme so hardcoded dark:bg-gray-* containers match.
        gray: {
          700: '#27324A', 800: '#182036', 850: '#141B2E', 900: '#101627', 950: '#0A0F1C',
        },
        brand: {
          cyan: '#6FA3F8', pink: '#6FA3F8', violet: '#1668F5', indigo: '#0F4FC4',
        },
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'scale-in': { from: { opacity: '0', transform: 'scale(0.95)' }, to: { opacity: '1', transform: 'scale(1)' } },
        'float': { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        'shimmer': { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
        'gradient-shift': { '0%,100%': { backgroundPosition: '0% 50%' }, '50%': { backgroundPosition: '100% 50%' } },
        'pulse-ring': { '0%': { boxShadow: '0 0 0 0 rgba(70,144,119,0.4)' }, '70%': { boxShadow: '0 0 0 10px rgba(70,144,119,0)' }, '100%': { boxShadow: '0 0 0 0 rgba(70,144,119,0)' } },
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.3s cubic-bezier(0.22,1,0.36,1) both',
        'fade-in': 'fade-in 0.4s ease-out both',
        'scale-in': 'scale-in 0.35s cubic-bezier(0.22,1,0.36,1) both',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 2.2s linear infinite',
        'gradient': 'gradient-shift 8s ease infinite',
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.4,0,0.6,1) infinite',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
export default config
