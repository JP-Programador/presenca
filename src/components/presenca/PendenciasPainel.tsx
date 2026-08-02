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
 * de líder, coordenação e auditoria. Agrupa por status, com contador,
 * filtro rápido e busca por matrícula/nome.
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
            onClick={() => setFiltro(f.chave)}
            className={[
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              filtro === f.chave
                ? "border-primary bg-primary text-white"
                : "border-ink/15 bg-white text-ink/60 hover:bg-surface",
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
        className="h-11 rounded-md border border-ink/15 bg-white px-3 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      />

      {filtrados.length === 0 ? (
        <Card>
          <CardBody className="py-10 text-center text-sm text-ink/50">
            Nenhum colaborador encontrado para esse filtro.
          </CardBody>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {filtrados.map((item) => {
            const destacado = destacarFaltas && item.status === "FALTA";
            return (
              <Card
                key={item.id}
                className={destacado ? "border-danger/40 bg-danger/5" : undefined}
              >
                <CardBody className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={["text-sm font-semibold", destacado ? "text-danger" : "text-ink"].join(" ")}>
                        {item.colaborador_nome ?? "Colaborador"}
                      </p>
                      <p className="text-xs text-ink/50">
                        {item.colaborador_matricula && <>Matrícula {item.colaborador_matricula} · </>}
                        {item.filial_nome}
                      </p>
                      {item.status === "OUTROS" && (
                        <p className="mt-1 text-xs text-ink/60">
                          {item.motivo_outros}
                          {item.observacao ? ` · ${item.observacao}` : ""}
                        </p>
                      )}
                    </div>
                    <span
                      className={[
                        "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
                        destacado ? "bg-danger text-white" : "bg-surface text-ink/70",
                      ].join(" ")}
                    >
                      {STATUS_DIA_LABEL[item.status]}
                    </span>
                  </div>
                  {renderAcoes && <div className="border-t border-ink/10 pt-3">{renderAcoes(item)}</div>}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
