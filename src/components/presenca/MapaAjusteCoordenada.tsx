import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const ICONE_PINO = L.divIcon({
  html: '<div style="font-size: 26px; line-height: 1;">📍</div>',
  className: "",
  iconSize: [26, 26],
  iconAnchor: [13, 26],
});

interface MapaAjusteCoordenadaProps {
  latitude: number;
  longitude: number;
  onMudar: (latitude: number, longitude: number) => void;
}

/** Mini-mapa com pino arrastável — pra ajustar manualmente a coordenada quando a geocodificação automática não foi precisa o bastante. */
export function MapaAjusteCoordenada({ latitude, longitude, onMudar }: MapaAjusteCoordenadaProps) {
  return (
    <div className="overflow-hidden rounded-md border border-ink/15 dark:border-white/15" style={{ height: 220 }}>
      <MapContainer
        center={[latitude, longitude]}
        zoom={16}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker
          position={[latitude, longitude]}
          icon={ICONE_PINO}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const posicao = e.target.getLatLng();
              onMudar(posicao.lat, posicao.lng);
            },
          }}
        />
      </MapContainer>
    </div>
  );
}
