import { Fragment, useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Circle, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { listarLideresPorFilial, type LiderFilial } from "@/services/mapaOperacionalService";
import { STATUS_DIA_HEX, STATUS_DIA_LABEL, type PontoMapaOperacional, type StatusDia } from "@/types/status";

const CENTRO_BRASIL: [number, number] = [-14.235, -51.9253];

const LEGENDA: { status: StatusDia; label: string }[] = [
  { status: "PRESENTE", label: "Presente" },
  { status: "PENDENTE", label: "Pendente" },
  { status: "FALTA", label: "Falta" },
  { status: "ATESTADO", label: "Atestado" },
  { status: "FOLGA", label: "Folga" },
];

interface PresenceMapProps {
  pontos: PontoMapaOperacional[];
  /** Esconde os filtros (usado no MiniMapCard, que já recebe os dados pré-filtrados). */
  somenteExibicao?: boolean;
  /** Altura do mapa em px (padrão 420 — o MiniMapCard usa um valor menor). */
  altura?: number;
}

/** Mapa operacional completo (Módulo 9): presentes/pendentes/faltas/atestados/folgas, com filtro por filial e líder. */
export function PresenceMap({ pontos, somenteExibicao, altura = 420 }: PresenceMapProps) {
  const [lideresPorFilial, setLideresPorFilial] = useState<LiderFilial[]>([]);
  const [filialFiltro, setFilialFiltro] = useState("");
  const [liderFiltro, setLiderFiltro] = useState("");
  const [nomeFiltro, setNomeFiltro] = useState("");

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

  const filtrados = useMemo(() => {
    const termo = nomeFiltro.trim().toLowerCase();
    return pontos.filter((p) => {
      if (filialFiltro && p.filial_id !== filialFiltro) return false;
      if (filialIdsDoLider && !filialIdsDoLider.has(p.filial_id)) return false;
      if (termo && !p.colaborador_nome?.toLowerCase().includes(termo)) return false;
      return true;
    });
  }, [pontos, filialFiltro, filialIdsDoLider, nomeFiltro]);

  const comCoordenadas = filtrados.filter((p) => p.latitude != null && p.longitude != null);

  const centro: [number, number] =
    comCoordenadas.length > 0
      ? [comCoordenadas[0].latitude as number, comCoordenadas[0].longitude as number]
      : CENTRO_BRASIL;

  return (
    <div className="flex flex-col gap-3">
      {!somenteExibicao && (
        <div className="flex flex-wrap gap-2">
          <input
            value={nomeFiltro}
            onChange={(e) => setNomeFiltro(e.target.value)}
            placeholder="Buscar colaborador..."
            className="h-10 flex-1 min-w-[160px] rounded-md border border-ink/15 bg-white px-3 text-sm text-ink dark:border-white/15 dark:bg-[#242424] dark:text-white"
          />
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
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-ink/10">
        <MapContainer
          center={centro}
          zoom={comCoordenadas.length > 0 ? 11 : 4}
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
        </MapContainer>

        <div className="flex flex-wrap items-center gap-3 border-t border-ink/10 bg-white px-4 py-2 text-xs">
          {LEGENDA.map((item) => (
            <span key={item.status} className="flex items-center gap-1.5 text-ink/60">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_DIA_HEX[item.status] }} />
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
