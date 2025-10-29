/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./frontend-src/**/*.{html,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand colors matching existing design
        primary: {
          DEFAULT: '#667eea',
          dark: '#764ba2',
        },
        secondary: {
          DEFAULT: '#4caf50',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
