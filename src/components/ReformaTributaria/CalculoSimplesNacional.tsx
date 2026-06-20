import React, { useState, useEffect, useMemo } from 'react';
import { Calculator, Store, TrendingUp, DollarSign, Users, Download, FileText, Plus, Trash2, AlertCircle, Table as TableIcon, Calendar, ArrowRight, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import type { AnexoSimples } from '@/types/tax';
import { TABELAS_SIMPLES_NACIONAL_ORIGINAL, TABELAS_SIMPLES_NACIONAL_REFORMA, PERIODO_TRANSICAO } from '@/constants/tax-tables';
import { formatarValorBRL, extrairValor, formatarMoeda, calcularAliquotaSimples, obterDistribuicaoFaixa } from '@/utils/tax-calculations';

// Importar tabelas completas do novo arquivo JSON
import tabelasSimples from '@/data/simples-nacional-tabelas.json';

interface DadosRelatorio {
  tipo: 'simples';
  titulo: string;
  dados: any;
  dataHora: string;
}

interface Props {
  anoSelecionado: number;
  onExportarParaComparativo?: (dados: DadosExportacao) => void;
  onAdicionarAoRelatorio?: (dados: DadosRelatorio) => void;
}

interface FaturamentoAnexo {
  anexo: AnexoSimples;
  faturamento: string;
}

interface FaturamentoMensal {
  mes: number;
  nome: string;
  faturamentos: FaturamentoAnexo[];
}

interface ResultadoAnexo {
  anexo: string;
  nomeAnexo: string;
  faturamento: number;
  aliquotaNominal: number;
  aliquotaEfetiva: number;
  valorImposto: number;
  ibs?: number;
  cbs?: number;
  inssPatronal?: number;
  sistemaS?: number;
  totalTributos: number;
}

interface ResultadoMensal {
  mes: number;
  nome: string;
  rbt12: number;
  resultados: ResultadoAnexo[];
  totalMes: number;
}

export interface DadosExportacao {
  regime: 'simples';
  anoSelecionado: number;
  faturamento12Meses: number;
  folhaPagamento: number;
  anexosSelecionados: AnexoSimples[];
  modoCalculo: 'anual' | 'mensal';
}

const MESES = [
  { mes: 1, nome: 'Janeiro' },
  { mes: 2, nome: 'Fevereiro' },
  { mes: 3, nome: 'Março' },
  { mes: 4, nome: 'Abril' },
  { mes: 5, nome: 'Maio' },
  { mes: 6, nome: 'Junho' },
  { mes: 7, nome: 'Julho' },
  { mes: 8, nome: 'Agosto' },
  { mes: 9, nome: 'Setembro' },
  { mes: 10, nome: 'Outubro' },
  { mes: 11, nome: 'Novembro' },
  { mes: 12, nome: 'Dezembro' },
];

const ANEXOS_DISPONIVEIS: { key: AnexoSimples; nome: string }[] = [
  { key: 'anexo1', nome: 'Anexo I - Comércio' },
  { key: 'anexo2', nome: 'Anexo II - Indústria' },
  { key: 'anexo3', nome: 'Anexo III - Serviços' },
  { key: 'anexo4', nome: 'Anexo IV - Serviços (CPP separado)' },
  { key: 'anexo5', nome: 'Anexo V - Serviços (Fator R)' },
];

const CalculoSimplesNacional: React.FC<Props> = ({ anoSelecionado, onExportarParaComparativo, onAdicionarAoRelatorio }) => {
  const [modoCalculo, setModoCalculo] = useState<'anual' | 'mensal'>('anual');
  const [faturamento12Meses, setFaturamento12Meses] = useState('');
  const [folhaPagamento, setFolhaPagamento] = useState('');
  const [anexosSelecionados, setAnexosSelecionados] = useState<AnexoSimples[]>(['anexo1']);
  const [faturamentosPorAnexo, setFaturamentosPorAnexo] = useState<FaturamentoAnexo[]>([]);
  const [faturamentosMensais, setFaturamentosMensais] = useState<FaturamentoMensal[]>([]);
  const [usarReforma, setUsarReforma] = useState(anoSelecionado >= 2027);
  const [resultados, setResultados] = useState<ResultadoAnexo[]>([]);
  const [resultadosMensais, setResultadosMensais] = useState<ResultadoMensal[]>([]);
  const [fatorR, setFatorR] = useState<number | null>(null);

  const aliquotas = PERIODO_TRANSICAO[anoSelecionado] || PERIODO_TRANSICAO[2033];
  const tabelas = usarReforma ? TABELAS_SIMPLES_NACIONAL_REFORMA : TABELAS_SIMPLES_NACIONAL_ORIGINAL;

  // Em 2026, não há cobrança de IBS/CBS por fora
  const podeUsarReforma = anoSelecionado >= 2027;

  // Verifica se Anexo V está selecionado (para mostrar Fator R)
  const temAnexoV = anexosSelecionados.includes('anexo5');
  // Verifica se Anexo IV está selecionado (para INSS Patronal e Sistema S)
  const temAnexoIV = anexosSelecionados.includes('anexo4');

  // Inicializar faturamentos mensais
  useEffect(() => {
    if (modoCalculo === 'mensal' && faturamentosMensais.length === 0) {
      const inicial = MESES.map(m => ({
        mes: m.mes,
        nome: m.nome,
        faturamentos: anexosSelecionados.map(a => ({ anexo: a, faturamento: '' }))
      }));
      setFaturamentosMensais(inicial);
    }
  }, [modoCalculo]);

  // Atualizar faturamentos por anexo quando seleção mudar
  useEffect(() => {
    setFaturamentosPorAnexo(prev => {
      const novos: FaturamentoAnexo[] = [];
      for (const anexo of anexosSelecionados) {
        const existente = prev.find(p => p.anexo === anexo);
        novos.push(existente || { anexo, faturamento: '' });
      }
      return novos;
    });

    // Atualizar também os mensais
    setFaturamentosMensais(prev => prev.map(m => ({
      ...m,
      faturamentos: anexosSelecionados.map(a => {
        const existente = m.faturamentos.find(f => f.anexo === a);
        return existente || { anexo: a, faturamento: '' };
      })
    })));
  }, [anexosSelecionados]);

  // Atualizar usarReforma quando ano mudar
  useEffect(() => {
    if (anoSelecionado >= 2027) {
      setUsarReforma(true);
    } else {
      setUsarReforma(false);
    }
  }, [anoSelecionado]);

  // Calcular RBT12 automaticamente no modo mensal (soma dos últimos 12 meses)
  const rbt12Calculado = useMemo(() => {
    if (modoCalculo !== 'mensal') return 0;
    
    let total = 0;
    for (const mes of faturamentosMensais) {
      for (const fat of mes.faturamentos) {
        total += extrairValor(fat.faturamento);
      }
    }
    return total;
  }, [faturamentosMensais, modoCalculo]);

  const toggleAnexo = (anexo: AnexoSimples) => {
    setAnexosSelecionados(prev => {
      if (prev.includes(anexo)) {
        if (prev.length === 1) return prev;
        return prev.filter(a => a !== anexo);
      } else {
        return [...prev, anexo];
      }
    });
  };

  const atualizarFaturamentoAnexo = (anexo: AnexoSimples, valor: string) => {
    setFaturamentosPorAnexo(prev => 
      prev.map(p => p.anexo === anexo ? { ...p, faturamento: formatarMoeda(valor) } : p)
    );
  };

  const atualizarFaturamentoMensal = (mes: number, anexo: AnexoSimples, valor: string) => {
    setFaturamentosMensais(prev => prev.map(m => 
      m.mes === mes 
        ? { 
            ...m, 
            faturamentos: m.faturamentos.map(f => 
              f.anexo === anexo ? { ...f, faturamento: formatarMoeda(valor) } : f
            )
          }
        : m
    ));
  };

  const calcularPorAnexo = (rbt12: number, receitaMes: number, anexoSelecionado: AnexoSimples, folha: number, fatorRCalculado: number | null): ResultadoAnexo | null => {
    if (receitaMes <= 0) return null;

    // Determinar anexo efetivo (para Anexo V com Fator R)
    let anexoEfetivo = anexoSelecionado;
    if (anexoSelecionado === 'anexo5' && fatorRCalculado !== null && fatorRCalculado >= 0.28) {
      anexoEfetivo = 'anexo3';
    }

    // Em 2026, usar tabela original (não há cobrança de IBS/CBS por fora)
    const usarTabelaReforma = podeUsarReforma && usarReforma;
    const aliquotaEfetiva = calcularAliquotaSimples(rbt12, anexoEfetivo, usarTabelaReforma);
    
    // Obter alíquota nominal da tabela
    const tabelaUsada = usarTabelaReforma ? TABELAS_SIMPLES_NACIONAL_REFORMA : TABELAS_SIMPLES_NACIONAL_ORIGINAL;
    const tabela = tabelaUsada[anexoEfetivo];
    let aliquotaNominal = 0;
    for (const faixa of tabela.faixas) {
      if (rbt12 <= faixa.ate) {
        aliquotaNominal = faixa.aliquota;
        break;
      }
    }

    const valorImposto = receitaMes * (aliquotaEfetiva / 100);

    // Se usar reforma E ano >= 2027, calcular IBS/CBS adicionais
    let ibs = 0;
    let cbs = 0;
    if (usarTabelaReforma && podeUsarReforma) {
      ibs = receitaMes * (aliquotas.ibs / 100);
      cbs = receitaMes * (aliquotas.cbs / 100);
    }

    // Anexo IV: calcular INSS Patronal (20% s/ folha) e Sistema S (5,8% s/ folha)
    let inssPatronal = 0;
    let sistemaS = 0;
    if (anexoEfetivo === 'anexo4' && folha > 0) {
      inssPatronal = folha * 0.20;
      sistemaS = folha * 0.058;
    }

    const totalTributos = valorImposto + ibs + cbs + inssPatronal + sistemaS;

    return {
      anexo: anexoEfetivo,
      nomeAnexo: anexoSelecionado === 'anexo5' && anexoEfetivo === 'anexo3' 
        ? `${tabela.nome} (via Fator R)` 
        : tabela.nome,
      faturamento: receitaMes,
      aliquotaNominal,
      aliquotaEfetiva,
      valorImposto,
      ibs: usarTabelaReforma && podeUsarReforma ? ibs : undefined,
      cbs: usarTabelaReforma && podeUsarReforma ? cbs : undefined,
      inssPatronal: anexoEfetivo === 'anexo4' ? inssPatronal : undefined,
      sistemaS: anexoEfetivo === 'anexo4' ? sistemaS : undefined,
      totalTributos
    };
  };

  const calcularAnual = () => {
    const rbt12 = extrairValor(faturamento12Meses);
    const folha = extrairValor(folhaPagamento);

    if (rbt12 <= 0) {
      toast({ title: 'Informe o faturamento dos últimos 12 meses', variant: 'destructive' });
      return;
    }

    if (rbt12 > 4800000) {
      toast({ title: 'Faturamento excede limite do Simples Nacional (R$ 4.800.000)', variant: 'destructive' });
      return;
    }

    const temFaturamentoAnexo = faturamentosPorAnexo.some(f => extrairValor(f.faturamento) > 0);
    if (!temFaturamentoAnexo) {
      toast({ title: 'Informe o faturamento do mês para ao menos um anexo', variant: 'destructive' });
      return;
    }

    // Calcular Fator R (apenas se Anexo V selecionado)
    let fatorRCalculado: number | null = null;
    if (temAnexoV && folha > 0) {
      fatorRCalculado = (folha * 12) / rbt12;
    }

    const resultadosCalculo: ResultadoAnexo[] = [];

    for (const faturamentoAnexo of faturamentosPorAnexo) {
      const receitaMes = extrairValor(faturamentoAnexo.faturamento);
      const resultado = calcularPorAnexo(rbt12, receitaMes, faturamentoAnexo.anexo, folha, fatorRCalculado);
      if (resultado) {
        resultadosCalculo.push(resultado);
      }
    }

    setResultados(resultadosCalculo);
    setFatorR(fatorRCalculado);
    toast({ title: 'Cálculo realizado com sucesso!' });
  };

  const calcularMensal = () => {
    const folha = extrairValor(folhaPagamento);
    
    if (rbt12Calculado <= 0) {
      toast({ title: 'Informe o faturamento de ao menos um mês', variant: 'destructive' });
      return;
    }

    if (rbt12Calculado > 4800000) {
      toast({ title: 'Faturamento total excede limite do Simples Nacional (R$ 4.800.000)', variant: 'destructive' });
      return;
    }

    // Calcular Fator R anual
    let fatorRCalculado: number | null = null;
    if (temAnexoV && folha > 0) {
      fatorRCalculado = (folha * 12) / rbt12Calculado;
    }

    const resultadosPorMes: ResultadoMensal[] = [];
    let acumulado12Meses = 0;

    // Para cada mês, calcular com base no acumulado dos últimos 12 meses
    for (let i = 0; i < faturamentosMensais.length; i++) {
      const mesDados = faturamentosMensais[i];
      
      // Calcular acumulado até o mês anterior
      const rbt12Mes = i === 0 
        ? rbt12Calculado // Primeiro mês usa o total
        : faturamentosMensais.slice(0, i).reduce((acc, m) => 
            acc + m.faturamentos.reduce((a, f) => a + extrairValor(f.faturamento), 0), 0);
      
      const resultadosMes: ResultadoAnexo[] = [];
      let totalMes = 0;

      for (const fat of mesDados.faturamentos) {
        const receitaMes = extrairValor(fat.faturamento);
        const resultado = calcularPorAnexo(
          Math.max(rbt12Mes, extrairValor(faturamento12Meses) || rbt12Calculado),
          receitaMes, 
          fat.anexo, 
          folha, 
          fatorRCalculado
        );
        if (resultado) {
          resultadosMes.push(resultado);
          totalMes += resultado.totalTributos;
        }
      }

      if (resultadosMes.length > 0) {
        resultadosPorMes.push({
          mes: mesDados.mes,
          nome: mesDados.nome,
          rbt12: rbt12Mes,
          resultados: resultadosMes,
          totalMes
        });
      }
    }

    setResultadosMensais(resultadosPorMes);
    setFatorR(fatorRCalculado);
    toast({ title: 'Cálculo mensal realizado com sucesso!' });
  };

  const calcular = () => {
    if (modoCalculo === 'anual') {
      calcularAnual();
    } else {
      calcularMensal();
    }
  };

  const limpar = () => {
    setFaturamento12Meses('');
    setFolhaPagamento('');
    setFaturamentosPorAnexo(anexosSelecionados.map(a => ({ anexo: a, faturamento: '' })));
    setFaturamentosMensais(MESES.map(m => ({
      mes: m.mes,
      nome: m.nome,
      faturamentos: anexosSelecionados.map(a => ({ anexo: a, faturamento: '' }))
    })));
    setResultados([]);
    setResultadosMensais([]);
    setFatorR(null);
  };

  const exportarParaComparativo = () => {
    if (!onExportarParaComparativo) {
      toast({ title: 'Função de exportação não disponível', variant: 'destructive' });
      return;
    }

    const rbt12 = modoCalculo === 'mensal' ? rbt12Calculado : extrairValor(faturamento12Meses);
    const folha = extrairValor(folhaPagamento);

    onExportarParaComparativo({
      regime: 'simples',
      anoSelecionado,
      faturamento12Meses: rbt12,
      folhaPagamento: folha,
      anexosSelecionados,
      modoCalculo
    });

    toast({ title: 'Dados exportados para o Comparativo!' });
  };

  const adicionarAoRelatorio = () => {
    if (!onAdicionarAoRelatorio) {
      toast({ title: 'Função não disponível', variant: 'destructive' });
      return;
    }

    if (modoCalculo === 'anual' && resultados.length === 0) {
      toast({ title: 'Realize um cálculo primeiro', variant: 'destructive' });
      return;
    }
    if (modoCalculo === 'mensal' && resultadosMensais.length === 0) {
      toast({ title: 'Realize um cálculo primeiro', variant: 'destructive' });
      return;
    }

    onAdicionarAoRelatorio({
      tipo: 'simples',
      titulo: `Simples Nacional - ${modoCalculo === 'anual' ? 'Anual' : 'Mensal'} ${anoSelecionado}`,
      dados: {
        resultados,
        resultadosMensais,
        fatorR,
        rbt12: modoCalculo === 'mensal' ? rbt12Calculado : extrairValor(faturamento12Meses),
        folhaPagamento: extrairValor(folhaPagamento),
        modoCalculo
      },
      dataHora: new Date().toLocaleString('pt-BR')
    });

    toast({ title: 'Dados adicionados ao relatório!' });
  };

  const exportarExcel = () => {
    if (modoCalculo === 'anual' && resultados.length === 0) {
      toast({ title: 'Realize um cálculo primeiro', variant: 'destructive' });
      return;
    }
    if (modoCalculo === 'mensal' && resultadosMensais.length === 0) {
      toast({ title: 'Realize um cálculo primeiro', variant: 'destructive' });
      return;
    }
    
    const wb = XLSX.utils.book_new();
    
    if (modoCalculo === 'anual') {
      const dados = resultados.map(r => ({
        'Ano': anoSelecionado,
        'Anexo': r.nomeAnexo,
        'Faturamento 12 Meses (RBT12)': extrairValor(faturamento12Meses),
        'Faturamento Mês': r.faturamento,
        'Fator R (%)': fatorR ? (fatorR * 100).toFixed(2) : 'N/A',
        'Alíquota Nominal (%)': r.aliquotaNominal.toFixed(2),
        'Alíquota Efetiva (%)': r.aliquotaEfetiva.toFixed(2),
        'Valor DAS': r.valorImposto,
        'IBS': r.ibs || 0,
        'CBS': r.cbs || 0,
        'INSS Patronal': r.inssPatronal || 0,
        'Sistema S': r.sistemaS || 0,
        'Total Tributos': r.totalTributos,
        'Carga Efetiva (%)': ((r.totalTributos / r.faturamento) * 100).toFixed(2)
      }));
      const ws = XLSX.utils.json_to_sheet(dados);
      XLSX.utils.book_append_sheet(wb, ws, 'Simples Nacional Anual');
    } else {
      const dadosMensais: any[] = [];
      for (const mes of resultadosMensais) {
        for (const r of mes.resultados) {
          dadosMensais.push({
            'Mês': mes.nome,
            'RBT12': mes.rbt12,
            'Anexo': r.nomeAnexo,
            'Faturamento': r.faturamento,
            'Alíquota Efetiva (%)': r.aliquotaEfetiva.toFixed(2),
            'DAS': r.valorImposto,
            'IBS': r.ibs || 0,
            'CBS': r.cbs || 0,
            'Total': r.totalTributos
          });
        }
      }
      const ws = XLSX.utils.json_to_sheet(dadosMensais);
      XLSX.utils.book_append_sheet(wb, ws, 'Simples Nacional Mensal');
    }

    XLSX.writeFile(wb, `simples_nacional_${modoCalculo}_${anoSelecionado}.xlsx`);
    toast({ title: 'Excel exportado com sucesso!' });
  };

  const exportarPDF = () => {
    if (modoCalculo === 'anual' && resultados.length === 0) {
      toast({ title: 'Realize um cálculo primeiro', variant: 'destructive' });
      return;
    }
    if (modoCalculo === 'mensal' && resultadosMensais.length === 0) {
      toast({ title: 'Realize um cálculo primeiro', variant: 'destructive' });
      return;
    }

    const printContent = modoCalculo === 'anual' ? `
      <html>
        <head>
          <title>Cálculo Simples Nacional - ${anoSelecionado}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
            h1 { color: #333; border-bottom: 2px solid #f59e0b; padding-bottom: 10px; }
            h2 { color: #555; margin-top: 30px; }
            .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-top: 20px; }
            .info-item { background: #f9f9f9; padding: 15px; border-radius: 8px; }
            .info-item .label { font-size: 0.9em; color: #666; }
            .info-item .valor { font-size: 1.3em; font-weight: bold; color: #333; margin-top: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: right; }
            th { background-color: #f5f5f5; font-weight: bold; }
            td:first-child, th:first-child { text-align: left; }
            .footer { margin-top: 40px; font-size: 0.8em; color: #888; text-align: center; }
          </style>
        </head>
        <body>
          <h1>Cálculo Simples Nacional - Ano ${anoSelecionado}</h1>
          <p>Modo: Anual</p>
          <div class="info-grid">
            <div class="info-item">
              <div class="label">Faturamento 12 Meses (RBT12)</div>
              <div class="valor">${formatarValorBRL(extrairValor(faturamento12Meses))}</div>
            </div>
          </div>
          <h2>Resultados por Anexo</h2>
          <table>
            <tr>
              <th>Anexo</th>
              <th>Fat. Mês</th>
              <th>Alíq. Efetiva</th>
              <th>DAS</th>
              <th>IBS</th>
              <th>CBS</th>
              <th>Total</th>
            </tr>
            ${resultados.map(r => `
              <tr>
                <td>${r.nomeAnexo}</td>
                <td>${formatarValorBRL(r.faturamento)}</td>
                <td>${r.aliquotaEfetiva.toFixed(2)}%</td>
                <td>${formatarValorBRL(r.valorImposto)}</td>
                <td>${r.ibs !== undefined ? formatarValorBRL(r.ibs) : '-'}</td>
                <td>${r.cbs !== undefined ? formatarValorBRL(r.cbs) : '-'}</td>
                <td><strong>${formatarValorBRL(r.totalTributos)}</strong></td>
              </tr>
            `).join('')}
          </table>
          <div class="footer">
            Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}
          </div>
        </body>
      </html>
    ` : `
      <html>
        <head>
          <title>Cálculo Simples Nacional Mensal - ${anoSelecionado}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #333; border-bottom: 2px solid #f59e0b; padding-bottom: 10px; }
            h2 { color: #555; margin-top: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.85em; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
            th { background-color: #f5f5f5; }
            td:first-child, th:first-child { text-align: left; }
            .footer { margin-top: 40px; font-size: 0.8em; color: #888; text-align: center; }
          </style>
        </head>
        <body>
          <h1>Cálculo Simples Nacional Mensal - Ano ${anoSelecionado}</h1>
          <p>RBT12 Total: ${formatarValorBRL(rbt12Calculado)}</p>
          ${resultadosMensais.map(mes => `
            <h2>${mes.nome}</h2>
            <p>RBT12 do mês: ${formatarValorBRL(mes.rbt12)}</p>
            <table>
              <tr>
                <th>Anexo</th>
                <th>Faturamento</th>
                <th>Alíq. Efetiva</th>
                <th>DAS</th>
                <th>Total</th>
              </tr>
              ${mes.resultados.map(r => `
                <tr>
                  <td>${r.nomeAnexo}</td>
                  <td>${formatarValorBRL(r.faturamento)}</td>
                  <td>${r.aliquotaEfetiva.toFixed(2)}%</td>
                  <td>${formatarValorBRL(r.valorImposto)}</td>
                  <td><strong>${formatarValorBRL(r.totalTributos)}</strong></td>
                </tr>
              `).join('')}
            </table>
          `).join('')}
          <div class="footer">
            Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}
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
      {/* Alerta 2026 */}
      {anoSelecionado === 2026 && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="text-amber-600">
            <strong>Ano 2026:</strong> Não há cobrança de IBS/CBS por fora do DAS. 
            A alíquota de teste (0,1% IBS + 0,9% CBS) é apenas para validação do sistema fiscal.
          </AlertDescription>
        </Alert>
      )}

      {/* Modo de Cálculo */}
      <Card className="border-amber-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 text-amber-500" />
            Modo de Cálculo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={modoCalculo} onValueChange={(v) => setModoCalculo(v as 'anual' | 'mensal')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="anual">Anual (Mês Específico)</TabsTrigger>
              <TabsTrigger value="mensal">Mensal (12 Meses)</TabsTrigger>
            </TabsList>
          </Tabs>
          <p className="text-xs text-muted-foreground mt-2">
            {modoCalculo === 'anual' 
              ? 'Informe o RBT12 e o faturamento do mês para cálculo único.'
              : 'Informe o faturamento de cada mês. O RBT12 será calculado automaticamente.'}
          </p>
        </CardContent>
      </Card>

      {/* Seleção de Anexos */}
      <Card className="border-amber-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Store className="h-5 w-5 text-amber-500" />
            Selecione os Anexos para Cálculo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {ANEXOS_DISPONIVEIS.map(anexo => (
              <div 
                key={anexo.key}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  anexosSelecionados.includes(anexo.key) 
                    ? 'bg-amber-500/10 border-amber-500' 
                    : 'bg-muted/30 border-muted hover:border-amber-500/50'
                }`}
                onClick={() => toggleAnexo(anexo.key)}
              >
                <Checkbox 
                  checked={anexosSelecionados.includes(anexo.key)}
                  onCheckedChange={() => toggleAnexo(anexo.key)}
                />
                <span className="text-sm">{anexo.nome}</span>
              </div>
            ))}
          </div>
          
          {temAnexoIV && (
            <Alert className="mt-4 border-blue-500/50 bg-blue-500/10">
              <AlertCircle className="h-4 w-4 text-blue-500" />
              <AlertDescription className="text-sm">
                <strong>Anexo IV:</strong> INSS Patronal (20% s/ folha) e Sistema S (5,8% s/ folha) 
                são calculados separadamente e somados ao total.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Configuração */}
      <Card className="border-amber-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calculator className="h-5 w-5 text-amber-500" />
            Dados para Cálculo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {modoCalculo === 'anual' ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Faturamento últimos 12 meses (RBT12)</Label>
                  <Input
                    value={faturamento12Meses}
                    onChange={(e) => setFaturamento12Meses(formatarMoeda(e.target.value))}
                    placeholder="0,00"
                    className="mt-1 font-mono"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Limite: R$ 4.800.000,00</p>
                </div>
                {(temAnexoIV || temAnexoV) && (
                  <div>
                    <Label>Folha de Pagamento (mensal)</Label>
                    <Input
                      value={folhaPagamento}
                      onChange={(e) => setFolhaPagamento(formatarMoeda(e.target.value))}
                      placeholder="0,00"
                      className="mt-1 font-mono"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {temAnexoV ? 'Para cálculo do Fator R' : ''}
                      {temAnexoV && temAnexoIV ? ' e ' : ''}
                      {temAnexoIV ? 'Anexo IV (INSS + Sistema S)' : ''}
                    </p>
                  </div>
                )}
              </div>

              {/* Faturamento por Anexo */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Faturamento do Mês por Anexo</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {faturamentosPorAnexo.map(fa => {
                    const anexoInfo = ANEXOS_DISPONIVEIS.find(a => a.key === fa.anexo);
                    return (
                      <div key={fa.anexo} className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{anexoInfo?.nome || fa.anexo}</Label>
                        <Input
                          value={fa.faturamento}
                          onChange={(e) => atualizarFaturamentoAnexo(fa.anexo, e.target.value)}
                          placeholder="0,00"
                          className="font-mono"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Modo Mensal */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {(temAnexoIV || temAnexoV) && (
                  <div>
                    <Label>Folha de Pagamento (mensal)</Label>
                    <Input
                      value={folhaPagamento}
                      onChange={(e) => setFolhaPagamento(formatarMoeda(e.target.value))}
                      placeholder="0,00"
                      className="mt-1 font-mono"
                    />
                  </div>
                )}
                <div>
                  <Label>RBT12 Calculado Automaticamente</Label>
                  <div className="mt-1 p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
                    <p className="text-lg font-bold text-amber-600">{formatarValorBRL(rbt12Calculado)}</p>
                    <p className="text-xs text-muted-foreground">Soma dos faturamentos dos 12 meses</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-base font-semibold">Faturamento Mensal por Anexo</Label>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-32">Mês</TableHead>
                        {anexosSelecionados.map(anexo => {
                          const info = ANEXOS_DISPONIVEIS.find(a => a.key === anexo);
                          return (
                            <TableHead key={anexo} className="min-w-32">
                              {info?.nome.replace(' - ', '\n')}
                            </TableHead>
                          );
                        })}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {faturamentosMensais.map(mes => (
                        <TableRow key={mes.mes}>
                          <TableCell className="font-medium">{mes.nome}</TableCell>
                          {anexosSelecionados.map(anexo => {
                            const fat = mes.faturamentos.find(f => f.anexo === anexo);
                            return (
                              <TableCell key={anexo}>
                                <Input
                                  value={fat?.faturamento || ''}
                                  onChange={(e) => atualizarFaturamentoMensal(mes.mes, anexo, e.target.value)}
                                  placeholder="0,00"
                                  className="font-mono text-sm"
                                />
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}

          {podeUsarReforma && (
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Switch
                checked={usarReforma}
                onCheckedChange={setUsarReforma}
              />
              <div>
                <Label className="cursor-pointer">Usar tabelas da Reforma (LC 214/2025)</Label>
                <p className="text-xs text-muted-foreground">
                  {usarReforma 
                    ? 'IBS/CBS cobrados por fora (alíquotas reduzidas)' 
                    : 'Tabela original Lei 123/06 (inclui todos os tributos)'}
                </p>
              </div>
            </div>
          )}

          {!podeUsarReforma && (
            <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
              <p className="text-sm text-amber-600">
                <strong>Ano 2026:</strong> Utilizando tabela original Lei 123/06. 
                IBS/CBS não são cobrados por fora neste ano.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <Button onClick={calcular} className="gap-2">
              <Calculator className="h-4 w-4" />
              Calcular DAS
            </Button>
            {((modoCalculo === 'anual' && resultados.length > 0) || (modoCalculo === 'mensal' && resultadosMensais.length > 0)) && (
              <>
                <Button variant="outline" onClick={exportarExcel} className="gap-2">
                  <Download className="h-4 w-4" />
                  Exportar Excel
                </Button>
                <Button variant="outline" onClick={exportarPDF} className="gap-2">
                  <FileText className="h-4 w-4" />
                  Exportar PDF
                </Button>
                {onExportarParaComparativo && (
                  <Button variant="secondary" onClick={exportarParaComparativo} className="gap-2">
                    <ArrowRight className="h-4 w-4" />
                    Enviar p/ Comparativo
                  </Button>
                )}
                {onAdicionarAoRelatorio && (
                  <Button variant="outline" onClick={adicionarAoRelatorio} className="gap-2 border-emerald-500/50 text-emerald-600 hover:bg-emerald-500/10">
                    <FileSpreadsheet className="h-4 w-4" />
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

      {/* Fator R - apenas quando Anexo V selecionado */}
      {temAnexoV && fatorR !== null && (
        <Card className="border-purple-500/30 bg-purple-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="h-6 w-6 text-purple-500" />
                <div>
                  <p className="font-medium">Fator R Calculado</p>
                  <p className="text-sm text-muted-foreground">Folha / RBT12</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-purple-500">{(fatorR * 100).toFixed(2)}%</p>
                {fatorR >= 0.28 ? (
                  <Badge className="bg-emerald-500">≥ 28% - Anexo V → Anexo III</Badge>
                ) : (
                  <Badge variant="secondary">&lt; 28% - Permanece Anexo V</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resultados Anuais */}
      {modoCalculo === 'anual' && resultados.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Resultados por Anexo - {anoSelecionado}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Anexo</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                    <TableHead className="text-right">Alíq. Nominal</TableHead>
                    <TableHead className="text-right">Alíq. Efetiva</TableHead>
                    <TableHead className="text-right">DAS</TableHead>
                    <TableHead className="text-right">IBS</TableHead>
                    <TableHead className="text-right">CBS</TableHead>
                    <TableHead className="text-right">INSS Pat.</TableHead>
                    <TableHead className="text-right">Sistema S</TableHead>
                    <TableHead className="text-right font-bold">Total</TableHead>
                    <TableHead className="text-right">Carga %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultados.map((r, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{r.nomeAnexo}</TableCell>
                      <TableCell className="text-right font-mono">{formatarValorBRL(r.faturamento)}</TableCell>
                      <TableCell className="text-right">{r.aliquotaNominal.toFixed(2)}%</TableCell>
                      <TableCell className="text-right">{r.aliquotaEfetiva.toFixed(2)}%</TableCell>
                      <TableCell className="text-right font-mono">{formatarValorBRL(r.valorImposto)}</TableCell>
                      <TableCell className="text-right font-mono text-blue-500">
                        {r.ibs !== undefined ? formatarValorBRL(r.ibs) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-emerald-500">
                        {r.cbs !== undefined ? formatarValorBRL(r.cbs) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-orange-500">
                        {r.inssPatronal !== undefined ? formatarValorBRL(r.inssPatronal) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-purple-500">
                        {r.sistemaS !== undefined ? formatarValorBRL(r.sistemaS) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        {formatarValorBRL(r.totalTributos)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary">
                        {((r.totalTributos / r.faturamento) * 100).toFixed(2)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resultados Mensais */}
      {modoCalculo === 'mensal' && resultadosMensais.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Resultados Mensais - {anoSelecionado}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {resultadosMensais.map(mes => (
                <AccordionItem key={mes.mes} value={`mes-${mes.mes}`}>
                  <AccordionTrigger>
                    <div className="flex items-center justify-between w-full pr-4">
                      <span>{mes.nome}</span>
                      <div className="flex gap-4">
                        <Badge variant="outline">RBT12: {formatarValorBRL(mes.rbt12)}</Badge>
                        <Badge className="bg-primary">Total: {formatarValorBRL(mes.totalMes)}</Badge>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Anexo</TableHead>
                          <TableHead className="text-right">Faturamento</TableHead>
                          <TableHead className="text-right">Alíq. Efetiva</TableHead>
                          <TableHead className="text-right">DAS</TableHead>
                          <TableHead className="text-right">IBS</TableHead>
                          <TableHead className="text-right">CBS</TableHead>
                          <TableHead className="text-right font-bold">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mes.resultados.map((r, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{r.nomeAnexo}</TableCell>
                            <TableCell className="text-right font-mono">{formatarValorBRL(r.faturamento)}</TableCell>
                            <TableCell className="text-right">{r.aliquotaEfetiva.toFixed(2)}%</TableCell>
                            <TableCell className="text-right font-mono">{formatarValorBRL(r.valorImposto)}</TableCell>
                            <TableCell className="text-right font-mono text-blue-500">
                              {r.ibs !== undefined ? formatarValorBRL(r.ibs) : '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono text-emerald-500">
                              {r.cbs !== undefined ? formatarValorBRL(r.cbs) : '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold">
                              {formatarValorBRL(r.totalTributos)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            {/* Resumo Anual */}
            <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/30">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-lg font-medium">Total Anual de Tributos</p>
                  <p className="text-sm text-muted-foreground">Soma de todos os meses</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">
                    {formatarValorBRL(resultadosMensais.reduce((acc, m) => acc + m.totalMes, 0))}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Carga Média: {((resultadosMensais.reduce((acc, m) => acc + m.totalMes, 0) / rbt12Calculado) * 100).toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabelas dos Anexos Selecionados */}
      {anexosSelecionados.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TableIcon className="h-5 w-5 text-primary" />
              Tabelas do Simples Nacional
              <Badge variant="outline" className="ml-2">
                {usarReforma ? 'LC 214/2025' : 'Lei 123/06'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {anexosSelecionados.map(anexoKey => {
                const tabela = tabelas[anexoKey];
                return (
                  <AccordionItem key={anexoKey} value={anexoKey}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-amber-500" />
                        <span>{tabela.nome}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Faixa</TableHead>
                              <TableHead className="text-right">Até</TableHead>
                              <TableHead className="text-right">Alíquota</TableHead>
                              <TableHead className="text-right">Dedução</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {tabela.faixas.map((faixa, idx) => (
                              <TableRow key={idx}>
                                <TableCell>{idx + 1}ª Faixa</TableCell>
                                <TableCell className="text-right font-mono">{formatarValorBRL(faixa.ate)}</TableCell>
                                <TableCell className="text-right font-mono">{faixa.aliquota.toFixed(2)}%</TableCell>
                                <TableCell className="text-right font-mono">{formatarValorBRL(faixa.deducao)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CalculoSimplesNacional;
