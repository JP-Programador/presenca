import { useCallback, useState } from "react";

export interface Coordenadas {
  latitude: number;
  longitude: number;
  precisao: number;
}

type GeoStatus = "idle" | "solicitando" | "capturado" | "erro" | "negado";

/**
 * Captura a localização atual do dispositivo. GPS é obrigatório no fluxo do
 * técnico: a tela de check-in só libera o envio quando `status === 'capturado'`.
 */
export function useGeolocation() {
  const [status, setStatus] = useState<GeoStatus>("idle");
  const [coords, setCoords] = useState<Coordenadas | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const capturar = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setStatus("erro");
      setErro("Este dispositivo não tem suporte a GPS.");
      return;
    }

    setStatus("solicitando");
    setErro(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          precisao: position.coords.accuracy,
        });
        setStatus("capturado");
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setStatus("negado");
          setErro("Permissão de localização negada. Ative o GPS para registrar a presença.");
        } else {
          setStatus("erro");
          setErro("Não foi possível obter sua localização. Tente novamente.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []);

  return { status, coords, erro, capturar, pronto: status === "capturado" };
}
