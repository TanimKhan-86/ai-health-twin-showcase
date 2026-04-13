/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Configure the content for all files that will use Tailwind classes
  content: ["./App.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}", "./screens/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          primary: {
            DEFAULT: "#8b5cf6", // violet-500
            dark: "#7c3aed",    // violet-600
            light: "#a78bfa",   // violet-400
          },
          secondary: {
            DEFAULT: "#d946ef", // fuchsia-500
            dark: "#c026d3",    // fuchsia-600
            light: "#e879f9",   // fuchsia-400
          },
          accent: "#c084fc",    // violet-400/purple-400 mix
        },
        // Status colors
        status: {
          success: "#10b981",
          warning: "#f59e0b",
          error: "#ef4444",
          info: "#3b82f6",
        },
        // Backgrounds
        bg: {
          showcase: {
            from: "#ffffff",
            via: "#f3e8ff", // light purple
            to: "#fae8ff",  // light pink
          },
          screen: {
            from: "#ffffff",
            via: "#f5f3ff",
            to: "#fff1f2",
          },
          card: {
            DEFAULT: "#ffffff",
            hover: "#faf5ff",
          }
        }
      },
    },
  },
  plugins: [],
}
