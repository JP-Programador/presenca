import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { habilitarNotificacoes, notificacoesAtivas, suportaNotificacoes } from "@/services/pushService";
import { useAuth } from "@/providers/AuthProvider";

const CHAVE_DISPENSADO = "tlp_notificacoes_dispensado_sessao";
const PAPEIS_COM_NOTIFICACAO = ["gestor", "coordenador", "admin"];

/**
 * Cobra a ativação de notificações a cada login — se o usuário clicar
 * "Agora não", some pro resto dessa sessão (sessionStorage), mas volta a
 * aparecer no próximo login (sessão nova), até ele realmente ativar.
 */
export function ModalHabilitarNotificacoes() {
  const { usuario } = useAuth();
  const [mostrar, setMostrar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!usuario || !PAPEIS_COM_NOTIFICACAO.includes(usuario.perfil)) return;
    if (!suportaNotificacoes()) return;
    if (sessionStorage.getItem(CHAVE_DISPENSADO)) return;
    notificacoesAtivas().then((ativas) => {
      if (!ativas) setMostrar(true);
    });
  }, [usuario]);

  function agoraNao() {
    sessionStorage.setItem(CHAVE_DISPENSADO, "1");
    setMostrar(false);
  }

  async function ativar() {
    setEnviando(true);
    setErro(null);
    try {
      await habilitarNotificacoes();
      setMostrar(false);
    } catch {
      setErro("Não foi possível ativar. Confira se o navegador não bloqueou a permissão.");
    } finally {
      setEnviando(false);
    }
  }

  if (!mostrar) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notificacoes-titulo"
    >
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-t-lg bg-white p-5 shadow-lg sm:rounded-lg dark:bg-[#242424]">
        <div>
          <h2 id="notificacoes-titulo" className="text-base font-semibold text-ink dark:text-white">
            Ativar notificações
          </h2>
          <p className="mt-1 text-sm text-ink/70 dark:text-white/70">
            Receba lembretes de pendências direto no navegador, sem precisar ficar checando a tela.
          </p>
          {erro && <p className="mt-2 text-sm text-danger">{erro}</p>}
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="secondary" size="md" fullWidth onClick={agoraNao} disabled={enviando}>
            Agora não
          </Button>
          <Button variant="primary" size="md" fullWidth onClick={ativar} loading={enviando}>
            Ativar
          </Button>
        </div>
      </div>
    </div>
  );
}
