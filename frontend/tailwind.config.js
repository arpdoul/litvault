export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Syne'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
        body: ["'DM Sans'", "sans-serif"],
      },
      colors: {
        vault: {
          bg: "#080c10",
          panel: "#0d1117",
          border: "#1a2332",
          accent: "#00d4aa",
          gold: "#f0b429",
          red: "#ff4444",
          muted: "#4a5568",
          text: "#e2e8f0",
          dim: "#718096",
          litecoin: "#a0a9b8",
          litvm: "#3b82f6",
        },
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4,0,0.6,1) infinite",
        "float": "float 6s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
        "ping-slow": "ping 3s cubic-bezier(0,0,0.2,1) infinite",
      },
      keyframes: {
        float: { "0%,100%": { transform: "translateY(0px)" }, "50%": { transform: "translateY(-10px)" } },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
      },
    },
  },
  plugins: [],
};
