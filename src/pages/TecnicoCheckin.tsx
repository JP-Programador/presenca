import { FormEvent, useState } from "react";
import { BrandHeader } from "@/components/layout/BrandHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { StatusChip } from "@/components/ui/StatusChip";
import { useCamera } from "@/hooks/useCamera";
import { useGeolocation } from "@/hooks/useGeolocation";
import { enviarCheckin } from "@/services/checkinService";
import type { TipoMarcacao } from "@/types/domain";

const TIPOS: { valor: TipoMarcacao; label: string }[] = [
  { valor: "entrada", label: "Entrada" },
  { valor: "inicio_intervalo", label: "Início do intervalo" },
  { valor: "fim_intervalo", label: "Fim do intervalo" },
  { valor: "saida", label: "Saída" },
];

type Etapa = "identificacao" | "captura" | "enviando" | "sucesso";

export function TecnicoCheckin() {
  const [etapa, setEtapa] = useState<Etapa>("identificacao");
  const [codigoFilial, setCodigoFilial] = useState("");
  const [matricula4, setMatricula4] = useState("");
  const [tipo, setTipo] = useState<TipoMarcacao>("entrada");
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ nome: string; status: string; horario: string } | null>(
    null
  );

  const camera = useCamera();
  const geo = useGeolocation();

  const podeAvancarIdentificacao = codigoFilial.trim().length > 0 && matricula4.trim().length === 4;
  const podeEnviar = camera.pronto && geo.pronto;

  function iniciarCaptura(e: FormEvent) {
    e.preventDefault();
    if (!podeAvancarIdentificacao) return;
    setEtapa("captura");
    camera.iniciar();
    geo.capturar();
  }

  async function enviarPresenca() {
    if (!podeEnviar || !camera.fotoDataUrl || !geo.coords) return;
    setEtapa("enviando");
    setErroEnvio(null);

    const resposta = await enviarCheckin({
      codigoFilial: codigoFilial.trim(),
      matricula4: matricula4.trim(),
      tipo,
      fotoDataUrl: camera.fotoDataUrl,
      latitude: geo.coords.latitude,
      longitude: geo.coords.longitude,
      precisao: geo.coords.precisao,
    });

    if (!resposta.ok) {
      setErroEnvio(resposta.mensagem);
      setEtapa("captura");
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
    setEtapa("sucesso");
  }

  function registrarNovamente() {
    setEtapa("identificacao");
    setCodigoFilial("");
    setMatricula4("");
    setTipo("entrada");
    setErroEnvio(null);
    setResultado(null);
  }

  return (
    <div className="min-h-screen bg-surface">
      <BrandHeader title="Registro de presença" subtitle="Ponto do técnico em campo" />

      <main className="mx-auto max-w-md px-4 py-6 sm:py-10">
        {etapa === "identificacao" && (
          <Card>
            <CardBody className="flex flex-col gap-5">
              <div>
                <h2 className="text-base font-semibold text-ink">Identifique-se</h2>
                <p className="mt-1 text-sm text-ink/60">
                  Informe o código da sua filial e os 4 últimos dígitos da sua matrícula para continuar.
                </p>
              </div>

              <form onSubmit={iniciarCaptura} className="flex flex-col gap-4">
                <Input
                  id="codigo-filial"
                  label="Código da filial"
                  placeholder="Ex.: 1768"
                  value={codigoFilial}
                  onChange={(e) => setCodigoFilial(e.target.value)}
                  autoComplete="off"
                  inputMode="numeric"
                  required
                />
                <Input
                  id="matricula4"
                  label="4 últimos dígitos da matrícula"
                  placeholder="0000"
                  value={matricula4}
                  onChange={(e) => setMatricula4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  autoComplete="off"
                  inputMode="numeric"
                  maxLength={4}
                  required
                />

                <div>
                  <span className="mb-1.5 block text-sm font-medium text-ink">Tipo de marcação</span>
                  <div className="grid grid-cols-2 gap-2">
                    {TIPOS.map((opcao) => (
                      <button
                        type="button"
                        key={opcao.valor}
                        onClick={() => setTipo(opcao.valor)}
                        className={[
                          "rounded-md border px-3 py-2.5 text-sm font-semibold transition-colors",
                          tipo === opcao.valor
                            ? "border-primary bg-[#FDE9DD] text-primary-dark"
                            : "border-ink/15 bg-white text-ink/70 hover:bg-surface",
                        ].join(" ")}
                      >
                        {opcao.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Button type="submit" size="lg" fullWidth disabled={!podeAvancarIdentificacao}>
                  Continuar
                </Button>
              </form>
            </CardBody>
          </Card>
        )}

        {etapa === "captura" && (
          <div className="flex flex-col gap-4">
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
                    <video
                      ref={camera.videoRef}
                      className="aspect-square w-full object-cover"
                      playsInline
                      muted
                    />
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
                  <Button
                    variant="secondary"
                    fullWidth
                    onClick={geo.capturar}
                    loading={geo.status === "solicitando"}
                  >
                    Tentar obter localização novamente
                  </Button>
                )}

                <div className="border-t border-ink/10 pt-4">
                  <Button
                    size="lg"
                    fullWidth
                    disabled={!podeEnviar}
                    onClick={enviarPresenca}
                  >
                    Enviar presença
                  </Button>
                  <p className="mt-2 text-center text-xs text-ink/50">
                    Foto e localização são obrigatórias para concluir o registro.
                  </p>
                </div>
              </CardBody>
            </Card>

            <button
              type="button"
              onClick={registrarNovamente}
              className="text-center text-sm font-medium text-ink/50 underline-offset-2 hover:underline"
            >
              Voltar e corrigir filial/matrícula
            </button>
          </div>
        )}

        {etapa === "enviando" && (
          <Card>
            <CardBody className="flex flex-col items-center gap-3 py-10 text-center">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm font-medium text-ink/70">Enviando sua presença…</p>
            </CardBody>
          </Card>
        )}

        {etapa === "sucesso" && resultado && (
          <Card>
            <CardBody className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E7F3E8] text-2xl text-[#2E7D32]">
                ✓
              </div>
              <div>
                <h2 className="text-lg font-semibold text-ink">Presença registrada</h2>
                <p className="mt-1 text-sm text-ink/60">
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
        )}
      </main>
    </div>
  );
}
