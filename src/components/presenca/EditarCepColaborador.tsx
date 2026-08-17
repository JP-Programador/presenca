import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { MapaAjusteCoordenada } from "@/components/presenca/MapaAjusteCoordenada";
import { atualizarCepColaborador, atualizarCoordenadaManual } from "@/services/colaboradoresService";
import type { PrecisaoGeocodificacao } from "@/services/colaboradoresService";

interface EditarCepColaboradorProps {
  colaboradorId: string;
  cepAtual: string | null;
  latitudeAtual: number | null;
  longitudeAtual: number | null;
  precisaoAtual: PrecisaoGeocodificacao | null;
  onAtualizado: () => void;
}

const PRECISAO_LABEL: Record<PrecisaoGeocodificacao, { texto: string; classe: string }> = {
  exata: { texto: "Endereço localizado com precisão", classe: "bg-[#E7F3E8] text-[#2E7D32]" },
  bairro: { texto: "Localizado por aproximação de bairro", classe: "bg-[#FFF3DB] text-[#8A6200]" },
  cidade: {
    texto: "Localizado só pelo centro da cidade — alerta de proximidade não funciona nesse nível, ajuste o pino abaixo",
    classe: "bg-[#FBE7E7] text-danger",
  },
  manual: { texto: "Posição ajustada manualmente", classe: "bg-[#E3EEFA] text-[#1E6FA8]" },
};

/** Campo inline pra cadastrar/trocar o CEP residencial de um colaborador já existente — base do alerta de check-in perto de casa. */
export function EditarCepColaborador({
  colaboradorId,
  cepAtual,
  latitudeAtual,
  longitudeAtual,
  precisaoAtual,
  onAtualizado,
}: EditarCepColaboradorProps) {
  const [aberto, setAberto] = useState(false);
  const [cep, setCep] = useState(cepAtual ?? "");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Prévia local pra permitir arrastar o pino sem precisar reabrir o formulário.
  const [previa, setPrevia] = useState<{ latitude: number; longitude: number; precisao: PrecisaoGeocodificacao } | null>(
    latitudeAtual != null && longitudeAtual != null && precisaoAtual
      ? { latitude: latitudeAtual, longitude: longitudeAtual, precisao: precisaoAtual }
      : null
  );
  const [ajustandoPino, setAjustandoPino] = useState(false);

  if (!aberto) {
    return (
      <Button variant="ghost" size="md" onClick={() => setAberto(true)}>
        {cepAtual ? "Trocar CEP" : "Cadastrar CEP"}
      </Button>
    );
  }

  async function salvar() {
    if (!cep.trim()) {
      setErro("Informe um CEP.");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const coordenada = await atualizarCepColaborador(colaboradorId, cep.trim());
      if (!coordenada) {
        setErro("Não foi possível localizar esse CEP em nenhum mapa — confira se está certo.");
        setPrevia(null);
        setEnviando(false);
        return;
      }
      setPrevia(coordenada);
      onAtualizado();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar o CEP.");
    } finally {
      setEnviando(false);
    }
  }

  async function ajustarPino(latitude: number, longitude: number) {
    setAjustandoPino(true);
    try {
      await atualizarCoordenadaManual(colaboradorId, latitude, longitude);
      setPrevia({ latitude, longitude, precisao: "manual" });
      onAtualizado();
    } finally {
      setAjustandoPino(false);
    }
  }

  const rotulo = previa ? PRECISAO_LABEL[previa.precisao] : null;

  return (
    <div className="flex w-full max-w-xs flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={cep}
          onChange={(e) => setCep(e.target.value)}
          placeholder="00000-000"
          className="h-9 w-28 rounded-md border border-ink/20 bg-white px-2 text-xs text-ink dark:border-white/20 dark:bg-[#242424] dark:text-white"
        />
        <Button variant="primary" size="md" loading={enviando} onClick={salvar}>
          Salvar
        </Button>
        <Button variant="ghost" size="md" onClick={() => setAberto(false)} disabled={enviando}>
          Cancelar
        </Button>
      </div>

      {erro && <span className="text-xs font-medium text-danger">{erro}</span>}

      {rotulo && (
        <span className={["w-fit rounded-full px-2.5 py-1 text-xs font-semibold", rotulo.classe].join(" ")}>
          {rotulo.texto}
        </span>
      )}

      {previa && (
        <>
          {ajustandoPino ? (
            <span className="text-xs text-ink/50 dark:text-white/50">Salvando posição...</span>
          ) : (
            <MapaAjusteCoordenada latitude={previa.latitude} longitude={previa.longitude} onMudar={ajustarPino} />
          )}
          <p className="text-[11px] text-ink/50 dark:text-white/50">
            Se o pino não estiver exatamente na casa, arraste pra posição certa — ajusta e salva sozinho.
          </p>
        </>
      )}
    </div>
  );
}
