// Preenche endereco_completo nulo em marcacoes_atendimento e registros_presenca
// via geocodificação reversa (Nominatim, 1 req/s; LocationIQ como fallback).
//
// Uso (PowerShell):
//   $env:SUPABASE_URL="https://rawdonblnehniohvvmme.supabase.co"
//   $env:SUPABASE_SERVICE_ROLE_KEY="..."        # nunca commitar
//   $env:LOCATIONIQ_TOKEN="..."                 # opcional
//   node scripts/backfill-enderecos.mjs --dry   # só conta e mostra amostra
//   node scripts/backfill-enderecos.mjs         # grava
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LOCATIONIQ_TOKEN } = process.env;
const dry = process.argv.includes("--dry");
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: "tlp_presenca" },
  auth: { persistSession: false },
});

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function json(url, headers) {
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

async function reverso(lat, lon) {
  const n = await json(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
    { "User-Agent": "tlp-presenca-backfill/1.0 (uso interno)" }
  );
  if (n?.display_name) return n.display_name;
  if (LOCATIONIQ_TOKEN) {
    const l = await json(
      `https://us1.locationiq.com/v1/reverse?key=${LOCATIONIQ_TOKEN}&lat=${lat}&lon=${lon}&format=json`
    );
    return l?.display_name ?? null;
  }
  return null;
}

for (const tabela of ["marcacoes_atendimento", "registros_presenca"]) {
  const { data, error } = await supabase
    .from(tabela)
    .select("id, latitude, longitude")
    .is("endereco_completo", null)
    .not("latitude", "is", null)
    .not("longitude", "is", null);
  if (error) {
    console.error(tabela, error.message);
    continue;
  }
  console.log(`${tabela}: ${data.length} sem endereço`);
  if (dry) continue;

  let ok = 0;
  for (const row of data) {
    const endereco = await reverso(row.latitude, row.longitude);
    if (endereco) {
      const { error: e } = await supabase.from(tabela).update({ endereco_completo: endereco }).eq("id", row.id);
      if (!e) ok++;
    }
    await espera(1100); // política do Nominatim
  }
  console.log(`${tabela}: ${ok}/${data.length} preenchidos`);
}
