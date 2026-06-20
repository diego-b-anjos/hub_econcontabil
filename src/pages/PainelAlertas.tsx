import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Bell, CalendarDays, ChevronRight, TrendingUp, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiClients, type Client } from "@/lib/api";
import { obrigacoesParaCliente, type Obrigacao } from "@/data/tributos";
import { useSelectedClients } from "@/contexts/SelectedClientsContext";

interface AlertaItem {
  data: Date;
  diaStr: string;       // "09/05"
  diasRestantes: number; // 0 = hoje, negativo = vencido
  obrigacao: Obrigacao;
  clientes: Client[];
}

const ESFERA_COLORS: Record<string, string> = {
  federal: "bg-blue-100 text-blue-800",
  estadual: "bg-orange-100 text-orange-800",
  municipal: "bg-violet-100 text-violet-800",
  trabalhista: "bg-green-100 text-green-800",
};

function diasRestantesLabel(n: number) {
  if (n < 0) return `Vencido há ${Math.abs(n)} dia${Math.abs(n) !== 1 ? "s" : ""}`;
  if (n === 0) return "Vence hoje";
  if (n === 1) return "Amanhã";
  return `Em ${n} dias`;
}

function diasRestantesBadgeClass(n: number) {
  if (n < 0) return "bg-red-100 text-red-700";
  if (n <= 2) return "bg-orange-100 text-orange-700";
  if (n <= 7) return "bg-yellow-100 text-yellow-700";
  return "bg-muted text-muted-foreground";
}

export default function PainelAlertas() {
  const { selectedIds } = useSelectedClients();
  const [clientes, setClientes] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiClients.list()
      .then((d) => setClientes(Array.isArray(d) ? d : []))
      .catch(() => setClientes([]))
      .finally(() => setLoading(false));
  }, []);

  const clientesFiltrados = useMemo(() => {
    if (selectedIds.length === 0) return clientes;
    return clientes.filter((c) => selectedIds.includes(c.id));
  }, [clientes, selectedIds]);

  const alertas = useMemo((): AlertaItem[] => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const limite = new Date(hoje);
    limite.setDate(limite.getDate() + 30);

    // Coletar obrigações dos próximos 30 dias (pode abranger 2 meses)
    const meses = new Set<string>();
    for (let d = new Date(hoje); d <= limite; d.setDate(d.getDate() + 1)) {
      meses.add(`${d.getFullYear()}-${d.getMonth() + 1}`);
    }

    // Mapear obrigação id+data → lista de clientes afetados
    const byKey = new Map<string, AlertaItem>();

    clientesFiltrados.forEach((cli) => {
      meses.forEach((ymKey) => {
        const [yStr, mStr] = ymKey.split("-");
        const ano = Number(yStr);
        const mes = Number(mStr);
        const obs = obrigacoesParaCliente(mes, cli);
        obs.forEach((o) => {
          const data = new Date(ano, mes - 1, o.dia);
          data.setHours(0, 0, 0, 0);
          if (data < hoje || data > limite) return;
          const key = `${o.id}-${data.toISOString().slice(0, 10)}`;
          if (!byKey.has(key)) {
            const diffMs = data.getTime() - hoje.getTime();
            const diasRestantes = Math.round(diffMs / 86_400_000);
            byKey.set(key, {
              data,
              diaStr: data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
              diasRestantes,
              obrigacao: o,
              clientes: [],
            });
          }
          byKey.get(key)!.clientes.push(cli);
        });
      });
    });

    return Array.from(byKey.values()).sort((a, b) => a.data.getTime() - b.data.getTime());
  }, [clientesFiltrados]);

  const vencendoHoje = alertas.filter((a) => a.diasRestantes === 0);
  const proximos7 = alertas.filter((a) => a.diasRestantes > 0 && a.diasRestantes <= 7);
  const proximos30 = alertas.filter((a) => a.diasRestantes > 7);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Bell className="h-4 w-4" />
            <span>Painel de Alertas</span>
          </div>
          <h1 className="text-3xl font-display font-bold">Vencimentos dos próximos 30 dias</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Obrigações fiscais e tributárias que vencem em até 30 dias.
            {selectedIds.length > 0
              ? ` Filtrado para ${selectedIds.length} cliente${selectedIds.length > 1 ? "s" : ""}.`
              : " Todos os clientes."}
          </p>
        </div>
        <Link to="/app/dre-simplificada">
          <Button variant="outline" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            DRE Simplificada
          </Button>
        </Link>
      </div>

      {/* Resumo */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Card className={vencendoHoje.length > 0 ? "border-orange-300 bg-orange-50" : ""}>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Vencem hoje</div>
            <div className="text-3xl font-display font-bold mt-1 text-orange-600">{vencendoHoje.length}</div>
          </CardContent>
        </Card>
        <Card className={proximos7.length > 0 ? "border-yellow-300 bg-yellow-50" : ""}>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Próximos 7 dias</div>
            <div className="text-3xl font-display font-bold mt-1 text-yellow-700">{proximos7.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Próximos 30 dias</div>
            <div className="text-3xl font-display font-bold mt-1">{proximos30.length}</div>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Carregando clientes...</div>
      ) : clientesFiltrados.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground space-y-2">
            <Users className="h-10 w-10 mx-auto opacity-30" />
            <p className="font-medium">Nenhum cliente cadastrado</p>
            <p className="text-xs">Cadastre clientes para ver os alertas de vencimento.</p>
            <Link to="/app/clientes">
              <Button variant="outline" size="sm" className="mt-2">Ir para Clientes</Button>
            </Link>
          </CardContent>
        </Card>
      ) : alertas.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <AlertTriangle className="h-10 w-10 mx-auto opacity-30 mb-2" />
            <p className="font-medium">Nenhuma obrigação nos próximos 30 dias</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {vencendoHoje.length > 0 && (
            <AlertasSection title="Vencem hoje" items={vencendoHoje} urgente />
          )}
          {proximos7.length > 0 && (
            <AlertasSection title="Próximos 7 dias" items={proximos7} />
          )}
          {proximos30.length > 0 && (
            <AlertasSection title="Próximos 8–30 dias" items={proximos30} />
          )}
        </div>
      )}
    </div>
  );
}

