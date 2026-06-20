import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink,
  Search,
  Building2,
  Landmark,
  Scale,
  Banknote,
  Users,
  FileText,
  Globe,
  ShieldCheck,
  Briefcase,
  MapPin,
  type LucideIcon,
} from "lucide-react";

type Categoria =
  | "Federal"
  | "Estadual (SP)"
  | "Municipal — Região"
  | "Conselhos & Sindicatos"
  | "Trabalhista & Previdenciário"
  | "Bancos & Pagamentos"
  | "Consultas & Cadastros"
  | "Sistemas Internos do Escritório";

interface LinkItem {
  titulo: string;
  url: string;
  descricao?: string;
  categoria: Categoria;
  destaque?: boolean;
}

const CAT_ICON: Record<Categoria, LucideIcon> = {
  "Federal": Landmark,
  "Estadual (SP)": Building2,
  "Municipal — Região": MapPin,
  "Conselhos & Sindicatos": Scale,
  "Trabalhista & Previdenciário": Users,
  "Bancos & Pagamentos": Banknote,
  "Consultas & Cadastros": FileText,
  "Sistemas Internos do Escritório": Briefcase,
};

const CAT_COLOR: Record<Categoria, string> = {
  "Federal": "bg-blue-50 border-blue-200 text-blue-700",
  "Estadual (SP)": "bg-purple-50 border-purple-200 text-purple-700",
  "Municipal — Região": "bg-green-50 border-green-200 text-green-700",
  "Conselhos & Sindicatos": "bg-amber-50 border-amber-200 text-amber-700",
  "Trabalhista & Previdenciário": "bg-orange-50 border-orange-200 text-orange-700",
  "Bancos & Pagamentos": "bg-rose-50 border-rose-200 text-rose-700",
  "Consultas & Cadastros": "bg-slate-50 border-slate-200 text-slate-700",
  "Sistemas Internos do Escritório": "bg-yellow-50 border-yellow-200 text-yellow-800",
};

