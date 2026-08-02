/**
 * Tema visual do sistema de Presença Operacional TLP.
 * Fonte única da verdade para cores — espelhado em tailwind.config.ts.
 * Use este objeto em lógica JS/TS (charts, inline styles, libs externas);
 * use as classes Tailwind (bg-primary, text-danger, etc.) dentro dos componentes.
 */

export const colors = {
  laranja: "#F26522", // Primária — marca TLP, botões principais, links ativos
  laranjaEscuro: "#D9471A", // Hover/active da primária, headers de destaque
  amarelo: "#F5B000", // Avisos, pendências, badges "em análise"
  vermelho: "#C62828", // Erros, ausências, atrasos, ações destrutivas
  grafite: "#333333", // Texto principal, ícones
  cinzaClaro: "#F5F5F5", // Fundo de página, cards neutros
} as const;

export type ColorToken = keyof typeof colors;

/** Papéis semânticos, para não espalhar hex pelo código. */
export const semantic = {
  primary: colors.laranja,
  primaryHover: colors.laranjaEscuro,
  warning: colors.amarelo,
  danger: colors.vermelho,
  textPrimary: colors.grafite,
  background: colors.cinzaClaro,
  surface: "#FFFFFF",
  border: "#E0E0E0",
} as const;

/** Mapeamento de status de presença -> cor, usado em badges/gráficos. */
export const statusPresenca = {
  presente: "#2E7D32", // verde — fora da paleta principal, só para status positivo
  atrasado: colors.amarelo,
  ausente: colors.vermelho,
  justificado: colors.laranja,
  pendenteAprovacao: colors.laranjaEscuro,
} as const;

export const typography = {
  fontFamily: "Inter, system-ui, sans-serif",
  sizes: {
    xs: "0.75rem",
    sm: "0.875rem",
    base: "1rem",
    lg: "1.125rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
    "3xl": "1.875rem",
  },
  weights: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
} as const;

export const radii = {
  sm: "4px",
  md: "8px",
  lg: "12px",
  full: "9999px",
} as const;

export const shadows = {
  sm: "0 1px 2px rgba(51, 51, 51, 0.06)",
  md: "0 2px 8px rgba(51, 51, 51, 0.10)",
  lg: "0 8px 24px rgba(51, 51, 51, 0.14)",
} as const;

export const theme = {
  colors,
  semantic,
  statusPresenca,
  typography,
  radii,
  shadows,
} as const;

export default theme;
