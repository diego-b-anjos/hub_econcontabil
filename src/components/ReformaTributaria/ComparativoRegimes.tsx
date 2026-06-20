import React, { useState, useEffect } from 'react';
import { Calculator, Scale, TrendingUp, DollarSign, Download, FileText, Award, AlertTriangle, BarChart3, AlertCircle, ArrowDownToLine, Plus } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import GraficoTransicao from './GraficoTransicao';

import type { AnexoSimples } from '@/types/tax';
import { 
  TABELAS_SIMPLES_NACIONAL_ORIGINAL, 
  TABELAS_SIMPLES_NACIONAL_REFORMA, 
  PERIODO_TRANSICAO,
  ATIVIDADES_LUCRO_PRESUMIDO
} from '@/constants/tax-tables';
import { formatarValorBRL, extrairValor, formatarMoeda, calcularAliquotaSimples } from '@/utils/tax-calculations';

// Tipo para dados importados de outros módulos
export interface DadosImportados {
  origem: 'simples' | 'presumido';
  receitaAnual: number;
  folhaPagamento: number;
  tipoAtividade?: 'comercio' | 'servicos' | 'industria';
  anexoSimples?: AnexoSimples;
  atividadeLP?: string;
  icmsAliquota?: number;
  issAliquota?: number;
  ipiAliquota?: number;
}

interface DadosRelatorio {
  tipo: 'comparativo';
  titulo: string;
  dados: any;
  dataHora: string;
}

interface Props {
  anoSelecionado: number;
  dadosImportados?: DadosImportados | null;
  onDadosConsumidos?: () => void;
  onAdicionarAoRelatorio?: (dados: DadosRelatorio) => void;
}

interface ResultadoComparativo {
  regime: string;
  receitaAnual: number;
  impostos: {
    irpj: number;
    adicionalIRPJ: number;
    csll: number;
    pis: number;
    cofins: number;
    ibs: number;
    cbs: number;
    cpp: number;
    inssPatronal?: number;
    sistemaS?: number;
    das?: number;
    icms?: number;
    iss?: number;
    ipi?: number;
  };
  totalTributos: number;
  cargaEfetiva: number;
  observacoes: string[];
}

interface ResultadoPorAno {
  ano: number;
  fase: string;
  simples: ResultadoComparativo;
  presumido: ResultadoComparativo;
  real: ResultadoComparativo;
  melhorOpcao: string;
}