const LINKS: LinkItem[] = [
  // ===== FEDERAL =====
  { categoria: "Federal", destaque: true, titulo: "e-CAC — Centro Virtual de Atendimento RFB", url: "https://cav.receita.fazenda.gov.br/autenticacao/login", descricao: "Acesso a caixa postal, DCTFWeb, parcelamentos, CND, Procurações." },
  { categoria: "Federal", destaque: true, titulo: "Portal do Simples Nacional (PGDAS-D / DEFIS)", url: "https://www8.receita.fazenda.gov.br/SimplesNacional/", descricao: "Apuração mensal do DAS, DEFIS anual, opções e exclusões." },
  { categoria: "Federal", titulo: "Receita Federal do Brasil", url: "https://www.gov.br/receitafederal/pt-br", descricao: "Portal oficial da RFB — legislação, atos, serviços." },
  { categoria: "Federal", titulo: "eSocial — Empresas", url: "https://login.esocial.gov.br/login.aspx", descricao: "Envio de eventos da folha de pagamento (S-1200, S-1210, S-1299)." },
  { categoria: "Federal", titulo: "EFD-Reinf", url: "https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/declaracoes-e-demonstrativos/sistema-publico-de-escrituracao-digital-sped/efd-reinf", descricao: "Escrituração de retenções e outras informações fiscais." },
  { categoria: "Federal", titulo: "SPED — Portal Nacional", url: "http://sped.rfb.gov.br/", descricao: "ECD, ECF, EFD ICMS/IPI, EFD-Contribuições, NF-e, NFS-e nacional." },
  { categoria: "Federal", titulo: "Conectividade Social (Caixa)", url: "https://conectividadesocial.caixa.gov.br/", descricao: "Envio de SEFIP/GFIP, FGTS Digital." },
  { categoria: "Federal", titulo: "FGTS Digital", url: "https://www.gov.br/trabalho-e-emprego/pt-br/servicos/empregador/fgtsdigital", descricao: "Recolhimento e gestão do FGTS (substitui SEFIP a partir de 2024/2025)." },
  { categoria: "Federal", titulo: "Sicalc Web (DARF)", url: "https://sicalc.receita.economia.gov.br/sicalc/principal", descricao: "Cálculo e emissão de DARF avulso com multa e juros." },
  { categoria: "Federal", titulo: "PGFN — Regularize", url: "https://www.regularize.pgfn.gov.br/", descricao: "Dívida Ativa da União, parcelamentos, CND PGFN, transação tributária." },
  { categoria: "Federal", destaque: true, titulo: "Portal de Serviços da Receita Federal", url: "https://www.gov.br/receitafederal/pt-br/servicos", descricao: "Catálogo completo de serviços da RFB — CNPJ, CPF, certidões, parcelamentos, restituição, IRPF/IRPJ, atendimento e legislação." },
  { categoria: "Federal", titulo: "Portal de Serviços (legado) — receita.fazenda.gov.br", url: "https://servicos.receita.fazenda.gov.br/", descricao: "Portal antigo de serviços — links diretos para consultas de CNPJ, CPF, situação fiscal e geração de certidões." },
  { categoria: "Federal", titulo: "Consulta CNPJ — Comprovante de Inscrição", url: "https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/cnpjreva_solicitacao.asp", descricao: "Cartão CNPJ atualizado e quadro societário." },
  { categoria: "Federal", titulo: "REDESIM (Abertura/Alteração de empresas)", url: "https://www.gov.br/empresas-e-negocios/pt-br/redesim", descricao: "Integração federal-estadual-municipal para abertura, alteração e baixa." },

  // ===== ESTADUAL (SP) =====
  { categoria: "Estadual (SP)", destaque: true, titulo: "SEFAZ-SP — Portal", url: "https://portal.fazenda.sp.gov.br/", descricao: "Portal oficial da Secretaria da Fazenda do Estado de São Paulo." },
  { categoria: "Estadual (SP)", destaque: true, titulo: "Posto Fiscal Eletrônico (PFE) / SP", url: "https://www.fazenda.sp.gov.br/pfe/", descricao: "Login no ambiente SEFAZ-SP — GIA, Sintegra, declarações." },
  { categoria: "Estadual (SP)", titulo: "GIA-ICMS/SP", url: "https://www.fazenda.sp.gov.br/guias/gia.shtm", descricao: "Guia de Informação e Apuração do ICMS (entrega mensal)." },
  { categoria: "Estadual (SP)", titulo: "Nota Fiscal Paulista", url: "https://www.nfp.fazenda.sp.gov.br/", descricao: "Portal NFP — créditos, prestadores e consumidores." },
  { categoria: "Estadual (SP)", titulo: "NF-e SP — Portal", url: "https://www.nfe.fazenda.sp.gov.br/portal/", descricao: "Consulta, autorização e contingência da NF-e em SP." },
  { categoria: "Estadual (SP)", titulo: "Cadesp — Cadastro de Contribuintes/SP", url: "https://www.cadesp.fazenda.sp.gov.br/", descricao: "Inscrição estadual, alterações e consulta cadastral." },
  { categoria: "Estadual (SP)", titulo: "JUCESP — Junta Comercial", url: "https://www.jucesponline.sp.gov.br/", descricao: "Consultas e protocolos digitais de atos societários." },
  { categoria: "Estadual (SP)", titulo: "Sintegra-SP", url: "https://www.sintegra.gov.br/Cad_Estados/cad_SP.html", descricao: "Consulta pública de inscrições estaduais paulistas." },
  { categoria: "Estadual (SP)", titulo: "Consulta de DI/DTA — Sefaz SP", url: "https://www10.fazenda.sp.gov.br/CtaCorrente/Pages/ConsultaCadastro.aspx", descricao: "Conta corrente fiscal — consulta de débitos ICMS." },
  { categoria: "Estadual (SP)", destaque: true, titulo: "Dívida Ativa do Estado de SP — PGE-SP", url: "https://www.dividaativa.pge.sp.gov.br/", descricao: "Procuradoria Geral do Estado de SP — consulta, emissão de guias (DARE), parcelamentos e acordos de transação." },

  // ===== MUNICIPAL — REGIÃO =====
  { categoria: "Municipal — Região", destaque: true, titulo: "NFS-e Nacional (Portal Federal)", url: "https://www.nfse.gov.br/EmissorNacional/Login", descricao: "Emissor Nacional de NFS-e (padrão unificado conforme LC 214/2025 e Convênio NFS-e). Aderido pela maioria dos municípios brasileiros." },
  { categoria: "Municipal — Região", titulo: "Portal NFS-e — gov.br", url: "https://www.gov.br/nfse/pt-br", descricao: "Página institucional do projeto NFS-e nacional — adesões, leiautes, manuais e perguntas frequentes." },
  { categoria: "Municipal — Região", destaque: true, titulo: "NFS-e São Paulo/SP", url: "https://nfe.prefeitura.sp.gov.br/contribuinte/", descricao: "Emissor de NFS-e, DEC, DES-IF e gerenciamento do ISS. Vencimento dia 10." },
  { categoria: "Municipal — Região", destaque: true, titulo: "NFS-e Barueri/SP — ISSDigital", url: "https://www.barueri.sp.gov.br/issdigital/", descricao: "Portal ISSDigital de Barueri — emissão de NFS-e, DMS e geração de guias. Vencimento dia 9 do mês seguinte." },
  { categoria: "Municipal — Região", titulo: "NFS-e Osasco/SP — ISSNet", url: "https://issnet.osasco.sp.gov.br/abrasf/login", descricao: "Sistema ISSNet/ABRASF de Osasco — emissão de NFS-e, DMS e geração de guias de ISS. Vencimento dia 10." },
  { categoria: "Municipal — Região", titulo: "NFS-e Osasco — Portal de Serviços", url: "https://www.osasco.sp.gov.br/servicos/contribuinte/nota-fiscal-de-servicos-eletronica", descricao: "Página oficial da Prefeitura de Osasco com manuais, cadastro e acesso ao emissor de NFS-e." },
  { categoria: "Municipal — Região", titulo: "NFS-e Santana de Parnaíba/SP", url: "https://nfe.santanadeparnaiba.sp.gov.br/", descricao: "Emissor municipal de NFS-e. Vencimento dia 15." },
  { categoria: "Municipal — Região", titulo: "NFS-e Cotia/SP", url: "https://cotia.sigiss.com.br/", descricao: "SIGISS Cotia — NFS-e e DMS. Vencimento dia 10." },
  { categoria: "Municipal — Região", titulo: "NFS-e Santo André/SP", url: "https://nfe.santoandre.sp.gov.br/", descricao: "Emissor municipal de NFS-e e ISS de Santo André. Vencimento dia 15." },
  { categoria: "Municipal — Região", titulo: "NFS-e São Bernardo do Campo/SP", url: "https://nfse-sbc.giap.com.br/sbc/", descricao: "Emissor municipal de NFS-e SBC e DMS. Vencimento dia 10." },
  { categoria: "Municipal — Região", titulo: "NFS-e Carapicuíba/SP", url: "https://carapicuiba.atende.net/autoatendimento/servicos/nota-fiscal-eletronica", descricao: "Atendimento online — NFS-e e ISS de Carapicuíba." },
  { categoria: "Municipal — Região", titulo: "NFS-e Itapevi/SP", url: "https://nfse.itapevi.sp.gov.br/", descricao: "Emissor municipal de NFS-e Itapevi." },
  { categoria: "Municipal — Região", titulo: "NFS-e Jandira/SP", url: "https://nfe.jandira.sp.gov.br/", descricao: "Emissor municipal de NFS-e Jandira." },
  { categoria: "Municipal — Região", titulo: "Prefeitura de São Paulo (Portal)", url: "https://www.prefeitura.sp.gov.br/", descricao: "Portal institucional — IPTU, alvarás, fiscalização." },
  { categoria: "Municipal — Região", destaque: true, titulo: "Dívida Ativa Municipal — Prefeitura de SP", url: "https://www.prefeitura.sp.gov.br/cidade/secretarias/fazenda/servicos/dividaativa/", descricao: "Consulta, parcelamento e emissão de guias da Dívida Ativa Municipal de São Paulo (ISS, IPTU, taxas)." },

  // ===== CONSELHOS & SINDICATOS =====
  { categoria: "Conselhos & Sindicatos", destaque: true, titulo: "CRC-SP — Conselho Regional de Contabilidade", url: "https://www.crcsp.org.br/", descricao: "Anuidade, CFC, fiscalização e atualização profissional." },
  { categoria: "Conselhos & Sindicatos", titulo: "CFC — Conselho Federal de Contabilidade", url: "https://cfc.org.br/", descricao: "Normas brasileiras de contabilidade (NBC), legislação federal." },
  { categoria: "Conselhos & Sindicatos", titulo: "SESCON-SP", url: "https://www.sescon.org.br/", descricao: "Sindicato das Empresas de Serviços Contábeis de SP." },
  { categoria: "Conselhos & Sindicatos", titulo: "FENACON", url: "https://fenacon.org.br/", descricao: "Federação nacional dos sindicatos contábeis." },
  { categoria: "Conselhos & Sindicatos", titulo: "IBPT — Instituto Brasileiro de Planejamento Tributário", url: "https://ibpt.com.br/", descricao: "Estudos e indicadores tributários." },

  // ===== TRABALHISTA & PREVIDENCIÁRIO =====
  { categoria: "Trabalhista & Previdenciário", destaque: true, titulo: "Meu INSS", url: "https://meu.inss.gov.br/", descricao: "Atendimento ao segurado: benefícios, perícias, contribuições." },
  { categoria: "Trabalhista & Previdenciário", titulo: "CAGED / Novo CAGED (eSocial)", url: "https://www.gov.br/trabalho-e-emprego/pt-br", descricao: "Cadastro Geral de Empregados e Desempregados (substituído pelo eSocial)." },
  { categoria: "Trabalhista & Previdenciário", titulo: "Empregador Web (Seguro-Desemprego)", url: "https://empregadorweb.mte.gov.br/", descricao: "Geração do requerimento de seguro-desemprego." },
  { categoria: "Trabalhista & Previdenciário", titulo: "Carteira de Trabalho Digital", url: "https://www.gov.br/trabalho-e-emprego/pt-br/servicos/trabalhador/carteira-de-trabalho-digital", descricao: "CTPS digital — consulta e emissão." },
  { categoria: "Trabalhista & Previdenciário", titulo: "RAIS / DIRF (histórico)", url: "https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/empregador/rais", descricao: "Histórico e legislação da RAIS (substituída pelo eSocial)." },
  { categoria: "Trabalhista & Previdenciário", titulo: "PIS/PASEP — Caixa", url: "https://www.caixa.gov.br/beneficios-trabalhador/pis/Paginas/default.aspx", descricao: "Consulta abono salarial PIS." },

  // ===== BANCOS & PAGAMENTOS =====
  { categoria: "Bancos & Pagamentos", titulo: "Banco Central do Brasil", url: "https://www.bcb.gov.br/", descricao: "Selic, IPCA, taxas de câmbio, normativos." },
  { categoria: "Bancos & Pagamentos", titulo: "BC — Cotações de moedas", url: "https://www.bcb.gov.br/estabilidadefinanceira/historicocotacoes", descricao: "PTAX e cotações históricas oficiais." },
  { categoria: "Bancos & Pagamentos", titulo: "Banco do Brasil — Empresarial", url: "https://www.bb.com.br/site/empresas/", descricao: "Portal empresarial BB." },
  { categoria: "Bancos & Pagamentos", titulo: "Caixa Econômica — Empresas", url: "https://www.caixa.gov.br/empresa/Paginas/default.aspx", descricao: "Convênios FGTS, INSS e tributos federais." },
  { categoria: "Bancos & Pagamentos", titulo: "Itaú — Empresas", url: "https://www.itau.com.br/empresas/", descricao: "Portal Itaú Empresas." },
  { categoria: "Bancos & Pagamentos", titulo: "Bradesco Net Empresa", url: "https://banco.bradesco/html/classic/produtos-servicos/empresa/internet-banking/index.shtm", descricao: "Portal Bradesco para PJ." },

  // ===== CONSULTAS & CADASTROS =====
  { categoria: "Consultas & Cadastros", destaque: true, titulo: "Consulta CNPJ — Receita Federal", url: "https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/cnpjreva_solicitacao.asp", descricao: "Cartão CNPJ atualizado." },
  { categoria: "Consultas & Cadastros", titulo: "Consulta CPF — Situação cadastral", url: "https://servicos.receita.fazenda.gov.br/Servicos/CPF/ConsultaSituacao/ConsultaPublica.asp", descricao: "Verificar situação cadastral do CPF." },
  { categoria: "Consultas & Cadastros", titulo: "CND Federal Conjunta (RFB/PGFN)", url: "https://solucoes.receita.fazenda.gov.br/Servicos/certidaointernet/PJ/Emitir", descricao: "Certidão Negativa de Débitos Federais." },
  { categoria: "Consultas & Cadastros", titulo: "CND FGTS (Caixa)", url: "https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf", descricao: "Certificado de Regularidade do FGTS (CRF)." },
  { categoria: "Consultas & Cadastros", titulo: "CND Trabalhista (TST)", url: "https://cndt-certidao.tst.jus.br/inicio.faces", descricao: "Certidão Negativa de Débitos Trabalhistas." },
  { categoria: "Consultas & Cadastros", titulo: "Consulta CNAE — IBGE", url: "https://cnae.ibge.gov.br/", descricao: "Classificação Nacional de Atividades Econômicas." },
  { categoria: "Consultas & Cadastros", titulo: "Consulta CEP — Correios", url: "https://buscacepinter.correios.com.br/app/endereco/index.php", descricao: "Busca de CEP por endereço ou logradouro." },
  { categoria: "Consultas & Cadastros", titulo: "Validador de Chave NF-e", url: "https://www.nfe.fazenda.gov.br/portal/consulta.aspx", descricao: "Consulta a NF-e nacional pela chave de acesso." },

  // ===== SISTEMAS INTERNOS DO ESCRITÓRIO =====
  { categoria: "Sistemas Internos do Escritório", destaque: true, titulo: "SCI — Sistema Contábil Integrado", url: "https://www.scibr.com.br/", descricao: "Sistema interno de gestão contábil/fiscal/folha." },
  { categoria: "Sistemas Internos do Escritório", titulo: "Acessórias (Gestão de Obrigações)", url: "https://app.acessorias.com/", descricao: "Plataforma de gestão de obrigações acessórias e prazos." },
  { categoria: "Sistemas Internos do Escritório", titulo: "DocuSign / Assinatura digital", url: "https://www.docusign.com/pt-br", descricao: "Assinatura eletrônica de contratos e documentos." },
];

