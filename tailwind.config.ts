import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        info: "hsl(var(--info))",
        fp: {
          red: "#F02615",
          "red-dark": "#8B0000",
          amber: "#FAB701",
          grey: "#76797B",
          // Textos y superficies que cambian según el tema (ver globals.css)
          ink: "rgb(var(--fp-ink-rgb) / <alpha-value>)",
          dim: "rgb(var(--fp-dim-rgb) / <alpha-value>)",
          faint: "rgb(var(--fp-faint-rgb) / <alpha-value>)",
          surface: "var(--fp-surface)",
          "surface-hover": "var(--fp-surface-hover)",
          sunken: "var(--fp-sunken)",
          line: "var(--fp-line)",
          "line-strong": "var(--fp-line-strong)",
          track: "var(--fp-track)",
          ok: "#2FBF71",
          dock: "#7FB2FF",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: [
          "Plus Jakarta Sans",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "Noto Sans",
          "sans-serif",
        ],
        // Misma fuente que el texto: la app usa una sola tipografía (también en números).
        mono: [
          "Plus Jakarta Sans",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "Courier New",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
