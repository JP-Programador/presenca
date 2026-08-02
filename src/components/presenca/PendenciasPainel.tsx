import { useMemo, useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { STATUS_DIA_LABEL, type StatusDia, type StatusDiaRegistro } from "@/types/status";

type Filtro =
  | "todos"
  | "nao_lancaram"
  | "aguardando_aprovacao"
  | "presentes"
  | "faltas"
  | "atestados"
  | "folgas"
  | "outros";

const FILTROS: { chave: Filtro; label: string }[] = [
  { chave: "todos", label: "Todos" },
  { chave: "nao_lancaram", label: "Não lançaram" },
  { chave: "aguardando_aprovacao", label: "Aguardando aprovação" },
  { chave: "presentes", label: "Presentes" },
  { chave: "faltas", label: "Faltas" },
  { chave: "atestados", label: "Atestados" },
  { chave: "folgas", label: "Folgas" },
  { chave: "outros", label: "Outros" },
];

/** Classes do badge de status quando o filtro correspondente está ativo (só então ganha cor — o resto fica neutro). */
const CORES_QUANDO_ATIVO: Record<Filtro, string> = {
  todos: "bg-surface text-ink/70 dark:bg-white/10 dark:text-white/70",
  nao_lancaram: "bg-[#FBE7E7] text-danger",
  aguardando_aprovacao: "bg-[#FFF3DB] text-[#8A6200]",
  presentes: "bg-[#E7F3E8] text-[#2E7D32]",
  faltas: "bg-[#FBE7E7] text-danger",
  atestados: "bg-[#E3EEFA] text-[#1E6FA8]",
  folgas: "bg-surface text-ink/70 dark:bg-white/10 dark:text-white/70",
  outros: "bg-surface text-ink/70 dark:bg-white/10 dark:text-white/70",
};

const NEUTRO = "bg-surface text-ink/70 dark:bg-white/10 dark:text-white/70";

function pertenceAoFiltro(status: StatusDia, filtro: Filtro): boolean {
  switch (filtro) {
    case "todos":
      return true;
    case "nao_lancaram":
      return status === "FALTA" || status === "FOLGA";
    case "aguardando_aprovacao":
      return status === "PENDENTE";
    case "presentes":
      return status === "PRESENTE";
    case "faltas":
      return status === "FALTA";
    case "atestados":
      return status === "ATESTADO";
    case "folgas":
      return status === "FOLGA";
    case "outros":
      return status === "OUTROS";
  }
}

/** true se, agora, já passou das 09:00 em um dia útil (regra de destaque de faltas). */
function apos9hEmDiaUtil(): boolean {
  const agora = new Date();
  const diaSemana = agora.getDay(); // 0=domingo...6=sábado
  const ehUtil = diaSemana !== 0 && diaSemana !== 6;
  return ehUtil && agora.getHours() >= 9;
}

interface PendenciasPainelProps {
  itens: StatusDiaRegistro[];
  /** Renderizado à direita de cada linha (ex.: StatusActionMenu no líder). Omitir = somente leitura. */
  renderAcoes?: (item: StatusDiaRegistro) => React.ReactNode;
}

/**
 * Painel de pendências e cobrança (Módulo 8) — reutilizado nos dashboards
 * de líder, coordenação e auditoria. Lista compacta (não um card cheio por
 * linha) com contador, filtro rápido e busca. O badge de status só ganha
 * cor quando o filtro correspondente está selecionado — do contrário fica
 * neutro, igual aos outros, para reduzir a poluição visual.
 */
export function PendenciasPainel({ itens, renderAcoes }: PendenciasPainelProps) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busca, setBusca] = useState("");
  const destacarFaltas = useMemo(apos9hEmDiaUtil, []);

  const contagens = useMemo(() => {
    const mapa: Record<Filtro, number> = {
      todos: itens.length,
      nao_lancaram: 0,
      aguardando_aprovacao: 0,
      presentes: 0,
      faltas: 0,
      atestados: 0,
      folgas: 0,
      outros: 0,
    };
    for (const item of itens) {
      for (const f of FILTROS) {
        if (f.chave !== "todos" && pertenceAoFiltro(item.status, f.chave)) mapa[f.chave]++;
      }
    }
    return mapa;
  }, [itens]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return itens.filter((item) => {
      if (!pertenceAoFiltro(item.status, filtro)) return false;
      if (!termo) return true;
      return (
        item.colaborador_nome?.toLowerCase().includes(termo) ||
        item.colaborador_matricula?.toLowerCase().includes(termo)
      );
    });
  }, [itens, filtro, busca]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.chave}
            onClick={() => setFiltro((atual) => (atual === f.chave ? "todos" : f.chave))}
            className={[
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              filtro === f.chave
                ? "border-primary bg-primary text-white"
                : "border-ink/15 bg-white text-ink/60 hover:bg-surface dark:border-white/15 dark:bg-[#242424] dark:text-white/60 dark:hover:bg-white/5",
            ].join(" ")}
          >
            {f.label} ({contagens[f.chave]})
          </button>
        ))}
      </div>

      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por matrícula ou nome..."
        className="h-11 rounded-md border border-ink/15 bg-white px-3 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-white/15 dark:bg-[#242424] dark:text-white"
      />

      {filtrados.length === 0 ? (
        <Card>
          <CardBody className="py-10 text-center text-sm text-ink/50 dark:text-white/50">
            Nenhum colaborador encontrado para esse filtro.
          </CardBody>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-ink/5 dark:divide-white/5">
            {filtrados.map((item) => {
              const destacado = destacarFaltas && item.status === "FALTA" && filtro === "todos";
              const corBadge = filtro !== "todos" && pertenceAoFiltro(item.status, filtro) ? CORES_QUANDO_ATIVO[filtro] : NEUTRO;
              return (
                <li
                  key={item.id}
                  className={[
                    "flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
                    destacado ? "bg-danger/5" : "",
                  ].join(" ")}
                >
                  <div className="min-w-0">
                    <p className={["truncate text-sm font-semibold", destacado ? "text-danger" : "text-ink dark:text-white"].join(" ")}>
                      {item.colaborador_nome ?? "Colaborador"}
                    </p>
                    <p className="truncate text-xs text-ink/50 dark:text-white/50">
                      {item.colaborador_matricula && <>Matrícula {item.colaborador_matricula} · </>}
                      {item.filial_nome}
                      {item.status === "OUTROS" && item.motivo_outros ? ` · ${item.motivo_outros}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                    <span className={["rounded-full px-2.5 py-1 text-xs font-semibold", corBadge].join(" ")}>
                      {STATUS_DIA_LABEL[item.status]}
                    </span>
                    {renderAcoes?.(item)}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