export default function LinksUteis() {
  const [busca, setBusca] = useState("");
  const [catSel, setCatSel] = useState<Categoria | "Todas">("Todas");

  const categorias = useMemo(() => {
    const set = new Set<Categoria>();
    LINKS.forEach((l) => set.add(l.categoria));
    return Array.from(set);
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return LINKS.filter((l) => {
      if (catSel !== "Todas" && l.categoria !== catSel) return false;
      if (!q) return true;
      return (
        l.titulo.toLowerCase().includes(q) ||
        (l.descricao || "").toLowerCase().includes(q) ||
        l.categoria.toLowerCase().includes(q)
      );
    });
  }, [busca, catSel]);

  const agrupados = useMemo(() => {
    const map = new Map<Categoria, LinkItem[]>();
    filtrados.forEach((l) => {
      if (!map.has(l.categoria)) map.set(l.categoria, []);
      map.get(l.categoria)!.push(l);
    });
    return Array.from(map.entries());
  }, [filtrados]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Globe className="h-6 w-6 text-primary" />
          Links Úteis do Escritório
        </h1>
        <p className="text-muted-foreground mt-1">
          Atalhos rápidos para portais oficiais (Receita, SEFAZ, prefeituras),
          sistemas internos, conselhos e bancos. {LINKS.length} links organizados em
          {" "}{categorias.length} categorias.
        </p>
      </div>

      {/* Busca + categorias */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar link, sistema ou tributo (ex.: PGDAS, NFS-e, FGTS)…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCatSel("Todas")}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                catSel === "Todas"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-white hover:bg-accent"
              }`}
            >
              Todas
            </button>
            {categorias.map((c) => {
              const Icon = CAT_ICON[c];
              const active = catSel === c;
              return (
                <button
                  key={c}
                  onClick={() => setCatSel(c)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors flex items-center gap-1.5 ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-white hover:bg-accent"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {c}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Listagem agrupada */}
      {agrupados.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            Nenhum link encontrado para "{busca}".
          </CardContent>
        </Card>
      )}

      {agrupados.map(([cat, items]) => {
        const Icon = CAT_ICON[cat];
        const colorCls = CAT_COLOR[cat];
        return (
          <Card key={cat}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span className={`inline-flex h-7 w-7 items-center justify-center rounded-md border ${colorCls}`}>
                  <Icon className="h-4 w-4" />
                </span>
                {cat}
                <Badge variant="outline" className="ml-1 text-[10px]">{items.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {items.map((l) => (
                <a
                  key={l.url}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group block rounded-lg border p-3 transition-all hover:shadow-md hover:border-primary/40 bg-white ${
                    l.destaque ? "ring-1 ring-primary/20" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm group-hover:text-primary transition-colors flex items-center gap-1.5">
                        {l.destaque && <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />}
                        <span className="truncate">{l.titulo}</span>
                      </p>
                      {l.descricao && (
                        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{l.descricao}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground/60 mt-1 truncate">{new URL(l.url).hostname}</p>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0 mt-0.5" />
                  </div>
                </a>
              ))}
            </CardContent>
          </Card>
        );
      })}

      <p className="text-xs text-muted-foreground">
        Use Ctrl+F (ou o campo de busca) para encontrar rapidamente. Para sugerir um novo link,
        peça ao administrador do escritório.
      </p>
    </div>
  );
}
