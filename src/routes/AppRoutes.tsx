import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { TecnicoCheckin } from "@/pages/TecnicoCheckin";
import { TecnicoMarcacoes } from "@/pages/TecnicoMarcacoes";
import { AdminLogin } from "@/pages/AdminLogin";
import { LiderDashboard } from "@/pages/LiderDashboard";
import { RequireAuth } from "@/routes/guards/RequireAuth";
import { RequireRole } from "@/routes/guards/RequireRole";
import { LoadingScreen } from "@/components/ui/LoadingScreen";

// Telas de coordenação carregam Leaflet e SheetJS (xlsx), que são pesadas
// (~350KB juntas) e só interessam a quem tem visão de coordenação/auditoria —
// lazy-load evita que todo mundo (incluindo o técnico na tela pública) baixe
// esse código.
const CoordenadorDashboard = lazy(() =>
  import("@/pages/CoordenadorDashboard").then((m) => ({ default: m.CoordenadorDashboard }))
);
const AuditoriaDashboard = lazy(() =>
  import("@/pages/AuditoriaDashboard").then((m) => ({ default: m.AuditoriaDashboard }))
);
const UsuariosGestao = lazy(() =>
  import("@/pages/UsuariosGestao").then((m) => ({ default: m.UsuariosGestao }))
);
const ColaboradoresGestao = lazy(() =>
  import("@/pages/ColaboradoresGestao").then((m) => ({ default: m.ColaboradoresGestao }))
);
const DashboardPresenca = lazy(() =>
  import("@/pages/DashboardPresenca").then((m) => ({ default: m.DashboardPresenca }))
);

// Hierarquia: admin > coordenador > gestor > colaborador, com auditor no
// mesmo nível de LEITURA do admin (mas sem nenhuma escrita).
// - Coordenação (mapa/ranking/SLA): admin, auditor e coordenador.
// - Auditoria (trilha sensível): exclusiva de admin e auditor — coordenador NÃO acessa.
// - Gestão de usuários (líderes+): admin cria qualquer papel; coordenador só cria líderes.
// - Gestão de colaboradores: líder (só os seus), coordenador e admin.
const PAPEIS_VISAO_GLOBAL = ["admin", "auditor", "coordenador"] as const;
const PAPEIS_AUDITORIA = ["admin", "auditor"] as const;
const PAPEIS_GESTAO_USUARIOS = ["admin", "coordenador"] as const;
const PAPEIS_GESTAO_COLABORADORES = ["admin", "coordenador", "gestor"] as const;
// Dashboard de presença (gráficos/comparativo): todo mundo acima de colaborador —
// escopado pela própria hierarquia via RLS (líder só vê a equipe dele).
const PAPEIS_DASHBOARD_PRESENCA = ["admin", "auditor", "coordenador", "gestor"] as const;

export function AppRoutes() {
  return (
    <Routes>
      {/* Tela pública, sem login — ponto de entrada padrão para o técnico */}
      <Route path="/" element={<TecnicoCheckin />} />
      <Route path="/ponto" element={<TecnicoCheckin />} />
      {/* Fluxo alternativo de 4 marcações diárias (Módulo 13) — opcional, não substitui "/" nem "/ponto" */}
      <Route path="/ponto4" element={<TecnicoMarcacoes />} />

      {/* Painel administrativo */}
      <Route path="/admin" element={<AdminLogin />} />

      <Route
        path="/lider"
        element={
          <RequireAuth>
            <LiderDashboard />
          </RequireAuth>
        }
      />

      {/* Coordenação e auditoria — visão global (admin, auditor, coordenador) */}
      <Route
        path="/coordenador"
        element={
          <RequireRole roles={[...PAPEIS_VISAO_GLOBAL]}>
            <Suspense fallback={<LoadingScreen />}>
              <CoordenadorDashboard />
            </Suspense>
          </RequireRole>
        }
      />
      <Route
        path="/auditoria"
        element={
          <RequireRole roles={[...PAPEIS_AUDITORIA]} fallback="/coordenador">
            <Suspense fallback={<LoadingScreen />}>
              <AuditoriaDashboard />
            </Suspense>
          </RequireRole>
        }
      />

      {/* Gestão de usuários e hierarquia — admin (qualquer papel) e coordenador (só líderes) */}
      <Route
        path="/usuarios"
        element={
          <RequireRole roles={[...PAPEIS_GESTAO_USUARIOS]} fallback="/coordenador">
            <Suspense fallback={<LoadingScreen />}>
              <UsuariosGestao />
            </Suspense>
          </RequireRole>
        }
      />

      {/* Gestão de colaboradores — líder (só os seus), coordenador e admin */}
      <Route
        path="/colaboradores"
        element={
          <RequireRole roles={[...PAPEIS_GESTAO_COLABORADORES]} fallback="/lider">
            <Suspense fallback={<LoadingScreen />}>
              <ColaboradoresGestao />
            </Suspense>
          </RequireRole>
        }
      />

      {/* Dashboard de presença — gráficos e comparativo, sem acesso de colaborador comum */}
      <Route
        path="/dashboard-presenca"
        element={
          <RequireRole roles={[...PAPEIS_DASHBOARD_PRESENCA]} fallback="/lider">
            <Suspense fallback={<LoadingScreen />}>
              <DashboardPresenca />
            </Suspense>
          </RequireRole>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
