import { useParams, useNavigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  ArrowLeft, Calculator, FileBarChart2, TrendingUp, TrendingDown,
  Calendar, User, Building2, Hash, BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL } from "@/lib/tax-engine";

interface ClienteInfo {
  id: string;
  name: string;
  cnpj?: string;
  activity?: string;
  regime?: string;
}

interface SimulacaoResumo {
  id: string;
  name: string;
  year: number;
  bestRegime: string;
  saving: number;
  totalRevenue: number;
  updatedAt: string;
}

const REGIME_LABELS: Record<string, string> = {
  SN: "Simples Nacional",
  LP: "Lucro Presumido",
  LR: "Lucro Real",
  IVA: "IBS/CBS (IVA-Dual)",
  SNH: "SN Híbrido",
};

const ClienteDashboard = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [cliente, setCliente] = useState<ClienteInfo | null>(null);
  const [simulacoes, setSimulacoes] = useState<SimulacaoResumo[]>([]);

  useEffect(() => {
    setLoading(true);
    // Load client from localStorage (clients store)
    try {
      const raw = localStorage.getItem("econ-clients");
      if (raw) {
        const clients = JSON.parse(raw) as ClienteInfo[];
        const found = clients.find((c) => c.id === id);
        if (found) setCliente(found);
      }
    } catch {
      // ignore
    }

    // Load simulations linked to this client
    try {
      const raw = localStorage.getItem("econ-simulations");
      if (raw) {
        const sims = JSON.parse(raw) as Array<{
          id: string; name: string; clientId?: string;
          input?: { year: number };
          result?: { totals: { revenue: number; bestRegime: string; saving: number } };
          updatedAt?: string;
        }>;
        const clientSims = sims
          .filter((s) => s.clientId === id)
          .map((s) => ({
            id: s.id,
            name: s.name || "Simulação sem nome",
            year: s.input?.year ?? new Date().getFullYear(),
            bestRegime: s.result?.totals?.bestRegime ?? "SN",
            saving: s.result?.totals?.saving ?? 0,
            totalRevenue: s.result?.totals?.revenue ?? 0,
            updatedAt: s.updatedAt ?? "",
          }));
        setSimulacoes(clientSims);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-4">
        <User className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Cliente não encontrado</h2>
        <p className="text-muted-foreground text-sm text-center">
          O cliente com ID <code className="font-mono">{id}</code> não existe ou foi removido.
        </p>
        <Button asChild variant="outline">
          <Link to="/app/clientes">
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para Clientes
          </Link>
        </Button>
      </div>
    );
  }

  const melhorSim = simulacoes.length > 0
    ? simulacoes.reduce((best, s) => s.saving > best.saving ? s : best, simulacoes[0])
    : null;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="mt-1">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{cliente.name}</h1>
            {cliente.regime && (
              <Badge variant="secondary">{cliente.regime}</Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-1 text-sm text-muted-foreground">
            {cliente.cnpj && (
              <span className="flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5" /> {cliente.cnpj}
              </span>
            )}
            {cliente.activity && (
              <span className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" /> {cliente.activity}
              </span>
            )}
          </div>
        </div>
        <Button asChild>
          <Link to={`/app/simulacoes/nova?clientId=${id}`}>
            <Calculator className="h-4 w-4 mr-2" /> Nova Simulação
          </Link>
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Simulações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{simulacoes.length}</p>
            <p className="text-xs text-muted-foreground mt-1">realizadas para este cliente</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Maior Economia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">
              {melhorSim ? formatBRL(melhorSim.saving) : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {melhorSim ? `${melhorSim.name} (${melhorSim.year})` : "nenhuma simulação ainda"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileBarChart2 className="h-4 w-4" /> Melhor Regime
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {melhorSim ? REGIME_LABELS[melhorSim.bestRegime] ?? melhorSim.bestRegime : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">na última simulação com economia</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Faturamento Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {melhorSim ? formatBRL(melhorSim.totalRevenue) : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">na última simulação anual</p>
          </CardContent>
        </Card>
      </div>

      {/* Simulações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Simulações do Cliente</span>
            <Button asChild size="sm" variant="outline">
              <Link to="/app/simulacoes">Ver todas</Link>
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {simulacoes.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Calculator className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">Nenhuma simulação vinculada a este cliente ainda.</p>
              <Button asChild>
                <Link to={`/app/simulacoes/nova?clientId=${id}`}>
                  <Calculator className="h-4 w-4 mr-2" /> Criar primeira simulação
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {simulacoes.map((sim) => (
                <Link
                  key={sim.id}
                  to={`/app/simulacoes/${sim.id}`}
                  className="block rounded-xl border border-border p-4 hover:shadow-sm hover:border-primary/30 transition-all"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{sim.name}</p>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span>Ano {sim.year}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <TrendingDown className="h-3.5 w-3.5 text-primary" />
                          Melhor: {REGIME_LABELS[sim.bestRegime] ?? sim.bestRegime}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">{formatBRL(sim.saving)}</p>
                      <p className="text-xs text-muted-foreground">economia potencial</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ações rápidas */}
      <Card>
        <CardHeader>
          <CardTitle>Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link to={`/app/simulacoes/nova?clientId=${id}`}>
              <Calculator className="h-4 w-4 mr-2" /> Nova Simulação
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/app/envidamento">
              <FileBarChart2 className="h-4 w-4 mr-2" /> Analisar Endividamento
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/app/calendario">
              <Calendar className="h-4 w-4 mr-2" /> Calendário Fiscal
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/app/integracoes/apresentacao">
              <TrendingUp className="h-4 w-4 mr-2" /> Apresentação Executiva
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClienteDashboard;
