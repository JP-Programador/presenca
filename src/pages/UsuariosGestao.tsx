import { useEffect, useState } from "react";
import { BrandHeader } from "@/components/layout/BrandHeader";
import { NavPaineis } from "@/components/layout/NavPaineis";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { NovoUsuarioForm } from "@/components/presenca/NovoUsuarioForm";
import { UsuarioRow } from "@/components/presenca/UsuarioRow";
import { useAuth } from "@/providers/AuthProvider";
import { listarCoordenadores, listarFiliais, listarUsuarios } from "@/services/coordenacaoService";
import type { PessoaSimples } from "@/services/coordenacaoService";
import type { Filial, UsuarioComHierarquia } from "@/types/domain";

const PAPEL_LABEL: Record<string, string> = {
  admin: "Administrador",
  auditor: "Auditor",
  coordenador: "Coordenador",
  gestor: "Gestor",
  colaborador: "Colaborador",
};

export function UsuariosGestao() {
  // Papel (admin) já validado por <RequireRole> na definição das rotas.
  const { usuario, sair } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioComHierarquia[]>([]);
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [coordenadores, setCoordenadores] = useState<PessoaSimples[]>([]);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setCarregandoLista(true);
    setErro(null);
    try {
      const [users, fils, coords] = await Promise.all([listarUsuarios(), listarFiliais(), listarCoordenadores()]);
      setUsuarios(users);
      setFiliais(fils);
      setCoordenadores(coords);
    } catch {
      setErro("Não foi possível carregar os usuários.");
    } finally {
      setCarregandoLista(false);
    }
  }

  useEffect(() => {
    if (usuario) carregar();
  }, [usuario]);

  if (!usuario) return null; // narrowing de tipo; na prática nunca alcançado (ver RequireRole)

  // Agrupado por papel para dar a leitura de hierarquia (admin > coordenador > gestor > colaborador)
  const grupos: { papel: string; itens: UsuarioComHierarquia[] }[] = ["admin", "auditor", "coordenador", "gestor", "colaborador"]
    .map((papel) => ({ papel, itens: usuarios.filter((u) => u.perfil === papel) }))
    .filter((g) => g.itens.length > 0);

  const dadosExportacao = usuarios.map((u) => ({
    nome: u.nome,
    email: u.email,
    papel: PAPEL_LABEL[u.perfil] ?? u.perfil,
    filial_origem: u.filial_home_nome ?? "",
    filiais_gerenciadas: u.filiais_gerenciadas.map((f) => f.nome).join(", "),
    status: u.ativo ? "Ativo" : "Inativo",
  }));

  return (
    <div className="min-h-screen bg-surface dark:bg-[#1A1A1A]">
      <BrandHeader
        title="Usuários e hierarquia"
        subtitle="Administradores, auditores, coordenadores, gestores e colaboradores"
        right={<NavPaineis perfil={usuario.perfil} atual="usuarios" onSair={sair} />}
      />

      <main className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
        {erro && (
          <div className="mb-4">
            <Alert variant="danger">{erro}</Alert>
          </div>
        )}

        <Card className="mb-6">
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink dark:text-white">Novo usuário</h2>
            <Button variant="ghost" size="md" onClick={() => setMostrarFormulario((v) => !v)}>
              {mostrarFormulario ? "Fechar" : "Novo usuário"}
            </Button>
          </CardHeader>
          {mostrarFormulario && (
            <CardBody>
              <NovoUsuarioForm
                filiais={filiais}
                coordenadores={coordenadores}
                perfilCriador={usuario.perfil}
                onCriado={carregar}
              />
            </CardBody>
          )}
        </Card>

        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink dark:text-white">Hierarquia de acesso</h2>
            <ExportButtons
              dados={dadosExportacao}
              nomeBase="usuarios"
              colunas={[
                { chave: "nome", titulo: "Nome" },
                { chave: "email", titulo: "E-mail" },
                { chave: "papel", titulo: "Papel" },
                { chave: "filial_origem", titulo: "Filial de origem" },
                { chave: "filiais_gerenciadas", titulo: "Filiais gerenciadas" },
                { chave: "status", titulo: "Status" },
              ]}
            />
          </CardHeader>
          <CardBody>
            {carregandoLista ? (
              <div className="flex justify-center py-10">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {grupos.map((grupo) => (
                  <div key={grupo.papel}>
                    <p className="mb-1 text-xs font-bold uppercase tracking-wide text-primary">
                      {PAPEL_LABEL[grupo.papel]} ({grupo.itens.length})
                    </p>
                    <ul className="divide-y divide-ink/5">
                      {grupo.itens.map((u) => (
                        <UsuarioRow key={u.id} usuario={u} filiais={filiais} onAtualizado={carregar} />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </main>
    </div>
  );
}
