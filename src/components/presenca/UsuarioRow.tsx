import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { Filial, PerfilAcesso, UsuarioComHierarquia } from "@/types/domain";
import {
  ativarDesativarUsuario,
  atribuirFilialGestor,
  atualizarPapelUsuario,
  removerFilialGestor,
} from "@/services/coordenacaoService";
import { solicitarRedefinicaoSenha } from "@/services/authService";
import { useToast } from "@/providers/ToastProvider";

const PAPEL_LABEL: Record<PerfilAcesso, string> = {
  admin: "Administrador",
  auditor: "Auditor",
  coordenador: "Coordenador",
  gestor: "Gestor",
  colaborador: "Colaborador",
};

export function UsuarioRow({
  usuario,
  filiais,
  onAtualizado,
}: {
  usuario: UsuarioComHierarquia;
  filiais: Filial[];
  onAtualizado: () => void;
}) {
  const [expandido, setExpandido] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const { mostrar } = useToast();

  async function redefinirSenha() {
    setSalvando(true);
    try {
      const { error } = await solicitarRedefinicaoSenha(usuario.email, usuario.id);
      mostrar(
        error ? "Não foi possível enviar o e-mail de redefinição." : "E-mail de redefinição enviado.",
        error ? "erro" : "sucesso"
      );
    } finally {
      setSalvando(false);
    }
  }

  async function mudarPapel(novoPapel: PerfilAcesso) {
    setSalvando(true);
    try {
      await atualizarPapelUsuario(usuario.id, novoPapel, usuario.filial_id);
      onAtualizado();
    } finally {
      setSalvando(false);
    }
  }

  async function mudarFilialHome(filialId: string) {
    setSalvando(true);
    try {
      await atualizarPapelUsuario(usuario.id, usuario.perfil, filialId || null);
      onAtualizado();
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo() {
    setSalvando(true);
    try {
      await ativarDesativarUsuario(usuario.id, !usuario.ativo);
      onAtualizado();
    } finally {
      setSalvando(false);
    }
  }

  async function alternarFilialGerenciada(filialId: string, jaGerencia: boolean) {
    setSalvando(true);
    try {
      if (jaGerencia) {
        await removerFilialGestor(usuario.id, filialId);
      } else {
        await atribuirFilialGestor(usuario.id, filialId);
      }
      onAtualizado();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">
            {usuario.nome}
            {!usuario.ativo && (
              <span className="ml-2 rounded-full bg-[#FBE7E7] px-2 py-0.5 text-xs font-semibold text-danger">
                Inativo
              </span>
            )}
          </p>
          <p className="text-xs text-ink/50">{usuario.email}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={usuario.perfil}
            disabled={salvando}
            onChange={(e) => mudarPapel(e.target.value as PerfilAcesso)}
            className="h-9 rounded-md border border-ink/20 bg-white px-2 text-xs font-semibold text-ink dark:border-white/20 dark:bg-[#242424] dark:text-white"
          >
            {Object.entries(PAPEL_LABEL).map(([valor, label]) => (
              <option key={valor} value={valor}>
                {label}
              </option>
            ))}
          </select>

          {usuario.perfil === "gestor" && (
            <button
              onClick={() => setExpandido((v) => !v)}
              className="text-xs font-semibold text-primary hover:underline"
            >
              {expandido ? "Ocultar filiais" : "Gerenciar filiais"}
            </button>
          )}

          <Button variant="ghost" size="md" onClick={redefinirSenha} disabled={salvando}>
            Redefinir senha
          </Button>

          <Button variant="ghost" size="md" onClick={alternarAtivo} disabled={salvando}>
            {usuario.ativo ? "Desativar" : "Ativar"}
          </Button>
        </div>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink/50">
        <span>Filial de origem:</span>
        <select
          value={usuario.filial_id ?? ""}
          disabled={salvando}
          onChange={(e) => mudarFilialHome(e.target.value)}
          className="h-7 rounded border border-ink/15 bg-white px-1.5 text-xs text-ink"
        >
          <option value="">—</option>
          {filiais.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
        </select>
      </div>

      {usuario.perfil === "gestor" && expandido && (
        <div className="mt-3 rounded-md bg-surface p-3">
          <p className="mb-2 text-xs font-semibold text-ink/60">Filiais gerenciadas por {usuario.nome.split(" ")[0]}:</p>
          <div className="flex flex-wrap gap-2">
            {filiais.map((f) => {
              const jaGerencia = usuario.filiais_gerenciadas.some((fg) => fg.id === f.id);
              return (
                <button
                  key={f.id}
                  disabled={salvando}
                  onClick={() => alternarFilialGerenciada(f.id, jaGerencia)}
                  className={[
                    "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                    jaGerencia
                      ? "border-primary bg-[#FDE9DD] text-primary-dark"
                      : "border-ink/15 bg-white text-ink/50",
                  ].join(" ")}
                >
                  {f.nome} {jaGerencia ? "✓" : "+"}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </li>
  );
}
