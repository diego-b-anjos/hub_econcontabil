import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { SelectedClientsProvider } from "@/contexts/SelectedClientsContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";

const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Clients = lazy(() => import("./pages/Clients"));
const Contadores = lazy(() => import("./pages/Contadores"));
const Usuarios = lazy(() => import("./pages/Usuarios"));
const Simulations = lazy(() => import("./pages/Simulations"));
const SimulationEditor = lazy(() => import("./pages/SimulationEditor"));
const TaxAnalyzerDashboard = lazy(() =>
  import("./components/ReformaTributaria/TaxAnalyzerDashboard").then((m) => ({ default: m.default }))
);
const ApuracaoTrimestral = lazy(() => import("./pages/ApuracaoTrimestral"));
const SpedInventario = lazy(() => import("./pages/SpedInventario"));
const SpedReader = lazy(() => import("./pages/SpedReader"));
const ReformaTributaria = lazy(() => import("./pages/ReformaTributaria"));
const Integracoes = lazy(() => import("./pages/Integracoes"));
const AcessoriasGestao = lazy(() => import("./pages/AcessoriasGestao"));
const SciFaturamento = lazy(() => import("./pages/SciFaturamento"));
const SciProtocolos = lazy(() => import("./pages/SciProtocolos"));
const ApresentacaoConsolidada = lazy(() => import("./pages/ApresentacaoConsolidada"));
const ModulePlaceholder = lazy(() => import("./pages/ModulePlaceholder"));
const Perfil = lazy(() => import("./pages/Perfil"));
const BeneficioFiscal = lazy(() => import("./pages/BeneficioFiscal"));
const EndividamentoTributario = lazy(() => import("./pages/EndividamentoTributario"));
const Calendario = lazy(() => import("./pages/Calendario"));
const ClienteDashboard = lazy(() => import("./pages/ClienteDashboard"));
const LinksUteis = lazy(() => import("./pages/LinksUteis"));
const PainelAlertas = lazy(() => import("./pages/PainelAlertas"));
const DRESimplificada = lazy(() => import("./pages/DRESimplificada"));
const Noticias = lazy(() => import("./pages/Noticias"));
const MapeamentoTributario = lazy(() => import("./pages/MapeamentoTributario"));
const Tarefas = lazy(() => import("./pages/Tarefas"));
const NotFound = lazy(() => import("./pages/NotFound"));

const ROUTE_PREFETCH: Record<string, () => Promise<unknown>> = {
  "/app": () => import("./pages/Dashboard"),
  "/app/clientes": () => import("./pages/Clients"),
  "/app/cadastros/contadores": () => import("./pages/Contadores"),
  "/app/cadastros/usuarios": () => import("./pages/Usuarios"),
  "/app/simulacoes": () => import("./pages/Simulations"),
  "/app/apuracao-trimestral": () => import("./pages/ApuracaoTrimestral"),
  "/app/sped-inventario": () => import("./pages/SpedInventario"),
  "/app/sped-leitor": () => import("./pages/SpedReader"),
  "/app/reforma-tributaria": () => import("./pages/ReformaTributaria"),
  "/app/integracoes": () => import("./pages/Integracoes"),
  "/app/integracoes/acessorias/gestao-entregas": () => import("./pages/AcessoriasGestao"),
  "/app/integracoes/sci/faturamento": () => import("./pages/SciFaturamento"),
  "/app/integracoes/sci/protocolos": () => import("./pages/SciProtocolos"),
  "/app/integracoes/apresentacao": () => import("./pages/ApresentacaoConsolidada"),
  "/app/perfil": () => import("./pages/Perfil"),
  "/app/beneficio-fiscal": () => import("./pages/BeneficioFiscal"),
  "/app/envidamento": () => import("./pages/EndividamentoTributario"),
  "/app/calendario": () => import("./pages/Calendario"),
  "/app/links-uteis": () => import("./pages/LinksUteis"),
  "/app/painel-alertas": () => import("./pages/PainelAlertas"),
  "/app/dre-simplificada": () => import("./pages/DRESimplificada"),
  "/app/noticias": () => import("./pages/Noticias"),
  "/app/mapeamento-tributario": () => import("./pages/MapeamentoTributario"),
};

export function prefetchRoute(path: string) {
  const fn = ROUTE_PREFETCH[path];
  if (fn) {
    fn().catch(() => undefined);
  }
}

// Wrappers thin para passar useParams como props ao TaxAnalyzerDashboard
function SimulacoesRoute() {
  return <TaxAnalyzerDashboard />;
}
function SimulacoesNovaRoute() {
  return <TaxAnalyzerDashboard newSimulacao={true} />;
}
function SimulacoesIdRoute() {
  const { id } = useParams<{ id: string }>();
  return <TaxAnalyzerDashboard initialSimId={id} />;
}

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <SelectedClientsProvider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route
                  path="/app"
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Dashboard />} />
                  <Route path="clientes" element={<Clients />} />
                  <Route path="cadastros/contadores" element={<Contadores />} />
                  <Route path="cadastros/usuarios" element={<Usuarios />} />
                  <Route path="simulacoes" element={<SimulacoesRoute />} />
                  <Route path="simulacoes/nova" element={<SimulacoesNovaRoute />} />
                  <Route path="simulacoes/:id" element={<SimulacoesIdRoute />} />
                  <Route path="apuracao-trimestral" element={<ApuracaoTrimestral />} />
                  <Route path="sped-inventario" element={<SpedInventario />} />
                  <Route path="sped-leitor" element={<SpedReader />} />
                  <Route path="reforma-tributaria" element={<ReformaTributaria />} />
                  <Route path="integracoes" element={<Integracoes />} />
                  <Route path="integracoes/acessorias/gestao-entregas" element={<AcessoriasGestao />} />
                  <Route path="integracoes/sci/faturamento" element={<SciFaturamento />} />
                  <Route path="integracoes/sci/protocolos" element={<SciProtocolos />} />
                  <Route path="integracoes/apresentacao" element={<ApresentacaoConsolidada />} />
                  <Route path="perfil" element={<Perfil />} />
                  <Route path="beneficio-fiscal" element={<BeneficioFiscal />} />
                  <Route path="envidamento" element={<EndividamentoTributario />} />
                  <Route path="calendario" element={<Calendario />} />
                  <Route path="links-uteis" element={<LinksUteis />} />
                  <Route path="painel-alertas" element={<PainelAlertas />} />
                  <Route path="dre-simplificada" element={<DRESimplificada />} />
                  <Route path="noticias" element={<Noticias />} />
                  <Route path="mapeamento-tributario" element={<Navigate to="/app/reforma-tributaria" replace />} />
                  <Route path="clientes/:id/dashboard" element={<ClienteDashboard />} />
                  <Route path="tarefas" element={<Tarefas />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </SelectedClientsProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
