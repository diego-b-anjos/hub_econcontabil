import { Card, CardContent } from "@/components/ui/card";
import { Building2, ScrollText, FileText, Download, Send, Pencil, FileSpreadsheet, CheckCircle2, ArrowRight, Sparkles, Lightbulb, BarChart3, Copy, SortAsc, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const steps = [
  {
    icon: <BarChart3 className="h-7 w-7" />,
    title: "Dashboard Interativo",
    color: "from-teal-500 to-cyan-500",
    bgLight: "bg-teal-50 dark:bg-teal-950/30",
    borderColor: "border-teal-200 dark:border-teal-800",
    badgeColor: "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300",
    items: [
      "O painel superior exibe estatísticas: total de empresas, benefícios cadastrados e vínculos",
      "Clique em qualquer quadro do dashboard para ver os detalhes daquela categoria",
      "Visualize rapidamente quais empresas possuem ou não benefícios vinculados",
    ],
  },
  {
    icon: <Building2 className="h-7 w-7" />,
    title: "Cadastrar Empresas",
    color: "from-blue-500 to-cyan-500",
    bgLight: "bg-blue-50 dark:bg-blue-950/30",
    borderColor: "border-blue-200 dark:border-blue-800",
    badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    items: [
      "Acesse a aba 'Empresas' e clique em 'Nova Empresa'",
      "Informe o CNPJ — os dados serão preenchidos automaticamente via consulta",
      "Confira o Regime Tributário (Lucro Presumido, Lucro Real ou Simples Nacional)",
      "Importe várias empresas de uma vez via Excel (use o modelo padrão)",
      "Selecione múltiplas empresas com as caixas de seleção para excluir em lote",
      "Clique nos cabeçalhos das colunas para ordenar a tabela",
    ],
  },
  {
    icon: <ScrollText className="h-7 w-7" />,
    title: "Cadastrar Benefícios Fiscais",
    color: "from-violet-500 to-purple-500",
    bgLight: "bg-violet-50 dark:bg-violet-950/30",
    borderColor: "border-violet-200 dark:border-violet-800",
    badgeColor: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
    items: [
      "Acesse a aba 'Benefícios Fiscais' e clique em 'Novo Benefício'",
      "Selecione o tipo (CFOP ou NCM) e escolha o código desejado",
      "Selecione o cBenef — a descrição e legislação aparecerão automaticamente",
      "É possível selecionar múltiplos CFOPs/NCMs ou marcar 'Todos' de uma vez",
      "Escolha entre CST (Lucro Presumido/Real) ou CSOSN (Simples Nacional)",
      "Defina o Destinatário quando aplicável (Contribuintes, Não Contribuintes, Órgãos Públicos, Templos e Cultos Religiosos)",
      "Use os filtros de pesquisa, tipo, destinatário e ordenação por colunas para gerenciar benefícios",
      "Clique no ícone de lápis para editar benefícios cadastrados",
    ],
  },
  {
    icon: <Shield className="h-7 w-7" />,
    title: "Validação de Regime Tributário",
    color: "from-red-500 to-rose-500",
    bgLight: "bg-red-50 dark:bg-red-950/30",
    borderColor: "border-red-200 dark:border-red-800",
    badgeColor: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    items: [
      "O sistema valida automaticamente a compatibilidade entre CST/CSOSN e o regime tributário da empresa",
      "Benefícios com CSOSN são bloqueados para empresas de Lucro Presumido ou Lucro Real",
      "Benefícios com CST são bloqueados para empresas do Simples Nacional",
      "Relatórios com incompatibilidades exibem alerta e bloqueiam a exportação até a correção",
    ],
  },
  {
    icon: <Send className="h-7 w-7" />,
    title: "Vincular Benefícios às Empresas",
    color: "from-emerald-500 to-green-500",
    bgLight: "bg-emerald-50 dark:bg-emerald-950/30",
    borderColor: "border-emerald-200 dark:border-emerald-800",
    badgeColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
    items: [
      "Na aba 'Benefícios Fiscais', marque os benefícios desejados com as caixas de seleção",
      "Clique em 'Vincular às Empresas' e selecione as empresas de destino",
      "Para duplicar benefícios de uma empresa para outra, use o botão 'Duplicar Benefícios' na aba Empresas",
      "Você pode selecionar quais benefícios específicos duplicar ou duplicar todos de uma vez",
    ],
  },
  {
    icon: <FileText className="h-7 w-7" />,
    title: "Gerar Relatórios",
    color: "from-amber-500 to-orange-500",
    bgLight: "bg-amber-50 dark:bg-amber-950/30",
    borderColor: "border-amber-200 dark:border-amber-800",
    badgeColor: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
    items: [
      "Acesse a aba 'Relatórios' para visualizar os benefícios vinculados por empresa",
      "Use os filtros para localizar empresas específicas",
      "Ordene as colunas do relatório clicando nos cabeçalhos",
      "Exporte os relatórios em PDF (individual ou consolidado) ou Excel",
      "O PDF inclui cabeçalho Econ, legislação e observações personalizadas",
      "Relatórios com erros de compatibilidade CST/CSOSN serão bloqueados até a correção",
    ],
  },
  {
    icon: <Download className="h-7 w-7" />,
    title: "Importação e Exportação",
    color: "from-rose-500 to-pink-500",
    bgLight: "bg-rose-50 dark:bg-rose-950/30",
    borderColor: "border-rose-200 dark:border-rose-800",
    badgeColor: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
    items: [
      "Baixe o modelo padrão de importação (Empresas ou Benefícios) na aba correspondente",
      "Preencha a planilha seguindo as instruções na aba 'Instruções' do modelo",
      "Importe os dados via botão 'Importar Excel'",
      "Exporte os dados cadastrados a qualquer momento em Excel",
    ],
  },
  {
    icon: <Pencil className="h-7 w-7" />,
    title: "Edição e Exclusão",
    color: "from-slate-500 to-gray-500",
    bgLight: "bg-slate-50 dark:bg-slate-950/30",
    borderColor: "border-slate-200 dark:border-slate-800",
    badgeColor: "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300",
    items: [
      "Clique no ícone de lápis para editar empresas ou benefícios cadastrados",
      "Clique no ícone de lixeira para excluir registros individuais",
      "Na aba Empresas, selecione múltiplas empresas com as caixas de seleção para excluir em lote",
      "As colunas das tabelas podem ser redimensionadas arrastando as bordas dos cabeçalhos",
    ],
  },
];

const GuiaTab = () => {
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-3 py-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
          <Sparkles className="h-4 w-4" />
          Guia Completo
        </div>
        <h2 className="text-3xl font-bold text-foreground">
          Como usar o sistema cBenef
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Siga o passo a passo abaixo para cadastrar empresas, benefícios fiscais, gerar relatórios e muito mais.
        </p>
      </div>

      {/* Steps */}
      <div className="relative">
        <div className="absolute left-[39px] top-8 bottom-8 w-0.5 bg-gradient-to-b from-teal-300 via-purple-300 to-slate-300 dark:from-teal-700 dark:via-purple-700 dark:to-slate-700 hidden md:block" />

        <div className="space-y-5">
          {steps.map((step, index) => (
            <div key={index} className="relative flex gap-5">
              <div className="relative z-10 shrink-0">
                <div className={`w-[54px] h-[54px] rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center text-white shadow-lg`}>
                  {step.icon}
                </div>
              </div>

              <Card className={`flex-1 ${step.bgLight} ${step.borderColor} border shadow-sm hover:shadow-md transition-shadow`}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <Badge className={`${step.badgeColor} border-0 font-bold text-xs px-2.5`}>
                      PASSO {index + 1}
                    </Badge>
                    <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                  </div>
                  <ul className="space-y-2.5">
                    {step.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-primary/60" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>

      {/* Tip card */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-primary/15">
              <Lightbulb className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1.5">
              <p className="font-semibold text-foreground flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                Dica: Modelos de Importação
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Nas abas de Empresas e Benefícios, utilize o botão <strong>"Baixar Modelo"</strong> para obter a planilha padrão 
                com as colunas corretas e exemplos de preenchimento. A aba "Instruções" dentro do modelo explica 
                cada campo em detalhe.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick reference */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {[
          { icon: <BarChart3 className="h-5 w-5" />, label: "Dashboard", desc: "Estatísticas e detalhes" },
          { icon: <Building2 className="h-5 w-5" />, label: "Empresas", desc: "Cadastro e gestão" },
          { icon: <ScrollText className="h-5 w-5" />, label: "Benefícios", desc: "CFOP, NCM, CST, CSOSN" },
          { icon: <FileText className="h-5 w-5" />, label: "Relatórios", desc: "PDF e Excel" },
        ].map((item, i) => (
          <Card key={i} className="border hover:border-primary/30 transition-colors cursor-default">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">{item.icon}</div>
              <div>
                <p className="text-sm font-semibold text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground/40 ml-auto" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default GuiaTab;
