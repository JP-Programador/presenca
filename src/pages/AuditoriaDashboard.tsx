import { useEffect, useState } from "react";
import { BrandHeader } from "@/components/layout/BrandHeader";
import { NavPaineis } from "@/components/layout/NavPaineis";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { PendenciasPainel } from "@/components/presenca/PendenciasPainel";
import { AtendimentosPendentesPainel } from "@/components/presenca/AtendimentosPendentesPainel";
import { AuditFilters } from "@/components/presenca/AuditFilters";
import { AuditTimeline } from "@/components/presenca/AuditTimeline";
import { AuditDetailsModal } from "@/components/presenca/AuditDetailsModal";
import { useAuth } from "@/providers/AuthProvider";
import { hojeISO } from "@/lib/calendario";
import { listarAuditoria } from "@/services/coordenacaoService";
import * as statusDiaService from "@/services/statusDiaService";
import type { AuditLogEntry } from "@/types/domain";
import type { StatusDiaRegistro } from "@/types/status";

const ENTIDADES = [
  { valor: "", label: "Todas as entidades" },
  { valor: "registros_presenca", label: "Registros de presença" },
  { valor: "status_dia", label: "Status do dia" },
  { valor: "justificativas", label: "Justificativas" },
  { valor: "perfis", label: "Usuários" },
  { valor: "gestor_filiais", label: "Hierarquia (gestor × filial)" },
];

const ACAO_LABEL: Record<string, string> = {
  registro_presenca_status_alterado: "Status de presença alterado",
  status_dia_alterado: "Status do dia alterado",
  justificativa_status_alterado: "Status de justificativa alterado",
  perfil_usuario_alterado: "Perfil de usuário alterado",
  perfil_dados_alterados: "Dados do usuário editados",
  gestor_atribuido_filial: "Gestor atribuído a filial",
  gestor_removido_filial: "Gestor removido de filial",
  foto_excluida_48h: "Foto excluída automaticamente (24h)",
  login: "Login",
  logout: "Logout",
  senha_redefinida_solicitada: "Redefinição de senha solicitada",
  atendimento_saida_aprovada: "Saída de atendimento aprovada",
  atendimento_saida_rejeitada: "Saída de atendimento rejeitada",
  atendimento_pendente_fechamento: "Alerta: atendimento pendente de fechamento (8h)",
  atendimento_sem_fechamento: "Alerta: atendimento sem fechamento (12h)",
  atendimento_saida_cancelada_por_status_dia: "Saída de atendimento cancelada (status do dia alterado)",
};

export function AuditoriaDashboard() {
  // Papel (admin/auditor/coordenador) já validado por <RequireRole> na definição das rotas.
  const { usuario, sair } = useAuth();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [statusDoDia, setStatusDoDia] = useState<StatusDiaRegistro[]>([]);
  const [entidade, setEntidade] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [logSelecionado, setLogSelecionado] = useState<AuditLogEntry | null>(null);
  const [carregandoLogs, setCarregandoLogs] = useState(true);
  const [carregandoStatusDia, setCarregandoStatusDia] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setCarregandoLogs(true);
    setErro(null);
    try {
      const dados = await listarAuditoria({
        entidade: entidade || undefined,
        de: de ? new Date(`${de}T00:00:00`).toISOString() : undefined,
        ate: ate ? new Date(`${ate}T23:59:59`).toISOString() : undefined,
      });
      setLogs(dados);
    } catch {
      setErro("Não foi possível carregar o log de auditoria.");
    } finally {
      setCarregandoLogs(false);
    }
  }

  async function carregarStatusDia() {
    setCarregandoStatusDia(true);
    try {
      setStatusDoDia(await statusDiaService.listarStatusDia(hojeISO()));
    } catch (err) {
      console.error(err);
    } finally {
      setCarregandoStatusDia(false);
    }
  }

  useEffect(() => {
    if (usuario) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, entidade, de, ate]);

  useEffect(() => {
    if (usuario) carregarStatusDia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario]);

  if (!usuario) return null; // narrowing de tipo; na prática nunca alcançado (ver RequireRole)

  const dadosExportacao = logs.map((log) => ({
    data: new Date(log.created_at).toLocaleString("pt-BR"),
    acao: ACAO_LABEL[log.acao] ?? log.acao,
    entidade: log.entidade,
    ator: log.ator_nome ?? "Sistema",
    detalhes: log.detalhes ? JSON.stringify(log.detalhes) : "",
  }));

  return (
    <div className="min-h-screen bg-surface dark:bg-[#1A1A1A]">
      <BrandHeader
        title="Auditoria"
        subtitle="Trilha de ações sensíveis do sistema"
        right={<NavPaineis perfil={usuario.perfil} atual="auditoria" onSair={sair} />}
      />

      <main className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
        {erro && (
          <div className="mb-4">
            <Alert variant="danger">{erro}</Alert>
          </div>
        )}

        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-sm font-semibold text-ink dark:text-white">Pendências e cobrança</h2>
            <p className="text-xs text-ink/50 dark:text-white/50">Status do dia de todos os colaboradores (somente leitura).</p>
          </CardHeader>
          <CardBody>
            {carregandoStatusDia ? (
              <div className="flex justify-center py-8">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              <PendenciasPainel itens={statusDoDia} />
            )}
          </CardBody>
        </Card>

        <AtendimentosPendentesPainel somenteLeitura />

        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-3">
            <AuditFilters
              entidades={ENTIDADES}
              entidade={entidade}
              onEntidadeChange={setEntidade}
              de={de}
              ate={ate}
              onDeChange={setDe}
              onAteChange={setAte}
            />

            <ExportButtons
              dados={dadosExportacao}
              nomeBase="auditoria"
              colunas={[
                { chave: "data", titulo: "Data/hora" },
                { chave: "acao", titulo: "Ação" },
                { chave: "entidade", titulo: "Entidade" },
                { chave: "ator", titulo: "Responsável" },
                { chave: "detalhes", titulo: "Detalhes" },
              ]}
            />
          </CardHeader>

          <CardBody>
            {carregandoLogs ? (
              <div className="flex justify-center py-10">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              <AuditTimeline logs={logs} acaoLabel={ACAO_LABEL} onSelecionar={setLogSelecionado} />
            )}
          </CardBody>
        </Card>
      </main>

      {logSelecionado && (
        <AuditDetailsModal
          log={logSelecionado}
          acaoLabel={ACAO_LABEL[logSelecionado.acao] ?? logSelecionado.acao}
          onFechar={() => setLogSelecionado(null)}
        />
      )}
    </div>
  );
}
