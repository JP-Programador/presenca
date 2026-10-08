// supabase/functions/_shared/geoReverso.ts
//
// Geocodificação reversa (coordenada -> endereço completo), resolvida no
// momento da marcação de atendimento.
//
// O Nominatim público falha de forma intermitente quando chamado a partir
// da Edge Function (IPs compartilhados do Supabase caem em rate limit/403),
// e antes uma falha única gravava endereco_completo = null pra sempre. Por
// isso: timeout, 2 tentativas no Nominatim e, se ainda falhar, LocationIQ
// (secret LOCATIONIQ_TOKEN, opcional) como segunda fonte.
//
// Nunca lança erro: se tudo falhar, quem chama recebe null e segue sem
// endereço, sem travar o registro da marcação por causa disso.

const USER_AGENT = "tlp-presenca-atendimento/1.0 (uso interno)";
const TIMEOUT_MS = 4000;

async function buscarJson(url: string, headers?: Record<string, string>): Promise<any | null> {
  try {
    const resp = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

async function nominatim(lat: number, lon: number): Promise<string | null> {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const dados = await buscarJson(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
      { "User-Agent": USER_AGENT }
    );
    if (dados?.display_name) return dados.display_name;
    await new Promise((r) => setTimeout(r, 600));
  }
  return null;
}

async function locationIq(lat: number, lon: number): Promise<string | null> {
  const token = Deno.env.get("LOCATIONIQ_TOKEN");
  if (!token) return null;
  const dados = await buscarJson(
    `https://us1.locationiq.com/v1/reverse?key=${token}&lat=${lat}&lon=${lon}&format=json`
  );
  return dados?.display_name ?? null;
}

export async function geocodificarReverso(latitude: number, longitude: number): Promise<string | null> {
  return (await nominatim(latitude, longitude)) ?? (await locationIq(latitude, longitude));
}
