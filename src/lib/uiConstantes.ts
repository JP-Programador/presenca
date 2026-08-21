// Alturas máximas compartilhadas pelas listas/tabelas grandes do sistema —
// evita que uma tabela com muitas linhas domine a página inteira. Acima
// desse limite o próprio container rola (scroll interno), em vez da página.
// Aproximadamente 5 linhas no celular / 10 linhas no desktop.

/** Tabelas compactas (linha ~40px, ex.: TabelaGeralStatus, relatório de marcações). */
export const ALTURA_TABELA_COMPACTA = "max-h-[240px] sm:max-h-[440px] overflow-y-auto";

/** Listas de cartão por item (linha ~80px, ex.: PendenciasPainel). */
export const ALTURA_LISTA_CARDS = "max-h-[420px] sm:max-h-[820px] overflow-y-auto";
