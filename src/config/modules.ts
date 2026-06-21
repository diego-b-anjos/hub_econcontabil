import {
  LayoutDashboard,
  Users,
  Calculator,
  FileBarChart2,
  FileSearch,
  Gift,
  Database,
  ShieldCheck,
  FileInput,
  Plug,
  Presentation,
  CalendarDays,
  Globe,
  ClipboardList,
  BadgeCheck,
  UserCog,
  Bell,
  TrendingUp,
  Newspaper,
  FileCode,
  KanbanSquare,
  type LucideIcon,
} from "lucide-react";
import imgDashboard from "@/assets/mod-dashboard.svg";
import imgClientes from "@/assets/mod-clientes.svg";
import imgSimulacoes from "@/assets/mod-simulacoes.svg";
import imgTrimestral from "@/assets/mod-trimestral.svg";
import imgBeneficio from "@/assets/mod-beneficio.svg";
import imgEnvidamento from "@/assets/mod-envidamento.svg";
import imgSped from "@/assets/mod-sped.svg";
import imgQuickVerify from "@/assets/mod-quickverify.svg";
import imgSpedReader from "@/assets/mod-sped-reader.svg";
import imgIntegracoes from "@/assets/mod-integracoes.svg";
import imgApresentacao from "@/assets/mod-apresentacao.svg";

export type ModuleStatus = "active" | "coming-soon";

export type ModuleCategory =
  | "Geral"
  | "Tributário"
  | "Fiscal"
  | "Auditoria"; // reservado para futuros módulos de auditoria

export interface AppModule {
  id: string;
  label: string;
  description: string;
  to: string;
  icon: LucideIcon;
  category: ModuleCategory;
  status: ModuleStatus;
  end?: boolean;
  image?: string;
  /** Quando definido, este módulo aparece como sub-item dentro do módulo pai (id) na sidebar */
  parentId?: string;
  /** Quando true, este módulo é um agrupador (não tem rota própria, apenas reúne sub-itens) */
  isGroup?: boolean;
  /** Esconde da sidebar (mantém rota acessível). Útil para placeholders. */
  hideFromSidebar?: boolean;
}

/**
 * Registro central dos módulos do escritório.
 * Para adicionar um novo módulo no futuro, basta incluir uma entrada aqui
 * e criar a rota correspondente em App.tsx.
 */
