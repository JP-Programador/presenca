import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface MapaModalProps {
  latitude: number;
  longitude: number;
  titulo?: string;
  endereco?: string | null;
  onFechar: () => void;
}

/** Modal leve com um mapa e um único ponto — usado quando clica num endereço pra ver rapidamente onde foi. */
export function MapaModal({ latitude, longitude, titulo, endereco, onFechar }: MapaModalProps) {
  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-ink/70 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onFechar}
    >
      <div
        className="flex w-full max-w-lg flex-col gap-2 rounded-lg bg-white p-3 shadow-lg dark:bg-[#242424]"
        onClick={(e) => e.stopPropagation()}
      >
        {(titulo || endereco) && (
          <div className="px-1">
            {titulo && <p className="text-sm font-semibold text-ink dark:text-white">{titulo}</p>}
            {endereco && <p className="text-xs text-ink/60 dark:text-white/60">{endereco}</p>}
          </div>
        )}
        <div className="overflow-hidden rounded-lg border border-ink/10 dark:border-white/10">
          <MapContainer center={[latitude, longitude]} zoom={16} style={{ height: "320px", width: "100%" }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <CircleMarker center={[latitude, longitude]} radius={10} pathOptions={{ color: "#1E6FA8", fillColor: "#1E6FA8", fillOpacity: 0.85 }}>
              {endereco && (
                <Popup>
                  <div className="text-xs">{endereco}</div>
                </Popup>
              )}
            </CircleMarker>
          </MapContainer>
        </div>
        <button
          type="button"
          onClick={onFechar}
          className="self-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
