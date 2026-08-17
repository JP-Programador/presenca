import { Fragment, useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Circle, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { listarLideresPorFilial, type LiderFilial } from "@/services/mapaOperacionalService";
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
}

/** Mapa operacional completo (Módulo 9): presentes/pendentes/faltas/atestados/folgas, com filtro por filial e líder. */
export function PresenceMap({
  pontos,
  somenteExibicao,
  altura = 420,
  filtroNomeExterno,
  casaColaborador,
}: PresenceMapProps) {
  const [lideresPorFilial, setLideresPorFilial] = useState<LiderFilial[]>([]);
  const [filialFiltro, setFilialFiltro] = useState("");
  const [liderFiltro, setLiderFiltro] = useState("");
  const [colaboradorFiltro, setColaboradorFiltro] = useState("");
  const [nomeFiltroInterno, setNomeFiltroInterno] = useState("");
  const nomeFiltroControlado = filtroNomeExterno !== undefined;
  const nomeFiltro = nomeFiltroControlado ? filtroNomeExterno : nomeFiltroInterno;

  useEffect(() => {
    if (somenteExibicao) return;
    listarLideresPorFilial()
      .then(setLideresPorFilial)
      .catch(() => setLideresPorFilial([]));
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

  const filialIdsDoLider = useMemo(() => {
    if (!liderFiltro) return null;
    return new Set(lideresPorFilial.filter((l) => l.lider_id === liderFiltro).map((l) => l.filial_id));
  }, [lideresPorFilial, liderFiltro]);

  const colaboradores = useMemo(() => {
    const mapa = new Map<string, string>();
    pontos
      .filter((p) => p.status === "PRESENTE" || p.status === "PENDENTE")
      .forEach((p) => mapa.set(p.colaborador_id, p.colaborador_nome));
    return Array.from(mapa.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [pontos]);

  const filtrados = useMemo(() => {
    const termo = (nomeFiltro ?? "").trim().toLowerCase();
    return pontos.filter((p) => {
      // O mapa mostra quem fez check-in de verdade (Presente ou aguardando
      // aprovação, ambos com GPS do próprio check-in). Se o líder marcou
      // Falta/Atestado/Folga/Outros manualmente, some do mapa — esses não têm
      // localização de check-in e o status manual do líder prevalece.
      if (p.status !== "PRESENTE" && p.status !== "PENDENTE") return false;
      if (filialFiltro && p.filial_id !== filialFiltro) return false;
      if (filialIdsDoLider && !filialIdsDoLider.has(p.filial_id)) return false;
      if (colaboradorFiltro && p.colaborador_id !== colaboradorFiltro) return false;
      if (termo && !p.colaborador_nome?.toLowerCase().includes(termo)) return false;
      return true;
    });
  }, [pontos, filialFiltro, filialIdsDoLider, colaboradorFiltro, nomeFiltro]);

  const comCoordenadas = filtrados.filter((p) => p.latitude != null && p.longitude != null);

  const centro: [number, number] =
    comCoordenadas.length > 0
      ? [comCoordenadas[0].latitude as number, comCoordenadas[0].longitude as number]
      : casaColaborador
        ? [casaColaborador.latitude, casaColaborador.longitude]
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
          zoom={comCoordenadas.length > 0 || casaColaborador ? 11 : 4}
          style={{ height: `${altura}px`, width: "100%" }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
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
                    <p>{p.filial_nome}</p>
                    <p>{STATUS_DIA_LABEL[p.status]}</p>
                    {p.horario_registrado && (
                      <p>
                        {new Date(p.horario_registrado).toLocaleString("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </p>
                    )}
                    {p.precisao_metros != null && <p>Precisão do GPS: ±{Math.round(p.precisao_metros)}m</p>}
                  </div>
                  </Popup>
              </CircleMarker>
            </Fragment>
          ))}
          {casaColaborador && (
            <Marker position={[casaColaborador.latitude, casaColaborador.longitude]} icon={ICONE_CASA}>
              <Popup>
                <div className="text-xs">
                  <p className="font-semibold">Residência cadastrada</p>
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
    </div>
  );
}
