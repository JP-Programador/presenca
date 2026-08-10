import { useEffect, useRef, useState } from "react";
import { BrandHeader } from "@/components/layout/BrandHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { StatusChip } from "@/components/ui/StatusChip";
import { useCamera } from "@/hooks/useCamera";
import { useGeolocation } from "@/hooks/useGeolocation";
import { enviarCheckin, validarColaborador } from "@/services/checkinService";

type StatusValidacao = "vazio" | "verificando" | "encontrado" | "nao_encontrado";

/**
 * Tela pública de presença — hoje só marca ENTRADA (as demais marcações
 * ficam pra quando o fluxo completo de jornada for habilitado). Tudo numa
 * tela só: identificação, câmera e GPS aparecem juntos; a matrícula é
 * validada ao vivo (debounce) e barra o envio se não achar o colaborador.
 */
export function TecnicoCheckin() {
  const [codigoFilial, setCodigoFilial] = useState("");
  const [matricula4, setMatricula4] = useState("");
  const [statusValidacao, setStatusValidacao] = useState<StatusValidacao>("vazio");
  const [nomeEncontrado, setNomeEncontrado] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ nome: string; status: string; horario: string } | null>(null);

  const camera = useCamera();
  const geo = useGeolocation();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const validacaoAtualRef = useRef(0);

  // Validação ao vivo: assim que filial + 4 dígitos estão preenchidos, confirma
  // no servidor (debounced) se existe colaborador ativo com esses dados.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (codigoFilial.trim().length === 0 || matricula4.length !== 4) {
      validacaoAtualRef.current += 1;
      setStatusValidacao("vazio");
      setNomeEncontrado(null);
      return;
    }

    setStatusValidacao("verificando");
    const idDestaValidacao = ++validacaoAtualRef.current;
    debounceRef.current = setTimeout(async () => {
      const resposta = await validarColaborador(codigoFilial.trim(), matricula4);
      // Descarta se uma digitação mais recente já disparou outra validação.
      if (idDestaValidacao !== validacaoAtualRef.current) return;
      if (resposta.encontrado) {
        setStatusValidacao("encontrado");
        setNomeEncontrado(resposta.nome ?? null);
        if (camera.status === "idle") camera.iniciar();
        geo.capturar();
      } else {
        setStatusValidacao("nao_encontrado");
        setNomeEncontrado(null);
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigoFilial, matricula4]);

  const identificado = statusValidacao === "encontrado";
  const podeEnviar = identificado && camera.pronto && geo.pronto;

  async function enviarPresenca() {
    if (!podeEnviar || !camera.fotoDataUrl || !geo.coords) return;
    setEnviando(true);
    setErroEnvio(null);

    try {
      const resposta = await enviarCheckin({
        codigoFilial: codigoFilial.trim(),
        matricula4,
        tipo: "entrada",
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
        status: resposta.status,
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
    setErroEnvio(null);
    setResultado(null);
  }

  return (
    <div className="min-h-screen bg-surface dark:bg-[#1A1A1A]">
      <BrandHeader title="Registro de presença" subtitle="Entrada do técnico em campo" />

      <main className="mx-auto max-w-md px-4 py-6 sm:py-10">
        {resultado ? (
          <Card>
            <CardBody className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E7F3E8] text-2xl text-[#2E7D32]">
                ✓
              </div>
              <div>
                <h2 className="text-lg font-semibold text-ink dark:text-white">Presença registrada</h2>
                <p className="mt-1 text-sm text-ink/60 dark:text-white/60">
                  {resultado.nome} · {resultado.horario}
                </p>
                {resultado.status === "atrasado" && (
                  <p className="mt-2 text-sm font-medium text-warning">
                    Registrado como atrasado. Se necessário, envie uma justificativa ao seu líder.
                  </p>
                )}
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
                          alt="Foto capturada para o registro de presença"
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
                      <Button size="lg" fullWidth disabled={!podeEnviar} loading={enviando} onClick={enviarPresenca}>
                        Enviar presença
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
