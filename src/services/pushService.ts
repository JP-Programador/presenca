import { supabase } from "@/services/supabaseClient";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function base64UrlParaUint8Array(base64Url: string): Uint8Array {
  const base64 = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function suportaNotificacoes(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && !!VAPID_PUBLIC_KEY;
}

/** true se o usuário já tem uma inscrição ativa neste navegador. */
export async function notificacoesAtivas(): Promise<boolean> {
  if (!suportaNotificacoes()) return false;
  const registro = await navigator.serviceWorker.getRegistration();
  const inscricao = await registro?.pushManager.getSubscription();
  return !!inscricao;
}

/** Pede permissão, inscreve no push do navegador e salva a inscrição no banco. */
export async function habilitarNotificacoes(): Promise<void> {
  if (!suportaNotificacoes()) throw new Error("Este navegador não suporta notificações.");

  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") throw new Error("Permissão de notificação não concedida.");

  const registro = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  let inscricao = await registro.pushManager.getSubscription();
  if (!inscricao) {
    inscricao = await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlParaUint8Array(VAPID_PUBLIC_KEY!) as BufferSource,
    });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão inválida.");

  const json = inscricao.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      perfil_id: user.id,
      endpoint: inscricao.endpoint,
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
    },
    { onConflict: "endpoint" }
  );
  if (error) throw error;
}
