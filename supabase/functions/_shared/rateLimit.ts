// supabase/functions/_shared/rateLimit.ts
//
// Limita tentativas por IP nos endpoints públicos (checkin-publico,
// marcacao-publica, validar-colaborador), que não exigem login e
// identificam a pessoa só por filial + 4 dígitos da matrícula (10.000
// combinações) — sem isso, seria viável forçar/varrer matrículas.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2.45.4";

export function extrairIp(req: Request): string {
  const encaminhado = req.headers.get("x-forwarded-for");
  if (encaminhado) return encaminhado.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? "desconhecido";
}

/** Retorna true se a chamada pode seguir, false se o limite da janela foi excedido. */
export async function dentroDoLimite(
  supabase: SupabaseClient,
  endpoint: string,
  ip: string,
  maxTentativas: number,
  janelaSegundos: number
): Promise<boolean> {
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_chave: `${endpoint}:${ip}`,
    p_max_tentativas: maxTentativas,
    p_janela_segundos: janelaSegundos,
  });
  if (error) {
    // Falha ao checar não deve travar o serviço público — loga e deixa passar.
    console.error("falha ao checar rate limit:", error.message);
    return true;
  }
  return data === true;
}