function AlertasSection({ title, items, urgente }: { title: string; items: AlertaItem[]; urgente?: boolean }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        {urgente && <AlertTriangle className="h-4 w-4 text-orange-500" />}
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{title}</h2>
        <span className="text-xs text-muted-foreground">({items.length})</span>
      </div>
      <div className="space-y-2">
        {items.map((alerta) => (
          <AlertaCard key={`${alerta.obrigacao.id}-${alerta.diaStr}`} alerta={alerta} />
        ))}
      </div>
    </section>
  );
}

function AlertaCard({ alerta }: { alerta: AlertaItem }) {
  const { obrigacao: o, clientes, diaStr, diasRestantes } = alerta;
  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-4 flex items-start gap-4">
        {/* Data */}
        <div className="shrink-0 w-12 text-center">
          <div className="text-lg font-display font-bold leading-none">{diaStr.split("/")[0]}</div>
          <div className="text-xs text-muted-foreground">/{diaStr.split("/")[1]}</div>
        </div>
        {/* Info */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold">{o.nome}</p>
            <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${ESFERA_COLORS[o.tipo] ?? "bg-muted"}`}>
              {o.tipo}
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate">{o.descricao}</p>
          {clientes.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {clientes.slice(0, 5).map((c) => (
                <Badge key={c.id} variant="secondary" className="text-[10px] h-5">
                  {c.name}
                </Badge>
              ))}
              {clientes.length > 5 && (
                <Badge variant="secondary" className="text-[10px] h-5">+{clientes.length - 5}</Badge>
              )}
            </div>
          )}
        </div>
        {/* Prazo */}
        <div className="shrink-0 text-right">
          <span className={`text-[11px] font-semibold px-2 py-1 rounded ${diasRestantesBadgeClass(diasRestantes)}`}>
            {diasRestantesLabel(diasRestantes)}
          </span>
          {o.link && (
            <a
              href={o.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-end gap-0.5 text-[10px] text-primary hover:underline mt-1"
            >
              Legislação <ChevronRight className="h-3 w-3" />
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
