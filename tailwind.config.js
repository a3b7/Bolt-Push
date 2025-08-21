/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html","./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: { colors: { primary: "#2B8659" }, borderRadius: { '2xl': '1rem' } } },
  plugins: [],
};
