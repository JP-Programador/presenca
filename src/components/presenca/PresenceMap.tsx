import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { MapContainer, TileLayer, CircleMarker, Circle, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { listarLideresPorFilial, listarMapaOperacionalPeriodo, type LiderFilial } from "@/services/mapaOperacionalService";
import { listarColaboradores } from "@/services/colaboradoresService";
import { listarSaidasPeriodo, type SaidaAtendimentoMapa } from "@/services/atendimentoService";
import { formatarDataHoraBR } from "@/lib/formato";
import { STATUS_DIA_HEX, STATUS_DIA_LABEL, type PontoMapaOperacional } from "@/types/status";

const CENTRO_BRASIL: [number, number] = [-14.235, -51.9253];

// DivIcon (emoji, sem asset de imagem) — evita o problema clássico do ícone
// padrão do Leaflet quebrando em bundlers (paths relativos ao CSS).
const ICONE_CASA = L.divIcon({
  html: '<div style="font-size: 22px; line-height: 1;">🏠</div>',
  className: "",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

// Saída de atendimento é uma marcação diferente da entrada (não é "onde ele
// terminou o dia", é só onde bateu o ponto de saída) — ícone próprio pra não
// confundir com os pontos de entrada/presença.
const ICONE_SAIDA = L.divIcon({
  html: '<div style="font-size: 20px; line-height: 1;">🏁</div>',
  className: "",
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

interface PresenceMapProps {
  pontos: PontoMapaOperacional[];
  /** Esconde os filtros (usado no MiniMapCard, que já recebe os dados pré-filtrados). */
  somenteExibicao?: boolean;
  /** Altura do mapa em px (padrão 420 — o MiniMapCard usa um valor menor). */
  altura?: number;
  /** Controla o filtro por nome de fora (ex.: sincronizado com a busca do painel de pendências) — esconde o campo de busca próprio. */
  filtroNomeExterno?: string;
  /** Marca a residência cadastrada (CEP geocodificado) com um ícone de casa — usado na trilha de um colaborador específico. */
  casaColaborador?: { latitude: number; longitude: number } | null;
  /** Marcação em destaque (ex.: clicada numa tabela) — centraliza/zoom o mapa nela e desenha um marcador diferenciado, sem esconder os demais pontos. */
  pontoFoco?: { latitude: number; longitude: number; label?: string } | null;
  /** Renderiza ações extras dentro do popup de cada marcador (ex.: Aprovar/Rejeitar quando o ponto está PENDENTE) — evita o líder ter que sair do mapa pra decidir. */
  renderAcoesPopup?: (ponto: PontoMapaOperacional) => ReactNode;
}

/** Recentraliza o mapa quando o ponto em destaque muda (MapContainer só lê center/zoom no mount). */
function RecentralizarNoFoco({ foco }: { foco: { latitude: number; longitude: number } | null | undefined }) {
  const mapa = useMap();
  useEffect(() => {
    if (foco) mapa.flyTo([foco.latitude, foco.longitude], 15, { duration: 0.6 });
  }, [foco, mapa]);
  return null;
}

/** Mapa operacional completo (Módulo 9): presentes/pendentes/faltas/atestados/folgas, com filtro por filial e líder. */
export function PresenceMap({
  pontos,
  somenteExibicao,
  altura = 420,
  filtroNomeExterno,
  casaColaborador,
  pontoFoco,
  renderAcoesPopup,
}: PresenceMapProps) {
  const [lideresPorFilial, setLideresPorFilial] = useState<LiderFilial[]>([]);
  const [residenciasPorColaborador, setResidenciasPorColaborador] = useState<
    Map<string, { latitude: number; longitude: number } | null>
  >(new Map());
  // Líder real de cada colaborador (colaboradores.lider_id) — o filtro por
  // líder precisa disso, não da filial (dois líderes podem dividir a mesma
  // filial, e aí filtrar só por filial mostra gente de outro líder junto).
  const [liderIdPorColaborador, setLiderIdPorColaborador] = useState<Map<string, string | null>>(new Map());
  const [filialFiltro, setFilialFiltro] = useState("");
  const [liderFiltro, setLiderFiltro] = useState("");
  const [colaboradorFiltro, setColaboradorFiltro] = useState("");
  const [trilhaColaborador, setTrilhaColaborador] = useState<PontoMapaOperacional[] | null>(null);
  const [saidasColaborador, setSaidasColaborador] = useState<SaidaAtendimentoMapa[]>([]);
  const [nomeFiltroInterno, setNomeFiltroInterno] = useState("");
  const nomeFiltroControlado = filtroNomeExterno !== undefined;
  const nomeFiltro = nomeFiltroControlado ? filtroNomeExterno : nomeFiltroInterno;

  useEffect(() => {
    if (somenteExibicao) return;
    listarLideresPorFilial()
      .then(setLideresPorFilial)
      .catch(() => setLideresPorFilial([]));
    // Residência cadastrada de cada colaborador — usada só quando o filtro
    // "colaborador" acima é escolhido, pra mostrar a casa (🏠) dele no mapa.
    listarColaboradores()
      .then((lista) => {
        setResidenciasPorColaborador(
          new Map(
            lista.map((c) => [
              c.id,
              c.latitude != null && c.longitude != null ? { latitude: c.latitude, longitude: c.longitude } : null,
            ])
          )
        );
        setLiderIdPorColaborador(new Map(lista.map((c) => [c.id, c.lider_id])));
      })
      .catch(() => {
        setResidenciasPorColaborador(new Map());
        setLiderIdPorColaborador(new Map());
      });
  }, [somenteExibicao]);

  const filiais = useMemo(() => {
    const mapa = new Map<string, string>();
    pontos.forEach((p) => mapa.set(p.filial_id, p.filial_nome));
    return Array.from(mapa.entries()).map(([id, nome]) => ({ id, nome }));
  }, [pontos]);

  const lideres = useMemo(() => {
    const mapa = new Map<string, string>();
    lideresPorFilial.forEach((l) => mapa.set(l.lider_id, l.lider_nome));
    return Array.from(mapa.entries()).map(([id, nome]) => ({ id, nome }));
  }, [lideresPorFilial]);

  const colaboradores = useMemo(() => {
    const mapa = new Map<string, string>();
    pontos
      .filter((p) => p.status === "PRESENTE" || p.status === "PENDENTE")
      // Mesmos filtros de filial/líder da lista de pontos no mapa (não inclui
      // o próprio filtro de colaborador nem o de nome, senão o select passaria
      // a mostrar só quem já está selecionado).
      .filter((p) => !filialFiltro || p.filial_id === filialFiltro)
      .filter((p) => !liderFiltro || liderIdPorColaborador.get(p.colaborador_id) === liderFiltro)
      .forEach((p) => mapa.set(p.colaborador_id, p.colaborador_nome));
    return Array.from(mapa.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [pontos, filialFiltro, liderFiltro, liderIdPorColaborador]);

  useEffect(() => {
    if (colaboradorFiltro && !colaboradores.some((c) => c.id === colaboradorFiltro)) {
      setColaboradorFiltro("");
    }
  }, [colaboradores, colaboradorFiltro]);

  // Selecionou um colaborador no filtro: mostra todas as marcações dele no
  // mês corrente (não só o snapshot de hoje que a tela já tinha carregado),
  // pra dar a "trilha" completa junto com a casa (🏠) — e também as saídas
  // de atendimento do período (marcação separada, ícone próprio: não é o
  // último endereço atendido, é só onde ele bateu a saída).
  useEffect(() => {
    if (!colaboradorFiltro) {
      setTrilhaColaborador(null);
      setSaidasColaborador([]);
      return;
    }
    const hoje = new Date();
    const inicioMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;
    const hojeISO = hoje.toISOString().slice(0, 10);
    let cancelado = false;
    listarMapaOperacionalPeriodo(inicioMes, hojeISO, colaboradorFiltro)
      .then((lista) => {
        if (!cancelado) setTrilhaColaborador(lista);
      })
      .catch(() => {
        if (!cancelado) setTrilhaColaborador([]);
      });
    listarSaidasPeriodo(inicioMes, hojeISO, colaboradorFiltro)
      .then((lista) => {
        if (!cancelado) setSaidasColaborador(lista);
      })
      .catch(() => {
        if (!cancelado) setSaidasColaborador([]);
      });
    return () => {
      cancelado = true;
    };
  }, [colaboradorFiltro]);

  const filtrados = useMemo(() => {
    const termo = (nomeFiltro ?? "").trim().toLowerCase();
    // Com um colaborador selecionado, mostra a trilha do mês inteiro (todas
    // as marcações dele) em vez de só o snapshot de hoje.
    const base = colaboradorFiltro && trilhaColaborador ? trilhaColaborador : pontos;
    return base.filter((p) => {
      // O mapa mostra quem fez check-in de verdade (Presente ou aguardando
      // aprovação, ambos com GPS do próprio check-in). Se o líder marcou
      // Falta/Atestado/Folga/Outros manualmente, some do mapa — esses não têm
      // localização de check-in e o status manual do líder prevalece.
      if (p.status !== "PRESENTE" && p.status !== "PENDENTE") return false;
      if (filialFiltro && p.filial_id !== filialFiltro) return false;
      if (liderFiltro && liderIdPorColaborador.get(p.colaborador_id) !== liderFiltro) return false;
      if (colaboradorFiltro && p.colaborador_id !== colaboradorFiltro) return false;
      if (termo && !p.colaborador_nome?.toLowerCase().includes(termo)) return false;
      return true;
    });
  }, [pontos, trilhaColaborador, filialFiltro, liderFiltro, liderIdPorColaborador, colaboradorFiltro, nomeFiltro]);

  const comCoordenadas = filtrados.filter((p) => p.latitude != null && p.longitude != null);

  // Residência do colaborador escolhido no filtro acima (quando existe),
  // ou a passada explicitamente por fora (ex.: trilha de um colaborador
  // específico, que já esconde os filtros).
  const casaDoFiltro = colaboradorFiltro ? residenciasPorColaborador.get(colaboradorFiltro) ?? null : null;
  const casaFinal = casaColaborador ?? casaDoFiltro;

  const centro: [number, number] =
    comCoordenadas.length > 0
      ? [comCoordenadas[0].latitude as number, comCoordenadas[0].longitude as number]
      : casaFinal
        ? [casaFinal.latitude, casaFinal.longitude]
        : CENTRO_BRASIL;

  return (
    <div className="flex flex-col gap-3">
      {!somenteExibicao && (
        <div className="flex flex-wrap gap-2">
          {!nomeFiltroControlado && (
            <input
              value={nomeFiltroInterno}
              onChange={(e) => setNomeFiltroInterno(e.target.value)}
              placeholder="Buscar colaborador..."
              className="h-10 flex-1 min-w-[160px] rounded-md border border-ink/15 bg-white px-3 text-sm text-ink dark:border-white/15 dark:bg-[#242424] dark:text-white"
            />
          )}
          <select
            value={filialFiltro}
            onChange={(e) => setFilialFiltro(e.target.value)}
            className="h-10 rounded-md border border-ink/15 bg-white px-3 text-sm text-ink dark:border-white/15 dark:bg-[#242424] dark:text-white"
          >
            <option value="">Todas as filiais</option>
            {filiais.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
          <select
            value={liderFiltro}
            onChange={(e) => setLiderFiltro(e.target.value)}
            className="h-10 rounded-md border border-ink/15 bg-white px-3 text-sm text-ink dark:border-white/15 dark:bg-[#242424] dark:text-white"
          >
            <option value="">Todos os líderes</option>
            {lideres.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </select>
          <select
            value={colaboradorFiltro}
            onChange={(e) => setColaboradorFiltro(e.target.value)}
            className="h-10 rounded-md border border-ink/15 bg-white px-3 text-sm text-ink dark:border-white/15 dark:bg-[#242424] dark:text-white"
          >
            <option value="">Todos os colaboradores</option>
            {colaboradores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-ink/10">
        <MapContainer
          center={centro}
          zoom={comCoordenadas.length > 0 || casaFinal ? 11 : 4}
          style={{ height: `${altura}px`, width: "100%" }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {pontoFoco && <RecentralizarNoFoco foco={pontoFoco} />}
          {!pontoFoco && casaDoFiltro && <RecentralizarNoFoco foco={casaDoFiltro} />}
          {pontoFoco && (
            <CircleMarker
              center={[pontoFoco.latitude, pontoFoco.longitude]}
              radius={12}
              pathOptions={{ color: "#8A6200", fillColor: "#FFC53D", fillOpacity: 0.9, weight: 3 }}
            >
              <Popup>
                <div className="text-xs">
                  <p className="font-semibold">{pontoFoco.label ?? "Marcação selecionada"}</p>
                </div>
              </Popup>
            </CircleMarker>
          )}
          {comCoordenadas.map((p) => (
            <Fragment key={p.status_dia_id}>
              {p.precisao_metros != null && (
                <Circle
                  center={[p.latitude as number, p.longitude as number]}
                  radius={p.precisao_metros}
                  pathOptions={{ color: STATUS_DIA_HEX[p.status], fillOpacity: 0.08, weight: 1 }}
                />
              )}
              <CircleMarker
                center={[p.latitude as number, p.longitude as number]}
                radius={8}
                pathOptions={{
                  color: STATUS_DIA_HEX[p.status],
                  fillColor: STATUS_DIA_HEX[p.status],
                  fillOpacity: 0.85,
                }}
              >
                <Popup>
                  <div className="text-xs">
                    <p className="font-semibold">{p.colaborador_nome}</p>
                    <p>{STATUS_DIA_LABEL[p.status]}</p>
                    {p.endereco_completo && <p>{p.endereco_completo}</p>}
                    {p.horario_registrado && (
                      <p>
                        {new Date(p.horario_registrado).toLocaleString("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </p>
                    )}
                    {p.precisao_metros != null && <p>Precisão do GPS: ±{Math.round(p.precisao_metros)}m</p>}
                    {renderAcoesPopup && <div className="mt-2">{renderAcoesPopup(p)}</div>}
                  </div>
                  </Popup>
              </CircleMarker>
            </Fragment>
          ))}
          {casaFinal && (
            <Marker position={[casaFinal.latitude, casaFinal.longitude]} icon={ICONE_CASA}>
              <Popup>
                <div className="text-xs">
                  <p className="font-semibold">Residência cadastrada</p>
                </div>
              </Popup>
            </Marker>
          )}
          {colaboradorFiltro &&
            saidasColaborador.map((s) => (
              <Marker key={s.id} position={[s.latitude, s.longitude]} icon={ICONE_SAIDA}>
                <Popup>
                  <div className="text-xs">
                    <p className="font-semibold">Saída de atendimento</p>
                    <p>{formatarDataHoraBR(s.horario_registrado)}</p>
                    {s.endereco_completo && <p>{s.endereco_completo}</p>}
                    <p className="mt-1 text-ink/50">
                      {s.status_aprovacao === "aprovado"
                        ? "Aprovada"
                        : s.status_aprovacao === "rejeitado"
                          ? "Rejeitada"
                          : "Pendente"}
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}
        </MapContainer>
      </div>
    </div>
  );
}
