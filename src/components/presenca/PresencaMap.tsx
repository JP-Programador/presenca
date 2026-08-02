import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { RegistroPresenca } from "@/types/domain";

const CORES_STATUS: Record<string, string> = {
  presente: "#2E7D32",
  atrasado: "#F5B000",
  ausente: "#C62828",
  justificado: "#F26522",
  pendente_aprovacao: "#D9471A",
};

const CENTRO_BRASIL: [number, number] = [-14.235, -51.9253];

interface PresencaMapProps {
  registros: RegistroPresenca[];
}

/** Mapa com um marcador por registro de presença com GPS, colorido por status. */
export function PresencaMap({ registros }: PresencaMapProps) {
  const comCoordenadas = registros.filter((r) => r.latitude != null && r.longitude != null);

  const centro: [number, number] =
    comCoordenadas.length > 0
      ? [comCoordenadas[0].latitude as number, comCoordenadas[0].longitude as number]
      : CENTRO_BRASIL;

  return (
    <div className="overflow-hidden rounded-lg border border-ink/10">
      <MapContainer
        center={centro}
        zoom={comCoordenadas.length > 0 ? 11 : 4}
        style={{ height: "420px", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {comCoordenadas.map((r) => (
          <CircleMarker
            key={r.id}
            center={[r.latitude as number, r.longitude as number]}
            radius={8}
            pathOptions={{
              color: CORES_STATUS[r.status] ?? "#333333",
              fillColor: CORES_STATUS[r.status] ?? "#333333",
              fillOpacity: 0.8,
            }}
          >
            <Popup>
              <div className="text-xs">
                <p className="font-semibold">{r.colaborador_nome}</p>
                <p>{r.filial_nome}</p>
                <p>
                  {new Date(r.horario_registrado).toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      <div className="flex flex-wrap gap-3 border-t border-ink/10 bg-white px-4 py-2 text-xs">
        {Object.entries(CORES_STATUS).map(([status, cor]) => (
          <span key={status} className="flex items-center gap-1.5 text-ink/60">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cor }} />
            {status.replace(/_/g, " ")}
          </span>
        ))}
      </div>
    </div>
  );
}
