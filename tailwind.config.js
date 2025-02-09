import defaultTheme from 'tailwindcss/defaultTheme'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
  	container: {
  		center: true,
  		padding: '2rem',
  		screens: {
  			'2xl': '1400px'
  		}
  	},
  	extend: {
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		fontFamily: {
  			sans: [
  				'Inter var',
  				'Inter',
  				'Helvetica Neue',
                    ...defaultTheme.fontFamily.sans
                ]
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			"pin-drop": {
  				"0%": {
  					transform: "translateY(-200px) rotate(-45deg)",
  					opacity: "0"
  				},
  				"70%": {
  					transform: "translateY(10px) rotate(0deg)",
  					opacity: "1"
  				},
  				"85%": {
  					transform: "translateY(-5px) rotate(0deg)",
  					opacity: "1"
  				},
  				"100%": {
  					transform: "translateY(0) rotate(0deg)",
  					opacity: "1"
  				}
  			},
  			"pin-pull": {
  				"0%": {
  					transform: "translateY(0) scale(1) rotate(0deg)",
  				},
  				"50%": {
  					transform: "translateY(-20px) scale(1.2) rotate(10deg)",
  				},
  				"100%": {
  					transform: "translateY(-100vh) scale(0.5) rotate(-45deg)",
  					opacity: "0"
  				}
  			},
  			wiggle: {
  				"0%, 100%": { transform: "rotate(-3deg) scale(1.1)" },
  				"50%": { transform: "rotate(3deg) scale(1.1)" },
  			},
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			"pin-drop": "pin-drop 1s cubic-bezier(0.34, 1.56, 0.64, 1)",
  			"pin-pull": "pin-pull 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
  			"wiggle": "wiggle 0.5s ease-in-out",
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};