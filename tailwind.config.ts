import type { Config } from "tailwindcss";

// Paleta oficial TLP — mantida em sincronia com src/theme/theme.ts
const tlp = {
  laranja: "#F26522", // cor primária / marca
  laranjaEscuro: "#D9471A", // hover / estados ativos da primária
  amarelo: "#F5B000", // destaque / alertas informativos
  vermelho: "#C62828", // erro / crítico / atraso
  grafite: "#333333", // texto principal
  cinzaClaro: "#F5F5F5", // fundo de página / superfícies neutras
};

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        tlp,
        primary: {
          DEFAULT: tlp.laranja,
          dark: tlp.laranjaEscuro,
        },
        warning: tlp.amarelo,
        danger: tlp.vermelho,
        ink: tlp.grafite,
        surface: tlp.cinzaClaro,
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
