// supabase/functions/_shared/geo.ts
//
// Matemática de distância entre coordenadas — usada pelo checkin-publico
// pra comparar o GPS do check-in contra a residência cadastrada do
// colaborador. Nenhuma chamada externa aqui: a geocodificação do CEP
// acontece uma vez, no frontend, no momento do cadastro/edição.

const RAIO_TERRA_KM = 6371;

/** Distância em km entre dois pontos (fórmula de Haversine). */
export function distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return RAIO_TERRA_KM * c;
}