const ComparativoRegimes: React.FC<Props> = ({ anoSelecionado, dadosImportados, onDadosConsumidos, onAdicionarAoRelatorio }) => {
  const [receitaAnual, setReceitaAnual] = useState('');
  const [folhaPagamento, setFolhaPagamento] = useState('');
  const [tipoAtividade, setTipoAtividade] = useState<'comercio' | 'servicos' | 'industria'>('comercio');
  const [anexoSimples, setAnexoSimples] = useState<AnexoSimples>('anexo1');
  const [atividadeLP, setAtividadeLP] = useState('comercio');
  
  // Campos para ICMS/ISS/IPI (alíquota cheia)
  const [icmsAliquota, setIcmsAliquota] = useState('18');
  const [issAliquota, setIssAliquota] = useState('5');
  const [ipiAliquota, setIpiAliquota] = useState('5');
  
  const [resultados, setResultados] = useState<ResultadoComparativo[]>([]);
  const [resultadosPorAno, setResultadosPorAno] = useState<ResultadoPorAno[]>([]);
  const [melhorOpcao, setMelhorOpcao] = useState<string | null>(null);
  const [mostrarTransicao, setMostrarTransicao] = useState(false);
  const [dadosImportadosAplicados, setDadosImportadosAplicados] = useState(false);

  const aliquotas = PERIODO_TRANSICAO[anoSelecionado] || PERIODO_TRANSICAO[2033];

  // Efeito para aplicar dados importados
  useEffect(() => {
    if (dadosImportados && !dadosImportadosAplicados) {
      // Aplicar os dados importados
      setReceitaAnual(formatarMoeda(dadosImportados.receitaAnual.toString()));
      setFolhaPagamento(formatarMoeda(dadosImportados.folhaPagamento.toString()));
      
      if (dadosImportados.tipoAtividade) {
        setTipoAtividade(dadosImportados.tipoAtividade);
      }
      
      if (dadosImportados.anexoSimples) {
        setAnexoSimples(dadosImportados.anexoSimples);
      }
      
      if (dadosImportados.atividadeLP) {
        setAtividadeLP(dadosImportados.atividadeLP);
      }
      
      if (dadosImportados.icmsAliquota !== undefined) {
        setIcmsAliquota(dadosImportados.icmsAliquota.toString());
      }
      
      if (dadosImportados.issAliquota !== undefined) {
        setIssAliquota(dadosImportados.issAliquota.toString());
      }
      
      if (dadosImportados.ipiAliquota !== undefined) {
        setIpiAliquota(dadosImportados.ipiAliquota.toString());
      }

      setDadosImportadosAplicados(true);
      
      // Notificar que os dados foram consumidos
      if (onDadosConsumidos) {
        onDadosConsumidos();
      }

      toast({
        title: `Dados importados do ${dadosImportados.origem === 'simples' ? 'Simples Nacional' : 'Lucro Presumido'}`,
        description: 'Os campos foram preenchidos automaticamente. Clique em "Comparar Regimes" para calcular.',
      });
    }
  }, [dadosImportados, dadosImportadosAplicados, onDadosConsumidos]);

  // Resetar flag quando dadosImportados mudar
  useEffect(() => {
    if (!dadosImportados) {
      setDadosImportadosAplicados(false);
    }
  }, [dadosImportados]);

  // A partir de 2027 não há mais PIS, COFINS e IPI
  const temPisCofins = (ano: number) => ano < 2027;
  const temIPI = (ano: number) => ano < 2027;

  const calcularSimplesNacional = (receitaAnual: number, folha: number, ano: number): ResultadoComparativo => {
    const observacoes: string[] = [];
    const aliquotasAno = PERIODO_TRANSICAO[ano] || PERIODO_TRANSICAO[2033];
    
    // Verificar limite do Simples
    if (receitaAnual > 4800000) {
      return {
        regime: 'Simples Nacional',
        receitaAnual,
        impostos: { irpj: 0, adicionalIRPJ: 0, csll: 0, pis: 0, cofins: 0, ibs: 0, cbs: 0, cpp: 0, das: 0 },
        totalTributos: 0,
        cargaEfetiva: 0,
        observacoes: ['❌ Receita excede limite do Simples Nacional (R$ 4.800.000/ano)']
      };
    }

    // Definir anexo conforme tipo de atividade
    let anexoEfetivo = anexoSimples;
    
    // Calcular Fator R para Anexo V
    if (anexoSimples === 'anexo5' && folha > 0) {
      const fatorR = folha / receitaAnual;
      if (fatorR >= 0.28) {
        anexoEfetivo = 'anexo3';
        observacoes.push(`Fator R: ${(fatorR * 100).toFixed(2)}% → Anexo III`);
      } else {
        observacoes.push(`Fator R: ${(fatorR * 100).toFixed(2)}% → Permanece Anexo V`);
      }
    }

    const usarReforma = ano >= 2027;
    const aliquotaEfetiva = calcularAliquotaSimples(receitaAnual, anexoEfetivo, usarReforma);
    
    const dasAnual = receitaAnual * (aliquotaEfetiva / 100);
    
    let ibs = 0;
    let cbs = 0;
    if (usarReforma) {
      ibs = receitaAnual * (aliquotasAno.ibs / 100);
      cbs = receitaAnual * (aliquotasAno.cbs / 100);
      observacoes.push(`Tabela LC 214/2025 + IBS/CBS por fora`);
    } else {
      observacoes.push(`Tabela Lei 123/06 (tributos incluídos no DAS)`);
    }

    // Anexo IV: calcular INSS Patronal e Sistema S (sobre folha)
    let inssPatronal = 0;
    let sistemaS = 0;
    if (anexoEfetivo === 'anexo4' && folha > 0) {
      inssPatronal = folha * 0.20; // 20% sobre folha
      sistemaS = folha * 0.058; // 5,8% sobre folha (CORRIGIDO)
      observacoes.push(`Anexo IV: INSS Patronal e Sistema S separados`);
    }

    const totalTributos = dasAnual + ibs + cbs + inssPatronal + sistemaS;

    return {
      regime: 'Simples Nacional',
      receitaAnual,
      impostos: {
        irpj: 0,
        adicionalIRPJ: 0,
        csll: 0,
        pis: 0,
        cofins: 0,
        ibs,
        cbs,
        cpp: 0,
        inssPatronal,
        sistemaS,
        das: dasAnual
      },
      totalTributos,
      cargaEfetiva: (totalTributos / receitaAnual) * 100,
      observacoes
    };
  };

  const calcularLucroPresumido = (receitaAnual: number, folha: number, ano: number): ResultadoComparativo => {
    const observacoes: string[] = [];
    const aliquotasAno = PERIODO_TRANSICAO[ano] || PERIODO_TRANSICAO[2033];
    
    const config = ATIVIDADES_LUCRO_PRESUMIDO.find(a => a.id === atividadeLP) || ATIVIDADES_LUCRO_PRESUMIDO[0];
    
    // Base de cálculo trimestral
    const receitaTrimestral = receitaAnual / 4;
    const baseIRPJ = receitaTrimestral * (config.presuncaoIRPJ / 100);
    const baseCSLL = receitaTrimestral * (config.presuncaoCSLL / 100);

    // IRPJ: 15% + Adicional 10% sobre excedente de R$ 60.000/trimestre
    const irpjTrimestre = baseIRPJ * 0.15;
    const limiteAdicional = 60000;
    const adicionalTrimestre = baseIRPJ > limiteAdicional ? (baseIRPJ - limiteAdicional) * 0.10 : 0;

    // CSLL: 9%
    const csllTrimestre = baseCSLL * 0.09;

    // Valores anuais
    const irpj = irpjTrimestre * 4;
    const adicionalIRPJ = adicionalTrimestre * 4;
    const csll = csllTrimestre * 4;

    // PIS: 0.65% e COFINS: 3% (cumulativo) - apenas até 2026
    const pis = temPisCofins(ano) ? receitaAnual * 0.0065 : 0;
    const cofins = temPisCofins(ano) ? receitaAnual * 0.03 : 0;

    // IBS e CBS conforme ano de transição
    const ibs = receitaAnual * (aliquotasAno.ibs / 100);
    const cbs = receitaAnual * (aliquotasAno.cbs / 100);

    // ICMS (proporcional ao ano de transição)
    const icmsAliquotaCheia = parseFloat(icmsAliquota) || 0;
    const icms = tipoAtividade !== 'servicos' && icmsAliquotaCheia > 0
      ? receitaAnual * (icmsAliquotaCheia / 100) * (aliquotasAno.icms / 100)
      : 0;

    // IPI (apenas indústria e até 2026)
    const ipiAliquotaNum = parseFloat(ipiAliquota) || 0;
    const ipi = temIPI(ano) && tipoAtividade === 'industria' && ipiAliquotaNum > 0
      ? receitaAnual * (ipiAliquotaNum / 100)
      : 0;

    // ISS (proporcional ao ano de transição)
    const issAliquotaCheia = parseFloat(issAliquota) || 0;
    const iss = tipoAtividade === 'servicos' && issAliquotaCheia > 0
      ? receitaAnual * (issAliquotaCheia / 100) * (aliquotasAno.iss / 100)
      : 0;

    // INSS Patronal (20% sobre folha) + Sistema S (5,8% sobre folha)
    const inssPatronal = folha * 0.20;
    const sistemaS = folha * 0.058; // CORRIGIDO: sobre folha

    observacoes.push(`Presunção IRPJ: ${config.presuncaoIRPJ}% | CSLL: ${config.presuncaoCSLL}%`);
    if (temPisCofins(ano)) {
      observacoes.push(`PIS/COFINS cumulativo (0,65% + 3%)`);
    } else {
      observacoes.push(`Sem PIS/COFINS (extintos em 2027)`);
    }
    observacoes.push(`INSS Patronal 20% + Sistema S 5,8% (s/ folha)`);
    if (adicionalIRPJ > 0) {
      observacoes.push(`Adicional IRPJ incidente`);
    }

    const totalTributos = irpj + adicionalIRPJ + csll + pis + cofins + ibs + cbs + icms + ipi + iss + inssPatronal + sistemaS;

    return {
      regime: 'Lucro Presumido',
      receitaAnual,
      impostos: {
        irpj,
        adicionalIRPJ,
        csll,
        pis,
        cofins,
        ibs,
        cbs,
        cpp: 0,
        inssPatronal,
        sistemaS,
        icms,
        ipi,
        iss
      },
      totalTributos,
      cargaEfetiva: (totalTributos / receitaAnual) * 100,
      observacoes
    };
  };

  const calcularLucroReal = (receitaAnual: number, folha: number, ano: number): ResultadoComparativo => {
    const observacoes: string[] = [];
    const aliquotasAno = PERIODO_TRANSICAO[ano] || PERIODO_TRANSICAO[2033];
    
    // Estimativa de margem de lucro por tipo de atividade
    let margemLucro = 0.10; // 10% padrão
    if (tipoAtividade === 'comercio') margemLucro = 0.08;
    if (tipoAtividade === 'servicos') margemLucro = 0.20;
    if (tipoAtividade === 'industria') margemLucro = 0.12;

    const lucroEstimado = receitaAnual * margemLucro;
    const custosMercadorias = receitaAnual * 0.60; // 60% de custos (estimativa)

    // IRPJ: 15% sobre lucro real + Adicional 10% sobre excedente R$ 240.000/ano
    const irpj = lucroEstimado * 0.15;
    const adicionalIRPJ = lucroEstimado > 240000 ? (lucroEstimado - 240000) * 0.10 : 0;

    // CSLL: 9% sobre lucro real
    const csll = lucroEstimado * 0.09;

    // PIS: 1.65% e COFINS: 7.6% (não-cumulativo) - com créditos - apenas até 2026
    let pis = 0;
    let cofins = 0;
    if (temPisCofins(ano)) {
      const pisDebito = receitaAnual * 0.0165;
      const cofinsDebito = receitaAnual * 0.076;
      const pisCredito = custosMercadorias * 0.0165;
      const cofinsCredito = custosMercadorias * 0.076;
      pis = Math.max(0, pisDebito - pisCredito);
      cofins = Math.max(0, cofinsDebito - cofinsCredito);
    }

    // IBS e CBS conforme ano de transição
    const ibs = receitaAnual * (aliquotasAno.ibs / 100);
    const cbs = receitaAnual * (aliquotasAno.cbs / 100);

    // ICMS (proporcional ao ano de transição)
    const icmsAliquotaCheia = parseFloat(icmsAliquota) || 0;
    const icms = tipoAtividade !== 'servicos' && icmsAliquotaCheia > 0
      ? receitaAnual * (icmsAliquotaCheia / 100) * (aliquotasAno.icms / 100)
      : 0;

    // IPI (apenas indústria e até 2026)
    const ipiAliquotaNum = parseFloat(ipiAliquota) || 0;
    const ipi = temIPI(ano) && tipoAtividade === 'industria' && ipiAliquotaNum > 0
      ? receitaAnual * (ipiAliquotaNum / 100)
      : 0;

    // ISS (proporcional ao ano de transição)
    const issAliquotaCheia = parseFloat(issAliquota) || 0;
    const iss = tipoAtividade === 'servicos' && issAliquotaCheia > 0
      ? receitaAnual * (issAliquotaCheia / 100) * (aliquotasAno.iss / 100)
      : 0;

    // INSS Patronal (20% sobre folha) + Sistema S (5,8% sobre folha)
    const inssPatronal = folha * 0.20;
    const sistemaS = folha * 0.058; // CORRIGIDO: sobre folha

    observacoes.push(`Margem estimada: ${(margemLucro * 100).toFixed(0)}%`);
    if (temPisCofins(ano)) {
      observacoes.push(`PIS/COFINS não-cumulativo com créditos`);
    } else {
      observacoes.push(`Sem PIS/COFINS (extintos em 2027)`);
    }
    observacoes.push(`INSS Patronal 20% + Sistema S 5,8% (s/ folha)`);
    observacoes.push(`Requer escrituração contábil completa`);

    const totalTributos = irpj + adicionalIRPJ + csll + pis + cofins + ibs + cbs + icms + ipi + iss + inssPatronal + sistemaS;

    return {
      regime: 'Lucro Real',
      receitaAnual,
      impostos: {
        irpj,
        adicionalIRPJ,
        csll,
        pis,
        cofins,
        ibs,
        cbs,
        cpp: 0,
        inssPatronal,
        sistemaS,
        icms,
        ipi,
        iss
      },
      totalTributos,
      cargaEfetiva: (totalTributos / receitaAnual) * 100,
      observacoes
    };
  };

  const calcular = () => {
    const receita = extrairValor(receitaAnual);
    const folha = extrairValor(folhaPagamento);

    if (receita <= 0) {
      toast({ title: 'Informe a receita bruta anual', variant: 'destructive' });
      return;
    }

    // Cálculo para o ano selecionado
    const resultadoSimples = calcularSimplesNacional(receita, folha, anoSelecionado);
    const resultadoPresumido = calcularLucroPresumido(receita, folha, anoSelecionado);
    const resultadoReal = calcularLucroReal(receita, folha, anoSelecionado);

    const todosResultados = [resultadoSimples, resultadoPresumido, resultadoReal];
    
    // Encontrar melhor opção (menor carga tributária)
    const resultadosValidos = todosResultados.filter(r => r.cargaEfetiva > 0);
    if (resultadosValidos.length > 0) {
      const melhor = resultadosValidos.reduce((prev, curr) => 
        prev.cargaEfetiva < curr.cargaEfetiva ? prev : curr
      );
      setMelhorOpcao(melhor.regime);
    } else {
      setMelhorOpcao(null);
    }

    setResultados(todosResultados);

    // Cálculo para todos os anos de transição
    if (mostrarTransicao) {
      const resultadosAnos: ResultadoPorAno[] = [];
      const anos = Object.keys(PERIODO_TRANSICAO).map(Number).sort((a, b) => a - b);
      
      for (const ano of anos) {
        const simples = calcularSimplesNacional(receita, folha, ano);
        const presumido = calcularLucroPresumido(receita, folha, ano);
        const real = calcularLucroReal(receita, folha, ano);

        const validos = [simples, presumido, real].filter(r => r.cargaEfetiva > 0);
        const melhor = validos.length > 0 
          ? validos.reduce((p, c) => p.cargaEfetiva < c.cargaEfetiva ? p : c).regime
          : '-';

        resultadosAnos.push({
          ano,
          fase: PERIODO_TRANSICAO[ano].fase,
          simples,
          presumido,
          real,
          melhorOpcao: melhor
        });
      }

      setResultadosPorAno(resultadosAnos);
    }

    toast({ title: 'Comparativo calculado com sucesso!' });
  };

  const limpar = () => {
    setReceitaAnual('');
    setFolhaPagamento('');
    setResultados([]);
    setResultadosPorAno([]);
    setMelhorOpcao(null);
  };

  const exportarExcel = () => {
    if (resultados.length === 0) {
      toast({ title: 'Realize um cálculo primeiro', variant: 'destructive' });
      return;
    }

    const wb = XLSX.utils.book_new();

    // Aba principal
    const dados = resultados.map(r => ({
      'Regime': r.regime,
      'Receita Anual': r.receitaAnual,
      'DAS (Simples)': r.impostos.das || 0,
      'IRPJ': r.impostos.irpj,
      'Adicional IRPJ': r.impostos.adicionalIRPJ,
      'CSLL': r.impostos.csll,
      'PIS': r.impostos.pis,
      'COFINS': r.impostos.cofins,
      'IBS': r.impostos.ibs,
      'CBS': r.impostos.cbs,
      'ICMS': r.impostos.icms || 0,
      'IPI': r.impostos.ipi || 0,
      'ISS': r.impostos.iss || 0,
      'INSS Patronal': r.impostos.inssPatronal || 0,
      'Sistema S': r.impostos.sistemaS || 0,
      'Total Tributos': r.totalTributos,
      'Carga Efetiva (%)': r.cargaEfetiva.toFixed(2),
      'Melhor Opção': r.regime === melhorOpcao ? 'SIM' : 'NÃO'
    }));

    const ws = XLSX.utils.json_to_sheet(dados);
    XLSX.utils.book_append_sheet(wb, ws, `Comparativo ${anoSelecionado}`);

    // Aba de transição por ano
    if (resultadosPorAno.length > 0) {
      const dadosTransicao = resultadosPorAno.map(r => ({
        'Ano': r.ano,
        'Fase': r.fase,
        'Simples - Total': r.simples.totalTributos,
        'Simples - Carga (%)': r.simples.cargaEfetiva.toFixed(2),
        'Presumido - Total': r.presumido.totalTributos,
        'Presumido - Carga (%)': r.presumido.cargaEfetiva.toFixed(2),
        'Real - Total': r.real.totalTributos,
        'Real - Carga (%)': r.real.cargaEfetiva.toFixed(2),
        'Melhor Opção': r.melhorOpcao
      }));

      const wsTransicao = XLSX.utils.json_to_sheet(dadosTransicao);
      XLSX.utils.book_append_sheet(wb, wsTransicao, 'Transição por Ano');
    }

    XLSX.writeFile(wb, `comparativo_regimes_${anoSelecionado}.xlsx`);
    toast({ title: 'Excel exportado com sucesso!' });
  };

  const adicionarAoRelatorio = () => {
    if (!onAdicionarAoRelatorio || resultados.length === 0) {
      toast({ title: 'Realize um cálculo primeiro', variant: 'destructive' });
      return;
    }

    onAdicionarAoRelatorio({
      tipo: 'comparativo',
      titulo: `Comparativo de Regimes - ${anoSelecionado}`,
      dados: {
        resultadoSelecionado: {
          simples: resultados.find(r => r.regime === 'Simples Nacional'),
          presumido: resultados.find(r => r.regime === 'Lucro Presumido'),
          real: resultados.find(r => r.regime === 'Lucro Real')
        },
        resultadosPorAno: resultadosPorAno.reduce((acc, r) => {
          acc[r.ano] = r;
          return acc;
        }, {} as Record<number, any>),
        melhorOpcao
      },
      dataHora: new Date().toLocaleString('pt-BR')
    });

    toast({ title: 'Dados adicionados ao relatório!' });
  };

  const exportarPDF = () => {
    if (resultados.length === 0) {
      toast({ title: 'Realize um cálculo primeiro', variant: 'destructive' });
      return;
    }

    const printContent = `
      <html>
        <head>
          <title>Comparativo de Regimes Tributários - ${anoSelecionado}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; max-width: 1000px; margin: 0 auto; }
            h1 { color: #333; border-bottom: 2px solid #8b5cf6; padding-bottom: 10px; }
            h2 { color: #555; margin-top: 30px; }
            .info { background: #f3f4f6; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 0.9em; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: right; }
            th { background-color: #f5f5f5; font-weight: bold; }
            td:first-child, th:first-child { text-align: left; }
            .melhor { background: #d1fae5 !important; font-weight: bold; }
            .regime-card { border: 2px solid #ddd; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
            .regime-card.melhor { border-color: #10b981; background: #ecfdf5; }
            .regime-card h3 { margin-top: 0; display: flex; align-items: center; gap: 10px; }
            .regime-card.melhor h3::after { content: '✓ MELHOR OPÇÃO'; background: #10b981; color: white; padding: 4px 12px; border-radius: 4px; font-size: 0.8em; }
            .carga { font-size: 2em; font-weight: bold; color: #8b5cf6; }
            .total { font-size: 1.3em; color: #333; }
            .obs { font-size: 0.85em; color: #666; margin-top: 10px; }
            .footer { margin-top: 40px; font-size: 0.8em; color: #888; text-align: center; }
            .transicao { margin-top: 30px; }
            .alerta { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 10px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <h1>Comparativo de Regimes Tributários - ${anoSelecionado}</h1>
          
          ${anoSelecionado >= 2027 ? `
          <div class="alerta">
            <strong>LC 214/2025:</strong> A partir de 2027, não há mais PIS, COFINS e IPI. 
            Esses tributos foram substituídos pelo CBS e IBS.
          </div>
          ` : ''}
          
          <div class="info">
            <strong>Receita Anual:</strong> ${formatarValorBRL(extrairValor(receitaAnual))} |
            <strong>Folha de Pagamento:</strong> ${formatarValorBRL(extrairValor(folhaPagamento))} |
            <strong>Tipo de Atividade:</strong> ${tipoAtividade.charAt(0).toUpperCase() + tipoAtividade.slice(1)}<br>
            <strong>ICMS:</strong> ${icmsAliquota}% | <strong>ISS:</strong> ${issAliquota}% | <strong>IPI:</strong> ${ipiAliquota}%
          </div>

          ${resultados.map(r => `
            <div class="regime-card ${r.regime === melhorOpcao ? 'melhor' : ''}">
              <h3>${r.regime}</h3>
              <div class="carga">${r.cargaEfetiva.toFixed(2)}%</div>
              <div class="total">Total Anual: ${formatarValorBRL(r.totalTributos)}</div>
              ${r.observacoes.length > 0 ? `
                <div class="obs">${r.observacoes.join(' | ')}</div>
              ` : ''}
            </div>
          `).join('')}

          <h2>Detalhamento</h2>
          <table>
            <tr>
              <th>Tributo</th>
              ${resultados.map(r => `<th>${r.regime}</th>`).join('')}
            </tr>
            <tr>
              <td>DAS (Simples)</td>
              ${resultados.map(r => `<td>${r.impostos.das ? formatarValorBRL(r.impostos.das) : '-'}</td>`).join('')}
            </tr>
            <tr>
              <td>IRPJ</td>
              ${resultados.map(r => `<td>${formatarValorBRL(r.impostos.irpj)}</td>`).join('')}
            </tr>
            <tr>
              <td>Adicional IRPJ</td>
              ${resultados.map(r => `<td>${formatarValorBRL(r.impostos.adicionalIRPJ)}</td>`).join('')}
            </tr>
            <tr>
              <td>CSLL</td>
              ${resultados.map(r => `<td>${formatarValorBRL(r.impostos.csll)}</td>`).join('')}
            </tr>
            ${temPisCofins(anoSelecionado) ? `
            <tr>
              <td>PIS</td>
              ${resultados.map(r => `<td>${formatarValorBRL(r.impostos.pis)}</td>`).join('')}
            </tr>
            <tr>
              <td>COFINS</td>
              ${resultados.map(r => `<td>${formatarValorBRL(r.impostos.cofins)}</td>`).join('')}
            </tr>
            ` : ''}
            <tr>
              <td>IBS</td>
              ${resultados.map(r => `<td>${formatarValorBRL(r.impostos.ibs)}</td>`).join('')}
            </tr>
            <tr>
              <td>CBS</td>
              ${resultados.map(r => `<td>${formatarValorBRL(r.impostos.cbs)}</td>`).join('')}
            </tr>
            <tr>
              <td>ICMS (proporcional)</td>
              ${resultados.map(r => `<td>${formatarValorBRL(r.impostos.icms || 0)}</td>`).join('')}
            </tr>
            ${temIPI(anoSelecionado) ? `
            <tr>
              <td>IPI</td>
              ${resultados.map(r => `<td>${formatarValorBRL(r.impostos.ipi || 0)}</td>`).join('')}
            </tr>
            ` : ''}
            <tr>
              <td>ISS (proporcional)</td>
              ${resultados.map(r => `<td>${formatarValorBRL(r.impostos.iss || 0)}</td>`).join('')}
            </tr>
            <tr>
              <td>INSS Patronal (20% s/ folha)</td>
              ${resultados.map(r => `<td>${formatarValorBRL(r.impostos.inssPatronal || 0)}</td>`).join('')}
            </tr>
            <tr>
              <td>Sistema S (5,8% s/ folha)</td>
              ${resultados.map(r => `<td>${formatarValorBRL(r.impostos.sistemaS || 0)}</td>`).join('')}
            </tr>
            <tr class="${melhorOpcao ? '' : ''}">
              <td><strong>TOTAL</strong></td>
              ${resultados.map(r => `<td class="${r.regime === melhorOpcao ? 'melhor' : ''}"><strong>${formatarValorBRL(r.totalTributos)}</strong></td>`).join('')}
            </tr>
            <tr>
              <td><strong>Carga Efetiva</strong></td>
              ${resultados.map(r => `<td class="${r.regime === melhorOpcao ? 'melhor' : ''}"><strong>${r.cargaEfetiva.toFixed(2)}%</strong></td>`).join('')}
            </tr>
          </table>

          ${resultadosPorAno.length > 0 ? `
            <div class="transicao">
              <h2>Evolução por Ano de Transição</h2>
              <table>
                <tr>
                  <th>Ano</th>
                  <th>Fase</th>
                  <th>Simples</th>
                  <th>Presumido</th>
                  <th>Real</th>
                  <th>Melhor</th>
                </tr>
                ${resultadosPorAno.map(r => `
                  <tr>
                    <td>${r.ano}</td>
                    <td>${r.fase}</td>
                    <td>${formatarValorBRL(r.simples.totalTributos)} (${r.simples.cargaEfetiva.toFixed(2)}%)</td>
                    <td>${formatarValorBRL(r.presumido.totalTributos)} (${r.presumido.cargaEfetiva.toFixed(2)}%)</td>
                    <td>${formatarValorBRL(r.real.totalTributos)} (${r.real.cargaEfetiva.toFixed(2)}%)</td>
                    <td class="melhor">${r.melhorOpcao}</td>
                  </tr>
                `).join('')}
              </table>
            </div>
          ` : ''}

          <div class="footer">
            Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}<br>
            <small>* Valores estimados para fins de planejamento tributário. Consulte um contador para análise detalhada.</small>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="space-y-6">
      {/* Alerta para anos >= 2027 */}
      {anoSelecionado >= 2027 && (
        <Alert className="border-blue-500/50 bg-blue-500/10">
          <AlertCircle className="h-4 w-4 text-blue-500" />
          <AlertDescription>
            <strong>LC 214/2025:</strong> A partir de 2027, não há mais PIS, COFINS e IPI. 
            Esses tributos foram substituídos pelo CBS e IBS.
          </AlertDescription>
        </Alert>
      )}

      {/* Alerta de dados importados */}
      {dadosImportadosAplicados && (
        <Alert className="border-emerald-500/50 bg-emerald-500/10">
          <ArrowDownToLine className="h-4 w-4 text-emerald-500" />
          <AlertDescription>
            <strong>Dados importados com sucesso!</strong> Os campos foram preenchidos automaticamente. 
            Clique em "Comparar Regimes" para calcular e comparar os diferentes regimes tributários.
          </AlertDescription>
        </Alert>
      )}

      {/* Entrada de Dados */}
      <Card className="border-purple-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Scale className="h-5 w-5 text-purple-500" />
            Dados para Comparativo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Receita Bruta Anual (R$)</Label>
              <Input
                value={receitaAnual}
                onChange={(e) => setReceitaAnual(formatarMoeda(e.target.value))}
                placeholder="0,00"
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <Label>Folha de Pagamento Anual (R$)</Label>
              <Input
                value={folhaPagamento}
                onChange={(e) => setFolhaPagamento(formatarMoeda(e.target.value))}
                placeholder="0,00"
                className="mt-1 font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">Para Fator R, INSS Patronal e Sistema S</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Tipo de Atividade</Label>
              <Select value={tipoAtividade} onValueChange={(v) => setTipoAtividade(v as 'comercio' | 'servicos' | 'industria')}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="comercio">Comércio</SelectItem>
                  <SelectItem value="servicos">Serviços</SelectItem>
                  <SelectItem value="industria">Indústria</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Anexo Simples Nacional</Label>
              <Select value={anexoSimples} onValueChange={(v) => setAnexoSimples(v as AnexoSimples)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="anexo1">Anexo I - Comércio</SelectItem>
                  <SelectItem value="anexo2">Anexo II - Indústria</SelectItem>
                  <SelectItem value="anexo3">Anexo III - Serviços</SelectItem>
                  <SelectItem value="anexo4">Anexo IV - Serviços (CPP separado)</SelectItem>
                  <SelectItem value="anexo5">Anexo V - Serviços</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Atividade Lucro Presumido</Label>
              <Select value={atividadeLP} onValueChange={setAtividadeLP}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ATIVIDADES_LUCRO_PRESUMIDO.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nome} ({a.presuncaoIRPJ}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Campos ICMS/ISS/IPI */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
            <div>
              <Label className="text-xs">ICMS Alíq. Cheia (%)</Label>
              <Input
                value={icmsAliquota}
                onChange={(e) => setIcmsAliquota(e.target.value)}
                placeholder="18"
                className="mt-1 font-mono"
                disabled={tipoAtividade === 'servicos'}
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Proporcional {anoSelecionado}: {((parseFloat(icmsAliquota) || 0) * (aliquotas.icms / 100)).toFixed(2)}%
              </p>
            </div>
            <div>
              <Label className="text-xs">ISS Alíq. Cheia (%)</Label>
              <Input
                value={issAliquota}
                onChange={(e) => setIssAliquota(e.target.value)}
                placeholder="5"
                className="mt-1 font-mono"
                disabled={tipoAtividade !== 'servicos'}
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Proporcional {anoSelecionado}: {((parseFloat(issAliquota) || 0) * (aliquotas.iss / 100)).toFixed(2)}%
              </p>
            </div>
            <div>
              <Label className="text-xs">IPI Alíquota (%)</Label>
              <Input
                value={ipiAliquota}
                onChange={(e) => setIpiAliquota(e.target.value)}
                placeholder="5"
                className="mt-1 font-mono"
                disabled={tipoAtividade !== 'industria' || !temIPI(anoSelecionado)}
              />
              {!temIPI(anoSelecionado) && (
                <p className="text-[10px] text-amber-500 mt-0.5">IPI extinto a partir de 2027</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Switch
              checked={mostrarTransicao}
              onCheckedChange={setMostrarTransicao}
            />
            <div>
              <Label className="cursor-pointer">Mostrar evolução por ano de transição (2026-2033)</Label>
              <p className="text-xs text-muted-foreground">
                Calcular totais de impostos para cada ano do período de transição
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button onClick={calcular} className="gap-2">
              <Calculator className="h-4 w-4" />
              Comparar Regimes
            </Button>
            {resultados.length > 0 && (
              <>
                <Button variant="outline" onClick={exportarExcel} className="gap-2">
                  <Download className="h-4 w-4" />
                  Exportar Excel
                </Button>
                <Button variant="outline" onClick={exportarPDF} className="gap-2">
                  <FileText className="h-4 w-4" />
                  Exportar PDF
                </Button>
                {onAdicionarAoRelatorio && (
                  <Button variant="outline" onClick={adicionarAoRelatorio} className="gap-2 border-emerald-500/50 text-emerald-600 hover:bg-emerald-500/10">
                    <Plus className="h-4 w-4" />
                    Adicionar ao Relatório
                  </Button>
                )}
              </>
            )}
            <Button variant="outline" onClick={limpar}>
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resultados - Cards de Comparação */}
      {resultados.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {resultados.map((r, idx) => (
              <Card 
                key={idx} 
                className={`${r.regime === melhorOpcao ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-muted'}`}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between">
                    <span className="text-base">{r.regime}</span>
                    {r.regime === melhorOpcao && (
                      <Badge className="bg-emerald-500 text-white gap-1">
                        <Award className="h-3 w-3" />
                        Melhor Opção
                      </Badge>
                    )}
                    {r.cargaEfetiva === 0 && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Inelegível
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-center py-4 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Carga Tributária</p>
                    <p className={`text-3xl font-bold ${r.regime === melhorOpcao ? 'text-emerald-500' : 'text-primary'}`}>
                      {r.cargaEfetiva.toFixed(2)}%
                    </p>
                  </div>
                  
                  <div className="text-center p-3 border rounded-lg">
                    <p className="text-xs text-muted-foreground">Total Tributos/Ano</p>
                    <p className="text-xl font-bold">{formatarValorBRL(r.totalTributos)}</p>
                  </div>

                  {r.observacoes.length > 0 && (
                    <div className="text-xs text-muted-foreground space-y-1">
                      {r.observacoes.map((obs, i) => (
                        <p key={i}>• {obs}</p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Economia Potencial */}
          {melhorOpcao && resultados.filter(r => r.cargaEfetiva > 0).length > 1 && (
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <TrendingUp className="h-8 w-8 text-emerald-500" />
                  <div className="flex-1">
                    <p className="font-medium">Economia Potencial ao escolher {melhorOpcao}</p>
                    <p className="text-sm text-muted-foreground">
                      Comparado com a opção mais onerosa
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-emerald-500">
                      {formatarValorBRL(
                        Math.max(...resultados.filter(r => r.cargaEfetiva > 0).map(r => r.totalTributos)) -
                        Math.min(...resultados.filter(r => r.cargaEfetiva > 0).map(r => r.totalTributos))
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">por ano</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabela Detalhada */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Detalhamento por Tributo - {anoSelecionado}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tributo</TableHead>
                      {resultados.map((r, idx) => (
                        <TableHead key={idx} className="text-right">
                          {r.regime}
                          {r.regime === melhorOpcao && ' ⭐'}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>DAS (Simples)</TableCell>
                      {resultados.map((r, idx) => (
                        <TableCell key={idx} className="text-right font-mono">
                          {r.impostos.das ? formatarValorBRL(r.impostos.das) : '-'}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell>IRPJ</TableCell>
                      {resultados.map((r, idx) => (
                        <TableCell key={idx} className="text-right font-mono">
                          {formatarValorBRL(r.impostos.irpj)}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell>Adicional IRPJ</TableCell>
                      {resultados.map((r, idx) => (
                        <TableCell key={idx} className="text-right font-mono">
                          {formatarValorBRL(r.impostos.adicionalIRPJ)}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell>CSLL</TableCell>
                      {resultados.map((r, idx) => (
                        <TableCell key={idx} className="text-right font-mono">
                          {formatarValorBRL(r.impostos.csll)}
                        </TableCell>
                      ))}
                    </TableRow>
                    {temPisCofins(anoSelecionado) && (
                      <>
                        <TableRow>
                          <TableCell>PIS</TableCell>
                          {resultados.map((r, idx) => (
                            <TableCell key={idx} className="text-right font-mono">
                              {formatarValorBRL(r.impostos.pis)}
                            </TableCell>
                          ))}
                        </TableRow>
                        <TableRow>
                          <TableCell>COFINS</TableCell>
                          {resultados.map((r, idx) => (
                            <TableCell key={idx} className="text-right font-mono">
                              {formatarValorBRL(r.impostos.cofins)}
                            </TableCell>
                          ))}
                        </TableRow>
                      </>
                    )}
                    <TableRow>
                      <TableCell>IBS</TableCell>
                      {resultados.map((r, idx) => (
                        <TableCell key={idx} className="text-right font-mono text-blue-500">
                          {formatarValorBRL(r.impostos.ibs)}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell>CBS</TableCell>
                      {resultados.map((r, idx) => (
                        <TableCell key={idx} className="text-right font-mono text-emerald-500">
                          {formatarValorBRL(r.impostos.cbs)}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell>ICMS (proporcional)</TableCell>
                      {resultados.map((r, idx) => (
                        <TableCell key={idx} className="text-right font-mono text-orange-500">
                          {formatarValorBRL(r.impostos.icms || 0)}
                        </TableCell>
                      ))}
                    </TableRow>
                    {temIPI(anoSelecionado) && (
                      <TableRow>
                        <TableCell>IPI</TableCell>
                        {resultados.map((r, idx) => (
                          <TableCell key={idx} className="text-right font-mono">
                            {formatarValorBRL(r.impostos.ipi || 0)}
                          </TableCell>
                        ))}
                      </TableRow>
                    )}
                    <TableRow>
                      <TableCell>ISS (proporcional)</TableCell>
                      {resultados.map((r, idx) => (
                        <TableCell key={idx} className="text-right font-mono text-purple-500">
                          {formatarValorBRL(r.impostos.iss || 0)}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell>INSS Patronal (20% s/ folha)</TableCell>
                      {resultados.map((r, idx) => (
                        <TableCell key={idx} className="text-right font-mono text-orange-500">
                          {formatarValorBRL(r.impostos.inssPatronal || 0)}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell>Sistema S (5,8% s/ folha)</TableCell>
                      {resultados.map((r, idx) => (
                        <TableCell key={idx} className="text-right font-mono text-purple-500">
                          {formatarValorBRL(r.impostos.sistemaS || 0)}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell>TOTAL</TableCell>
                      {resultados.map((r, idx) => (
                        <TableCell 
                          key={idx} 
                          className={`text-right font-mono ${r.regime === melhorOpcao ? 'text-emerald-500' : ''}`}
                        >
                          {formatarValorBRL(r.totalTributos)}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow className="bg-primary/5 font-bold">
                      <TableCell>Carga Efetiva</TableCell>
                      {resultados.map((r, idx) => (
                        <TableCell 
                          key={idx} 
                          className={`text-right ${r.regime === melhorOpcao ? 'text-emerald-500' : ''}`}
                        >
                          {r.cargaEfetiva.toFixed(2)}%
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Gráficos de Transição */}
          {resultadosPorAno.length > 0 && (
            <GraficoTransicao 
              resultadosPorAno={resultadosPorAno} 
              receitaAnual={extrairValor(receitaAnual)} 
            />
          )}

          {/* Tabela de Transição por Ano */}
          {resultadosPorAno.length > 0 && (
            <Card className="border-amber-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-amber-500" />
                  Evolução Tributária por Ano de Transição (2026-2033)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ano</TableHead>
                        <TableHead>Fase</TableHead>
                        <TableHead className="text-right">Simples</TableHead>
                        <TableHead className="text-right">Carga %</TableHead>
                        <TableHead className="text-right">Presumido</TableHead>
                        <TableHead className="text-right">Carga %</TableHead>
                        <TableHead className="text-right">Real</TableHead>
                        <TableHead className="text-right">Carga %</TableHead>
                        <TableHead className="text-center">Melhor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resultadosPorAno.map((r, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-bold">{r.ano}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{r.fase}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatarValorBRL(r.simples.totalTributos)}
                          </TableCell>
                          <TableCell className="text-right">
                            {r.simples.cargaEfetiva.toFixed(2)}%
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatarValorBRL(r.presumido.totalTributos)}
                          </TableCell>
                          <TableCell className="text-right">
                            {r.presumido.cargaEfetiva.toFixed(2)}%
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatarValorBRL(r.real.totalTributos)}
                          </TableCell>
                          <TableCell className="text-right">
                            {r.real.cargaEfetiva.toFixed(2)}%
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-emerald-500">{r.melhorOpcao}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default ComparativoRegimes;
