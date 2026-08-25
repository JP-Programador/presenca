import { useEffect, useMemo, useState } from "react";
import { BrandHeader } from "@/components/layout/BrandHeader";
import { NavPaineis } from "@/components/layout/NavPaineis";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { NovoColaboradorForm } from "@/components/presenca/NovoColaboradorForm";
import { ImportarColaboradoresForm } from "@/components/presenca/ImportarColaboradoresForm";
import { TrocarLiderColaborador } from "@/components/presenca/TrocarLiderColaborador";
import { EditarCepColaborador } from "@/components/presenca/EditarCepColaborador";
import { ExcluirColaboradorButton } from "@/components/presenca/ExcluirColaboradorButton";
import { useAuth } from "@/providers/AuthProvider";
import { listarFiliais, listarLideres } from "@/services/coordenacaoService";
import type { PessoaSimples } from "@/services/coordenacaoService";
import { listarColaboradores } from "@/services/colaboradoresService";
import { ALTURA_LISTA_CARDS } from "@/lib/uiConstantes";
import type { Colaborador, Filial } from "@/types/domain";

export function ColaboradoresGestao() {
  // Papel (gestor/coordenador/admin) já validado por <RequireRole> na definição das rotas.
  const { usuario, sair } = useAuth();
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [lideres, setLideres] = useState<PessoaSimples[]>([]);
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [buscaNome, setBuscaNome] = useState("");
  const [buscaCargo, setBuscaCargo] = useState("");
  const [buscaLiderId, setBuscaLiderId] = useState("");
  const [copiado, setCopiado] = useState(false);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const ehLider = usuario?.perfil === "gestor";
      const [cols, lids, fils] = await Promise.all([
        listarColaboradores(),
        ehLider ? Promise.resolve([]) : listarLideres(),
        listarFiliais(),
      ]);
      setColaboradores(cols);
      setLideres(lids);
      setFiliais(fils);
    } catch {
      setErro("Não foi possível carregar os colaboradores.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (usuario) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario]);

  const cargos = useMemo(
    () =>
      Array.from(new Set(colaboradores.map((c) => c.cargo).filter((cargo): cargo is string => Boolean(cargo)))).sort(),
    [colaboradores]
  );

  const filtrados = useMemo(() => {
    const termo = buscaNome.trim().toLowerCase();
    return colaboradores.filter((c) => {
      if (termo && !(c.nome.toLowerCase().includes(termo) || c.matricula.toLowerCase().includes(termo))) return false;
      if (buscaCargo && c.cargo !== buscaCargo) return false;
      if (buscaLiderId && c.lider_id !== buscaLiderId) return false;
      return true;
    });
  }, [colaboradores, buscaNome, buscaCargo, buscaLiderId]);

  async function copiarMatriculas() {
    const texto = filtrados.map((c) => `${c.nome} - ${c.matricula}`).join("\n");
    await navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  if (!usuario) return null; // narrowing de tipo; na prática nunca alcançado (ver RequireRole)

  const ehLider = usuario.perfil === "gestor";
  const liderFixo: PessoaSimples | undefined = ehLider ? { id: usuario.id, nome: usuario.nome } : undefined;
  const podeExcluirPermanentemente = usuario.perfil === "admin" || usuario.perfil === "gerente";

  return (
    <div className="min-h-screen bg-surface dark:bg-[#1A1A1A]">
      <BrandHeader
        title="Colaboradores"
        subtitle={ehLider ? "Sua equipe direta" : "Todos os colaboradores"}
        right={<NavPaineis perfil={usuario.perfil} atual="colaboradores" onSair={sair} />}
      />

      <main className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
        {erro && (
          <div className="mb-4">
            <Alert variant="danger">{erro}</Alert>
          </div>
        )}

        <Card className="mb-6">
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink dark:text-white">Novo colaborador</h2>
            <Button variant="ghost" size="md" onClick={() => setMostrarFormulario((v) => !v)}>
              {mostrarFormulario ? "Fechar" : "Cadastrar"}
            </Button>
          </CardHeader>
          {mostrarFormulario && (
            <CardBody>
              <NovoColaboradorForm liderFixo={liderFixo} lideres={lideres} filiais={filiais} onCriado={carregar} />
            </CardBody>
          )}
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-sm font-semibold text-ink dark:text-white">Importar em lote</h2>
            <p className="text-xs text-ink/50 dark:text-white/50">Cadastre vários colaboradores de uma vez via planilha.</p>
          </CardHeader>
          <CardBody>
            <ImportarColaboradoresForm liderFixo={liderFixo} lideres={lideres} filiais={filiais} onImportado={carregar} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink dark:text-white">
              {ehLider ? "Sua equipe" : "Todos os colaboradores"} ({filtrados.length}
              {filtrados.length !== colaboradores.length ? ` de ${colaboradores.length}` : ""})
            </h2>
            <Button variant="secondary" size="md" onClick={copiarMatriculas} disabled={filtrados.length === 0}>
              {copiado ? "Copiado!" : "Copiar nome + matrícula"}
            </Button>
          </CardHeader>
          <CardBody>
            <div className="mb-4 flex flex-wrap gap-2">
              <input
                value={buscaNome}
                onChange={(e) => setBuscaNome(e.target.value)}
                placeholder="Buscar por nome ou matrícula..."
                className="h-10 flex-1 min-w-[180px] rounded-md border border-ink/15 bg-white px-3 text-sm text-ink dark:border-white/15 dark:bg-[#242424] dark:text-white"
              />
              <select
                value={buscaCargo}
                onChange={(e) => setBuscaCargo(e.target.value)}
                className="h-10 rounded-md border border-ink/15 bg-white px-3 text-sm text-ink dark:border-white/15 dark:bg-[#242424] dark:text-white"
              >
                <option value="">Todas as funções</option>
                {cargos.map((cargo) => (
                  <option key={cargo} value={cargo}>
                    {cargo}
                  </option>
                ))}
              </select>
              {!ehLider && (
                <select
                  value={buscaLiderId}
                  onChange={(e) => setBuscaLiderId(e.target.value)}
                  className="h-10 rounded-md border border-ink/15 bg-white px-3 text-sm text-ink dark:border-white/15 dark:bg-[#242424] dark:text-white"
                >
                  <option value="">Todos os líderes</option>
                  {lideres.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nome}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {carregando ? (
              <div className="flex justify-center py-10">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : colaboradores.length === 0 ? (
              <EmptyState mensagem="Nenhum colaborador cadastrado ainda." />
            ) : filtrados.length === 0 ? (
              <EmptyState mensagem="Nenhum colaborador encontrado para esse filtro." />
            ) : (
              <ul className={`divide-y divide-ink/5 dark:divide-white/5 ${ALTURA_LISTA_CARDS}`}>
                {filtrados.map((c) => (
                  <li key={c.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-ink dark:text-white">
                        {c.nome}
                        {!c.ativo && (
                          <span className="ml-2 rounded-full bg-[#FBE7E7] px-2 py-0.5 text-xs font-semibold text-danger">
                            Inativo
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-ink/50 dark:text-white/50">
                        Matrícula {c.matricula} · {c.cargo} · {c.filial_nome}
                        {!ehLider && c.lider_nome ? ` · Líder: ${c.lider_nome}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {!ehLider && (
                        <TrocarLiderColaborador
                          colaboradorId={c.id}
                          liderAtualId={c.lider_id}
                          lideres={lideres}
                          onAtualizado={carregar}
                        />
                      )}
                      <EditarCepColaborador
                        colaboradorId={c.id}
                        cepAtual={c.cep}
                        latitudeAtual={c.latitude}
                        longitudeAtual={c.longitude}
                        precisaoAtual={c.localizacao_precisao}
                        onAtualizado={carregar}
                      />
                      <ExcluirColaboradorButton
                        colaboradorId={c.id}
                        nome={c.nome}
                        ativo={c.ativo}
                        podeExcluirPermanentemente={podeExcluirPermanentemente}
                        onAtualizado={carregar}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </main>
    </div>
  );
}
