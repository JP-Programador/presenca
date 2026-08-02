import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  assinarMudancasDeSessao,
  buscarPerfil,
  entrarComSenha,
  obterSessaoAtual,
  sairDaSessao,
} from "@/services/authService";
import type { PerfilUsuario } from "@/types/domain";

interface AuthContextValue {
  usuario: PerfilUsuario | null;
  carregando: boolean;
  entrar: (email: string, senha: string) => Promise<{ error: string | null }>;
  sair: () => Promise<void>;
  /** Recarrega o perfil do usuário atual (ex.: depois de trocar a senha temporária). */
  recarregarUsuario: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Fonte única da sessão administrativa (login/gestor/coordenador/admin).
 * Envolve toda a aplicação em main.tsx — sem isso, cada tela que chamasse
 * useAuth() dispararia sua própria consulta a `perfis`, duplicando requests
 * toda vez que o usuário navega entre /lider, /coordenador, /auditoria etc.
 * Não é usado pela tela pública do técnico, que não exige login.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<PerfilUsuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  async function carregarUsuario(userId: string | null) {
    if (!userId) {
      setUsuario(null);
      setCarregando(false);
      return;
    }
    const perfil = await buscarPerfil(userId);
    setUsuario(perfil);
    setCarregando(false);
  }

  useEffect(() => {
    obterSessaoAtual().then((sessao) => carregarUsuario(sessao?.user.id ?? null));
    const cancelarAssinatura = assinarMudancasDeSessao(carregarUsuario);
    return cancelarAssinatura;
  }, []);

  async function entrar(email: string, senha: string) {
    return entrarComSenha(email, senha);
  }

  async function sair() {
    await sairDaSessao();
  }

  async function recarregarUsuario() {
    if (usuario) await carregarUsuario(usuario.id);
  }

  return (
    <AuthContext.Provider value={{ usuario, carregando, entrar, sair, recarregarUsuario }}>
      {children}
    </AuthContext.Provider>
  );
}

/** Hook de consumo — lança erro claro se usado fora do AuthProvider. */
export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error("useAuth precisa ser usado dentro de <AuthProvider>. Verifique src/main.tsx.");
  }
  return contexto;
}
