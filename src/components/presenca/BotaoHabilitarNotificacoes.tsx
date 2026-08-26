import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { habilitarNotificacoes, notificacoesAtivas, suportaNotificacoes } from "@/services/pushService";

export function BotaoHabilitarNotificacoes() {
  const [ativas, setAtivas] = useState<boolean | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (suportaNotificacoes()) notificacoesAtivas().then(setAtivas);
    else setAtivas(null);
  }, []);

  async function habilitar() {
    setCarregando(true);
    try {
      await habilitarNotificacoes();
      setAtivas(true);
    } catch {
      // silencioso — usuário pode ter negado a permissão, sem travar o resto da tela
    } finally {
      setCarregando(false);
    }
  }

  if (!suportaNotificacoes() || ativas === null || ativas) return null;

  return (
    <Button variant="ghost" size="md" onClick={habilitar} loading={carregando} disabled={carregando}>
      Habilitar notificações
    </Button>
  );
}
