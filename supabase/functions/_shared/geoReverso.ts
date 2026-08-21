// supabase/functions/_shared/geoReverso.ts
//
// Geocodificação reversa (coordenada -> endereço completo) via Nominatim
// (OpenStreetMap), resolvida no momento da marcação de atendimento — volume
// ínfimo (no máx. 2 marcações/colaborador/dia), então nenhum cuidado extra
// de rate-limit é necessário. Nominatim exige um User-Agent identificando
// a aplicação em chamadas servidor-a-servidor (diferente do browser, que já
// manda Referer sozinho) — sem isso, a política de uso deles pode bloquear.
//
// Nunca lança erro: se falhar, quem chama recebe null e segue sem endereço,
// sem travar o registro da marcação por causa disso.

const USER_AGENT = "tlp-presenca-atendimento/1.0 (uso interno)";

export async function geocodificarReverso(latitude: number, longitude: number): Promise<string | null> {
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
      { headers: { "User-Agent": USER_AGENT } }
    );
    if (!resp.ok) return null;
    const dados = await resp.json();
    return dados?.display_name ?? null;
  } catch {
    return null;
  }
}
