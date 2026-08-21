import { useEffect, useRef, useState } from "react";
import { BrandHeader } from "@/components/layout/BrandHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { StatusChip } from "@/components/ui/StatusChip";
import { useCamera } from "@/hooks/useCamera";
import { useGeolocation } from "@/hooks/useGeolocation";
import { registrarAtendimento, validarAtendimento } from "@/services/atendimentoService";

type StatusValidacao = "vazio" | "verificando" | "encontrado" | "nao_encontrado";

/**
 * Tela pública de check-in/check-out de atendimento (visita a cliente) —
 * independente da presença diária normal (que fica em "/" e "/ponto"). O
 * servidor decide sozinho se a marcação é chegada ou saída; a saída só é
 * pedida se o líder do colaborador exigir (ver /lider).
 */
export function TecnicoAtendimento() {
  const [codigoFilial, setCodigoFilial] = useState("");
  const [matricula4, setMatricula4] = useState("");
  const [statusValidacao, setStatusValidacao] = useState<StatusValidacao>("vazio");
  const [nomeEncontrado, setNomeEncontrado] = useState<string | null>(null);
  const [proximoTipo, setProximoTipo] = useState<"entrada" | "saida" | null>(null);
  const [jaCompleto, setJaCompleto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ nome: string; tipo: "entrada" | "saida"; horario: string } | null>(
    null
  );

  const camera = useCamera();
  const geo = useGeolocation();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const validacaoAtualRef = useRef(0);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (codigoFilial.trim().length === 0 || matricula4.length !== 4) {
      validacaoAtualRef.current += 1;
      setStatusValidacao("vazio");
      setNomeEncontrado(null);
      setProximoTipo(null);
      setJaCompleto(false);
      return;
    }

    setStatusValidacao("verificando");
    const idDestaValidacao = ++validacaoAtualRef.current;
    debounceRef.current = setTimeout(async () => {
      const resposta = await validarAtendimento(codigoFilial.trim(), matricula4);
      if (idDestaValidacao !== validacaoAtualRef.current) return;
      if (resposta.encontrado) {
        setStatusValidacao("encontrado");
        setNomeEncontrado(resposta.nome ?? null);
        if (!resposta.tem_entrada_hoje) {
          setProximoTipo("entrada");
          setJaCompleto(false);
        } else if (resposta.exige_saida && !resposta.tem_saida_hoje) {
          setProximoTipo("saida");
          setJaCompleto(false);
        } else {
          setProximoTipo(null);
          setJaCompleto(true);
        }
        if (!jaCompleto && camera.status === "idle") camera.iniciar();
        geo.capturar();
      } else {
        setStatusValidacao("nao_encontrado");
        setNomeEncontrado(null);
        setProximoTipo(null);
        setJaCompleto(false);
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigoFilial, matricula4]);

  const identificado = statusValidacao === "encontrado" && !jaCompleto;
  const podeEnviar = identificado && camera.pronto && geo.pronto;

  async function enviarAtendimento() {
    if (!podeEnviar || !camera.fotoDataUrl || !geo.coords) return;
    setEnviando(true);
    setErroEnvio(null);

    try {
      const resposta = await registrarAtendimento({
        codigoFilial: codigoFilial.trim(),
        matricula4,
        fotoDataUrl: camera.fotoDataUrl,
        latitude: geo.coords.latitude,
        longitude: geo.coords.longitude,
        precisao: geo.coords.precisao,
      });

      if (!resposta.ok) {
        setErroEnvio(resposta.mensagem);
        return;
      }

      setResultado({
        nome: resposta.colaborador_nome,
        tipo: resposta.tipo,
        horario: new Date(resposta.horario_registrado).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      });
    } finally {
      setEnviando(false);
    }
  }

  function registrarNovamente() {
    setCodigoFilial("");
    setMatricula4("");
    setStatusValidacao("vazio");
    setNomeEncontrado(null);
    setProximoTipo(null);
    setJaCompleto(false);
    setErroEnvio(null);
    setResultado(null);
  }

  const tituloAcao = proximoTipo === "saida" ? "Registrar saída do atendimento" : "Registrar chegada no atendimento";

  return (
    <div className="min-h-screen bg-surface dark:bg-[#1A1A1A]">
      <BrandHeader title="Atendimento" subtitle="Chegada e saída de visita a cliente" />

      <main className="mx-auto max-w-md px-4 py-6 sm:py-10">
        {resultado ? (
          <Card>
            <CardBody className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E7F3E8] text-2xl text-[#2E7D32]">
                ✓
              </div>
              <div>
                <h2 className="text-lg font-semibold text-ink dark:text-white">
                  {resultado.tipo === "entrada" ? "Chegada registrada" : "Saída registrada"}
                </h2>
                <p className="mt-1 text-sm text-ink/60 dark:text-white/60">
                  {resultado.nome} · {resultado.horario}
                </p>
              </div>
              <Button fullWidth onClick={registrarNovamente}>
                Novo registro
              </Button>
            </CardBody>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            <Card>
              <CardBody className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    id="codigo-filial"
                    label="Código da filial"
                    placeholder="Ex.: 24"
                    value={codigoFilial}
                    onChange={(e) => setCodigoFilial(e.target.value)}
                    autoComplete="off"
                    inputMode="numeric"
                  />
                  <Input
                    id="matricula4"
                    label="4 últimos da matrícula"
                    placeholder="0000"
                    value={matricula4}
                    onChange={(e) => setMatricula4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    autoComplete="off"
                    inputMode="numeric"
                    maxLength={4}
                  />
                </div>

                {statusValidacao === "verificando" && (
                  <p className="text-xs font-medium text-ink/50 dark:text-white/50">Verificando…</p>
                )}
                {statusValidacao === "encontrado" && nomeEncontrado && (
                  <p className="text-sm font-semibold text-[#2E7D32]">✓ {nomeEncontrado}</p>
                )}
                {statusValidacao === "encontrado" && jaCompleto && (
                  <Alert variant="success">Atendimento de hoje já foi totalmente registrado.</Alert>
                )}
                {statusValidacao === "nao_encontrado" && (
                  <Alert variant="danger">
                    Colaborador não encontrado para essa filial/matrícula. Confira os dados ou fale com o seu
                    líder direto antes de continuar.
                  </Alert>
                )}
              </CardBody>
            </Card>

            {identificado && (
              <>
                <div className="flex gap-2">
                  <StatusChip
                    label={camera.pronto ? "Foto capturada" : "Foto obrigatória"}
                    ok={camera.pronto}
                    pending={camera.status === "solicitando" || camera.status === "ativa"}
                    icon={<i className="not-italic">📷</i>}
                  />
                  <StatusChip
                    label={geo.pronto ? "GPS capturado" : "GPS obrigatório"}
                    ok={geo.pronto}
                    pending={geo.status === "solicitando"}
                    icon={<i className="not-italic">📍</i>}
                  />
                </div>

                {(camera.erro || geo.erro || erroEnvio) && (
                  <Alert variant="danger" title="Não foi possível continuar">
                    {camera.erro || geo.erro || erroEnvio}
                  </Alert>
                )}

                <Card>
                  <CardBody className="flex flex-col gap-4">
                    <div className="overflow-hidden rounded-md bg-ink/5">
                      {camera.status !== "capturada" ? (
                        <video ref={camera.videoRef} className="aspect-square w-full object-cover" playsInline muted />
                      ) : (
                        <img
                          src={camera.fotoDataUrl ?? undefined}
                          alt="Foto capturada para o registro de atendimento"
                          className="aspect-square w-full object-cover"
                        />
                      )}
                    </div>

                    {camera.status === "capturada" ? (
                      <Button variant="secondary" fullWidth onClick={camera.refazer}>
                        Tirar outra foto
                      </Button>
                    ) : (
                      <Button
                        fullWidth
                        onClick={camera.capturar}
                        disabled={camera.status !== "ativa"}
                        loading={camera.status === "solicitando"}
                      >
                        Capturar foto
                      </Button>
                    )}

                    {geo.status !== "capturado" && (
                      <Button variant="secondary" fullWidth onClick={geo.capturar} loading={geo.status === "solicitando"}>
                        Tentar obter localização novamente
                      </Button>
                    )}

                    <div className="border-t border-ink/10 pt-4 dark:border-white/10">
                      <Button size="lg" fullWidth disabled={!podeEnviar} loading={enviando} onClick={enviarAtendimento}>
                        {tituloAcao}
                      </Button>
                      <p className="mt-2 text-center text-xs text-ink/50 dark:text-white/50">
                        Foto e localização são obrigatórias para concluir o registro.
                      </p>
                    </div>
                  </CardBody>
                </Card>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