export const APP_MODULES: AppModule[] = [
  // Geral
  {
    id: "dashboard",
    label: "Painel",
    description: "Visão geral do escritório e atalhos.",
    to: "/app",
    icon: LayoutDashboard,
    category: "Geral",
    status: "active",
    end: true,
    image: imgDashboard,
  },
  {
    id: "cadastros",
    label: "Cadastros",
    description: "Clientes, contadores e usuários do escritório.",
    to: "/app/clientes",
    icon: ClipboardList,
    category: "Geral",
    status: "active",
    isGroup: true,
    image: imgClientes,
  },
  {
    id: "clientes",
    label: "Clientes",
    description: "Cadastro central de clientes do escritório.",
    to: "/app/clientes",
    icon: Users,
    category: "Geral",
    status: "active",
    parentId: "cadastros",
    image: imgClientes,
  },
  {
    id: "contadores",
    label: "Contadores",
    description: "Profissionais responsáveis pelos relatórios (CRC obrigatório).",
    to: "/app/cadastros/contadores",
    icon: BadgeCheck,
    category: "Geral",
    status: "active",
    parentId: "cadastros",
    image: imgClientes,
  },
  {
    id: "usuarios",
    label: "Usuários",
    description: "Pessoas com acesso ao sistema, vinculadas a contadores.",
    to: "/app/cadastros/usuarios",
    icon: UserCog,
    category: "Geral",
    status: "active",
    parentId: "cadastros",
    image: imgClientes,
  },

  // Tributário
  {
    id: "simulacoes",
    label: "Comparativo Tributário",
    description: "Simulações Simples Nacional, Lucro Presumido e Lucro Real.",
    to: "/app/simulacoes",
    icon: Calculator,
    category: "Tributário",
    status: "active",
    image: imgSimulacoes,
  },
  {
    id: "apuracao-trimestral",
    label: "Apuração Trimestral",
    description: "Adicional de 10% — IRPJ/CSLL trimestral.",
    to: "/app/apuracao-trimestral",
    icon: FileBarChart2,
    category: "Tributário",
    status: "active",
    image: imgTrimestral,
  },
  {
    id: "beneficio-fiscal",
    label: "Benefício Fiscal Master",
    description: "Gestão e relatórios de benefícios fiscais.",
    to: "/app/beneficio-fiscal",
    icon: Gift,
    category: "Tributário",
    status: "active",
    image: imgBeneficio,
  },

  // Fiscal
  {
    id: "calendario",
    label: "Calendário Fiscal",
    description: "Prazos mensais de obrigações fiscais, trabalhistas e declarações.",
    to: "/app/calendario",
    icon: CalendarDays,
    category: "Fiscal",
    status: "active",
    image: imgSped,
  },
  {
    id: "envidamento",
    label: "Endividamento Tributário",
    description: "Análise de débitos, parcelamentos e CNDs por órgão.",
    to: "/app/envidamento",
    icon: FileSearch,
    category: "Fiscal",
    status: "active",
    image: imgEnvidamento,
  },
  {
    id: "sped",
    label: "SPED",
    description: "Leitor de SPED e geração de Inventário (Bloco H).",
    to: "/app/sped-leitor",
    icon: Database,
    category: "Fiscal",
    status: "active",
    isGroup: true,
    image: imgSped,
  },
  {
    id: "sped-leitor",
    label: "Leitor de SPED e Extrato SN",
    description: "Importa EFD ICMS/IPI, EFD-Contribuições e Extrato do Simples Nacional (PGDAS-D) para extrair faturamento, compras e impostos.",
    to: "/app/sped-leitor",
    icon: FileInput,
    category: "Fiscal",
    status: "active",
    parentId: "sped",
    image: imgSpedReader,
  },
  {
    id: "sped-inventario",
    label: "SPED Inventário",
    description: "Geração do Bloco H — Inventário SPED Fiscal.",
    to: "/app/sped-inventario",
    icon: Database,
    category: "Fiscal",
    status: "active",
    parentId: "sped",
    image: imgSped,
  },

  {
    id: "reforma-tributaria",
    label: "Reforma Tributária",
    description: "Analisador da Reforma Tributária — LC 214/2025.",
    to: "/app/reforma-tributaria",
    icon: ShieldCheck,
    category: "Tributário",
    status: "active",
    image: imgQuickVerify,
  },
  {
    id: "mapeamento-tributario",
    label: "CST IBS/CBS e IS",
    description: "Mapeamento de CST IBS/CBS (LC 214/2025) e calculadora do Imposto Seletivo com alíquotas reais.",
    to: "/app/mapeamento-tributario",
    icon: FileCode,
    category: "Tributário",
    status: "active",
    image: imgQuickVerify,
    hideFromSidebar: true,
  },
  {
    id: "painel-alertas",
    label: "Painel de Alertas",
    description: "Vencimentos dos próximos 30 dias — obrigações fiscais e trabalhistas de todos os clientes.",
    to: "/app/painel-alertas",
    icon: Bell,
    category: "Fiscal",
    status: "active",
    image: imgSped,
  },
  {
    id: "dre-simplificada",
    label: "DRE Simplificada",
    description: "Demonstração de Resultado do Exercício com base nas simulações tributárias.",
    to: "/app/dre-simplificada",
    icon: TrendingUp,
    category: "Fiscal",
    status: "active",
    image: imgTrimestral,
  },
  {
    id: "integracoes",
    label: "Integrações",
    description: "Conecte SCI, Acessórias e demais sistemas do escritório.",
    to: "/app/integracoes",
    icon: Plug,
    category: "Geral",
    status: "active",
    isGroup: true,
    image: imgIntegracoes,
  },
  {
    id: "integracoes-painel",
    label: "Painel de Integrações",
    description: "Status das integrações ativas (SCI, Acessórias).",
    to: "/app/integracoes",
    icon: Plug,
    category: "Geral",
    status: "active",
    parentId: "integracoes",
    end: true,
    image: imgIntegracoes,
  },
  {
    id: "apresentacao-executiva",
    label: "Apresentação Executiva",
    description: "Deck consolidado com SCI, Acessórias e indicadores do escritório.",
    to: "/app/integracoes/apresentacao",
    icon: Presentation,
    category: "Geral",
    status: "active",
    parentId: "integracoes",
    image: imgApresentacao,
  },
  {
    id: "links-uteis",
    label: "Links Úteis",
    description: "Atalhos para Receita, SEFAZ, prefeituras, sistemas internos, conselhos e bancos.",
    to: "/app/links-uteis",
    icon: Globe,
    category: "Geral",
    status: "active",
    image: imgIntegracoes,
  },
  {
    id: "noticias",
    label: "Notícias Contábeis",
    description: "Últimas notícias da Receita Federal, SEFAZ-SP, Contábeis.com.br, CFC e outros portais do setor.",
    to: "/app/noticias",
    icon: Newspaper,
    category: "Geral",
    status: "active",
    image: imgIntegracoes,
  },
  {
    id: "tarefas",
    label: "Tarefas",
    description: "Quadro Kanban para gestão de tarefas do escritório.",
    to: "/app/tarefas",
    icon: KanbanSquare,
    category: "Geral",
    status: "active",
    image: imgDashboard,
  },
];

export const MODULE_CATEGORIES: ModuleCategory[] = [
  "Geral",
  "Tributário",
  "Fiscal",
];

export function modulesByCategory(category: ModuleCategory): AppModule[] {
  return APP_MODULES.filter((m) => m.category === category && !m.hideFromSidebar);
}

/** Retorna apenas módulos top-level (sem parentId) de uma categoria, para renderização na sidebar. */
export function topLevelModulesByCategory(category: ModuleCategory): AppModule[] {
  return APP_MODULES.filter(
    (m) => m.category === category && !m.parentId && !m.hideFromSidebar,
  );
}

/** Retorna sub-itens de um módulo agrupador. */
export function subItemsOf(parentId: string): AppModule[] {
  return APP_MODULES.filter((m) => m.parentId === parentId && !m.hideFromSidebar);
}
