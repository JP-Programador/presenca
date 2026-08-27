import { useState } from "react";
import { obterUrlFoto } from "@/services/presencaService";
import { FotoModal } from "@/components/presenca/FotoModal";

interface VerFotoBotaoProps {
  fotoPath: string;
  nome: string;
}

/** Botão "Ver foto" reutilizável — abre a foto num modal (nunca em nova guia). */
export function VerFotoBotao({ fotoPath, nome }: VerFotoBotaoProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function abrir() {
    setCarregando(true);
    const link = await obterUrlFoto(fotoPath);
    setUrl(link);
    setCarregando(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        disabled={carregando}
        className="rounded-full border border-ink/15 px-2.5 py-1 text-xs font-semibold text-ink/60 hover:bg-surface dark:border-white/15 dark:text-white/60 dark:hover:bg-white/5"
      >
        {carregando ? "Carregando..." : "📷 Ver foto"}
      </button>
      {url && <FotoModal url={url} titulo={`Foto do check-in de ${nome}`} onFechar={() => setUrl(null)} />}
    </>
  );
}
