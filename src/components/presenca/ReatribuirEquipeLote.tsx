import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import type { PessoaSimples } from "@/services/coordenacaoService";
import { reatribuirEquipeLote } from "@/services/colaboradoresService";
import type { Colaborador } from "@/types/domain";

interface ReatribuirEquipeLoteProps {
  colaboradores: Colaborador[];
  lideres: PessoaSimples[];
  onAtualizado: () => void;
}

/**
 * "Líder secundário": quando o líder principal sai de férias/afastamento e a
 * equipe fica emprestada pra outro líder. Decisão consciente: sem período
 * automático — reatribui a equipe inteira aqui de uma vez (em vez de
 * colaborador por colaborador) e, quando o titular voltar, troca de volta
 * do mesmo jeito, manualmente.
 */
export function ReatribuirEquipeLote({ colaboradores, lideres, onAtualizado }: ReatribuirEquipeLoteProps) {
  const [aberto, setAberto] = useState(false);
  const [liderOrigemId, setLiderOrigemId] = useState("");
  const [liderDestinoId, setLiderDestinoId] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const qtdAtiva = useMemo(
    () => colaboradores.filter((c) => c.lider_id === liderOrigemId && c.ativo).length,
    [colaboradores, liderOrigemId]
  );

  const liderOrigemNome = lideres.find((l) => l.id === liderOrigemId)?.nome;
  const liderDestinoNome = lideres.find((l) => l.id === liderDestinoId)?.nome;

  function fechar() {
    setAberto(false);
    setLiderOrigemId("");
    setLiderDestinoId("");
    setConfirmando(false);
    setErro(null);
  }

  async function confirmar() {
    setEnviando(true);
    setErro(null);
    try {
      const movidos = await reatribuirEquipeLote(liderOrigemId, liderDestinoId);
      setSucesso(`${movidos} colaborador(es) movido(s) de ${liderOrigemNome} para ${liderDestinoNome}.`);
      setTimeout(() => setSucesso(null), 6000);
      fechar();
      onAtualizado();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível reatribuir a equipe.");
      setConfirmando(false);
    } finally {
      setEnviando(false);
    }
  }

  if (!aberto) {
    return (
      <div className="mb-6">
        {sucesso && (
          <div className="mb-3">
            <Alert variant="success">{sucesso}</Alert>
          </div>
        )}
        <Button variant="ghost" size="md" onClick={() => setAberto(true)}>
          Emprestar equipe pra outro líder (férias/afastamento)
        </Button>
      </div>
    );
  }

  return (
    <Card className="mb-6 border-warning/30">
      <CardHeader>
        <h2 className="text-sm font-semibold text-ink dark:text-white">Emprestar equipe pra outro líder</h2>
        <p className="text-xs text-ink/50 dark:text-white/50">
          Move de uma vez toda a equipe ativa de um líder pra outro — ex.: o titular saiu de férias e alguém mais
          precisa aprovar/lançar a presença nesse meio tempo. Não tem prazo automático: quando o titular voltar,
          troque de volta por aqui do mesmo jeito.
        </p>
      </CardHeader>
      <CardBody className="flex flex-col gap-3">
        {erro && <Alert variant="danger">{erro}</Alert>}

        {!confirmando ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-ink dark:text-white">De (líder atual)</label>
                <select
                  value={liderOrigemId}
                  onChange={(e) => setLiderOrigemId(e.target.value)}
                  className="h-11 w-full rounded-md border border-ink/20 bg-white px-3 text-sm text-ink dark:border-white/20 dark:bg-[#242424] dark:text-white"
                >
                  <option value="">— selecione —</option>
                  {lideres.map((l) => (
                    <option key={l.id} value={l.id} disabled={l.id === liderDestinoId}>
                      {l.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-ink dark:text-white">Para (líder substituto)</label>
                <select
                  value={liderDestinoId}
                  onChange={(e) => setLiderDestinoId(e.target.value)}
                  className="h-11 w-full rounded-md border border-ink/20 bg-white px-3 text-sm text-ink dark:border-white/20 dark:bg-[#242424] dark:text-white"
                >
                  <option value="">— selecione —</option>
                  {lideres.map((l) => (
                    <option key={l.id} value={l.id} disabled={l.id === liderOrigemId}>
                      {l.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {liderOrigemId && (
              <p className="text-xs text-ink/60 dark:text-white/60">
                {qtdAtiva === 0
                  ? `${liderOrigemNome} não tem colaboradores ativos no momento.`
                  : `${qtdAtiva} colaborador(es) ativo(s) sob ${liderOrigemNome} serão movidos.`}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="md"
                disabled={!liderOrigemId || !liderDestinoId || qtdAtiva === 0}
                onClick={() => setConfirmando(true)}
              >
                Continuar
              </Button>
              <Button variant="ghost" size="md" onClick={fechar}>
                Cancelar
              </Button>
            </div>
          </>
        ) : (
          <>
            <Alert variant="warning">
              Tem certeza? {qtdAtiva} colaborador(es) de <strong>{liderOrigemNome}</strong> vão passar a aparecer no
              painel de <strong>{liderDestinoNome}</strong> imediatamente (pendências, aprovações, mapa — tudo).
              Pra desfazer, repita essa mesma ação trocando origem e destino.
            </Alert>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" size="md" loading={enviando} onClick={confirmar}>
                Confirmar empréstimo da equipe
              </Button>
              <Button variant="ghost" size="md" onClick={() => setConfirmando(false)} disabled={enviando}>
                Voltar
              </Button>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
