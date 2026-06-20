import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart3, FileText, ShieldCheck, Calculator, Database, FileInput, Scale, Plug } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo className="h-9" />
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost"><Link to="/login">Entrar</Link></Button>
            <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Link to="/login">Começar</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-dark text-primary-foreground">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-brand/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-brand/10 blur-3xl" />
        <div className="relative max-w-7xl mx-auto px-6 py-20 md:py-28 grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand/15 text-brand text-xs font-semibold uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
              Plataforma do Escritório Contábil
            </div>
            <h1 className="text-4xl md:text-6xl font-display font-extrabold leading-[1.05]">
              A central tributária que o seu escritório <span className="text-brand">precisa.</span>
            </h1>
            <p className="text-lg text-primary-foreground/75 max-w-xl">
              Comparativo Simples × Lucro Presumido, Apuração Trimestral, Reforma Tributária (LC 214/2025),
              Leitor de SPED, SPED Inventário e Integrações com sistemas do escritório — tudo em um só lugar.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild size="lg" className="bg-brand text-brand-foreground hover:bg-brand/90 shadow-brand">
                <Link to="/login">Começar agora <ArrowRight className="w-4 h-4 ml-2" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 bg-transparent">
                <a href="#recursos">Ver recursos</a>
              </Button>
            </div>
          </div>
          <div className="relative">
            <div className="bg-card text-card-foreground rounded-2xl shadow-elegant p-6 md:p-8 border border-border">
              <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Resumo da Simulação</div>
              <div className="mt-2 text-2xl font-display font-bold">Cliente — Estudo 2026</div>
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted">
                  <div className="text-xs text-muted-foreground">Simples Nacional</div>
                  <div className="text-2xl font-bold">R$ 66.391</div>
                  <div className="text-xs text-success font-semibold">↓ Mais econômico</div>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <div className="text-xs text-muted-foreground">Lucro Presumido</div>
                  <div className="text-2xl font-bold">R$ 73.512</div>
                  <div className="text-xs text-muted-foreground">+ R$ 7.121</div>
                </div>
              </div>
              <div className="mt-6 h-32 rounded-lg bg-gradient-to-r from-brand/10 to-brand/5 flex items-end gap-1 p-3">
                {[28, 45, 32, 60, 48, 70, 55, 82, 65, 90, 75, 95].map((h, i) => (
                  <div key={i} className="flex-1 rounded-sm bg-brand" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="recursos" className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="text-xs uppercase tracking-widest text-brand font-bold">Recursos</div>
          <h2 className="text-3xl md:text-4xl font-display font-bold mt-2">Tudo o que o contador precisa.</h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: Calculator, title: "Comparativo Tributário", desc: "Simples × Lucro Presumido com Fator R automático e exportação em PDF/Excel." },
            { icon: BarChart3, title: "Apuração Trimestral", desc: "IRPJ/CSLL trimestral com adicional de 10% e relatórios institucionais." },
            { icon: Scale, title: "Reforma Tributária", desc: "Analisador LC 214/2025 — IBS, CBS e cronograma de transição 2026–2033." },
            { icon: FileInput, title: "Leitor de SPED", desc: "Importa EFD ICMS/IPI e EFD-Contribuições e alimenta as simulações." },
            { icon: Database, title: "SPED Inventário", desc: "Geração assistida do Bloco H do SPED Fiscal." },
            { icon: Plug, title: "Integrações de Sistema", desc: "Conecte SCI, Acessórias e demais sistemas do escritório." },
            { icon: ShieldCheck, title: "Cadastro de clientes", desc: "Base centralizada com CNPJ, atividade e histórico de simulações." },
            { icon: FileText, title: "Relatórios profissionais", desc: "Declarações e dossiês prontos para o cliente, no padrão do escritório." },
          ].map((f) => (
            <div key={f.title} className="p-6 rounded-xl border border-border bg-card shadow-card hover:shadow-elegant transition-shadow">
              <div className="w-10 h-10 rounded-lg bg-brand/15 text-brand flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5" />
              </div>
              <h3 className="font-display font-bold">{f.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border bg-primary text-primary-foreground/70">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <Logo className="h-7" variant="light" />
          <div className="text-xs">© {new Date().getFullYear()} Econ Escritório Contábil Ltda. Todos os direitos reservados.</div>
        </div>
      </footer>
    </div>
  );
}
