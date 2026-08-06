import { supabase } from "@/services/supabaseClient";

/** URL assinada temporária para visualizar a foto de um registro (bucket privado). */
export async function obterUrlFoto(fotoPath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("tlp-fotos-presenca")
    .createSignedUrl(fotoPath, 60 * 5); // 5 minutos
  if (error) return null;
  return data.signedUrl;
}
