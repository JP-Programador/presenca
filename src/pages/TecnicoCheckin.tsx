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
 * Porta de entrada única do técnico — presença normal e, quando o líder
 * exigir, o fechamento do atendimento (saída) passam pelo MESMO link e pela
 * MESMA tela. O servidor decide sozinho (olhando o banco) se a marcação é
 * entrada ou saída — o técnico nunca escolhe, só confirma a matrícula e
 * segue a instrução na tela.
 */
export function TecnicoCheckin() {
  const [codigoFilial, setCodigoFilial] = useState("");
  const [matricula4, setMatricula4] = useState("");
  const [statusValidacao, setStatusValidacao] = useState<StatusValidacao>("vazio");
  const [nomeEncontrado, setNomeEncontrado] = useState<string | null>(null);
  const [liderNome, setLiderNome] = useState<string | null>(null);
  const [exigeSaida, setExigeSaida] = useState(false);
  const [proximaMarcacao, setProximaMarcacao] = useState<"entrada" | "saida">("entrada");
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{
    nome: string;
    tipo: "entrada" | "saida";
    status?: string;
    horario: string;
  } | null>(null);

  const camera = useCamera();
  const geo = useGeolocation();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const validacaoAtualRef = useRef(0);

  // Validação ao vivo: assim que filial + 4 dígitos estão preenchidos, confirma
  // no servidor (debounced) se existe colaborador ativo com esses dados, e já
  // traz o preview de qual vai ser a próxima marcação.
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
        setLiderNome(resposta.lider_nome ?? null);
        setExigeSaida(resposta.exige_saida ?? false);
        setProximaMarcacao(resposta.proxima_marcacao ?? "entrada");
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

  const textoBotaoEnvio = proximaMarcacao === "saida" ? "Registrar saída / finalização" : "Registrar presença / entrada";

  return (
    <div className="min-h-screen bg-surface dark:bg-[#1A1A1A]">
      <BrandHeader title="Registro de presença" subtitle="Entrada do técnico em campo" />

      <main className="mx-auto max-w-md px-4 py-6 sm:py-10">
        <p className="mb-4 text-center text-xs font-medium text-ink/60 dark:text-white/60">
          A presença só deve ser confirmada no local do cliente.
        </p>

        {resultado ? (
          <Card>
            <CardBody className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E7F3E8] text-2xl text-[#2E7D32]">
                ✓
              </div>
              <div>
                <h2 className="text-lg font-semibold text-ink dark:text-white">
                  {resultado.tipo === "saida" ? "Saída registrada" : "Presença registrada"}
                </h2>
                <p className="mt-1 text-sm text-ink/60 dark:text-white/60">
                  {resultado.nome} · {resultado.horario}
                </p>
                {resultado.status === "atrasado" && (
                  <p className="mt-2 text-sm font-medium text-warning">
                    Registrado como atrasado. Se necessário, envie uma justificativa ao seu líder.
                  </p>
                )}
              </div>
              <Alert variant="warning">
                Observação: este é apenas um sistema interno de chamada da operação. Ele não substitui o app de ponto
                Ahgora — é obrigatório continuar registrando todas as batidas de ponto normalmente pelo Ahgora.
              </Alert>
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
                  <div className="text-sm">
                    <p className="font-semibold text-[#2E7D32]">✓ {nomeEncontrado}</p>
                    {liderNome && (
                      <p className="text-xs text-ink/50 dark:text-white/50">Líder: {liderNome}</p>
                    )}
                  </div>
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
                        {textoBotaoEnvio}
                      </Button>
                      <p className="mt-2 text-center text-xs text-ink/50 dark:text-white/50">
                        Foto e localização são obrigatórias para concluir o registro.
                        {exigeSaida && (
                          <>
                            <br />
                            Primeira marcação registra sua entrada. Segunda marcação registra sua saída.
                          </>
                        )}
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
