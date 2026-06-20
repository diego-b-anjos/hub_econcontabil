import React, { useState, useEffect, useMemo } from 'react';
import { Calculator, Building2, Plus, Trash2, DollarSign, Download, FileText, Users, AlertCircle, Calendar, ArrowRight, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';

import { ATIVIDADES_LUCRO_PRESUMIDO, PERIODO_TRANSICAO } from '@/constants/tax-tables';
import { formatarValorBRL, extrairValor, formatarMoeda } from '@/utils/tax-calculations';

interface AtividadeCalculo {
  id: string;
  atividadeId: string;
  receita: string;
  icmsAliquota: string;
  ipiAliquota: string;
  issAliquota: string;
}

interface AtividadeMensal {
  mes: number;
  nome: string;
  atividades: AtividadeCalculo[];
}

interface ResultadoLucroPresumido {
  atividade: string;
  tipoAtividade: string;
  receita: number;
  presuncaoIRPJ: number;
  presuncaoCSLL: number;
  baseIRPJ: number;
  baseCSLL: number;
  irpj: number;
  adicionalIRPJ: number;
  csll: number;
  pis: number;
  cofins: number;
  ibs: number;
  cbs: number;
  icms: number;
  ipi: number;
  iss: number;
  inssPatronal: number;
  sistemaS: number;
  totalTributos: number;
}

interface ResultadoMensal {
  mes: number;
  nome: string;
  resultados: ResultadoLucroPresumido[];
  totais: TotaisResultado;
}

interface TotaisResultado {
  receita: number;
  irpj: number;
  adicionalIRPJ: number;
  csll: number;
  pis: number;
  cofins: number;
  ibs: number;
  cbs: number;
  icms: number;
  ipi: number;
  iss: number;
  inssPatronal: number;
  sistemaS: number;
  total: number;
}

export interface DadosExportacaoLP {
  regime: 'presumido';
  anoSelecionado: number;
  receitaTotal: number;
  folhaPagamento: number;
  tipoAtividade: string;
  modoCalculo: 'anual' | 'trimestral' | 'mensal';
  icmsAliquota: number;
  issAliquota: number;
  ipiAliquota: number;
}

interface DadosRelatorio {
  tipo: 'presumido';
  titulo: string;
  dados: any;
  dataHora: string;
}

interface Props {
  anoSelecionado: number;
  onExportarParaComparativo?: (dados: DadosExportacaoLP) => void;
  onAdicionarAoRelatorio?: (dados: DadosRelatorio) => void;
}

const MESES = [
  { mes: 1, nome: 'Janeiro', trimestre: 1 },
  { mes: 2, nome: 'Fevereiro', trimestre: 1 },
  { mes: 3, nome: 'Março', trimestre: 1 },
  { mes: 4, nome: 'Abril', trimestre: 2 },
  { mes: 5, nome: 'Maio', trimestre: 2 },
  { mes: 6, nome: 'Junho', trimestre: 2 },
  { mes: 7, nome: 'Julho', trimestre: 3 },
  { mes: 8, nome: 'Agosto', trimestre: 3 },
  { mes: 9, nome: 'Setembro', trimestre: 3 },
  { mes: 10, nome: 'Outubro', trimestre: 4 },
  { mes: 11, nome: 'Novembro', trimestre: 4 },
  { mes: 12, nome: 'Dezembro', trimestre: 4 },
];

const TRIMESTRES = [
  { trimestre: 1, nome: '1º Trimestre', meses: [1, 2, 3] },
  { trimestre: 2, nome: '2º Trimestre', meses: [4, 5, 6] },
  { trimestre: 3, nome: '3º Trimestre', meses: [7, 8, 9] },
  { trimestre: 4, nome: '4º Trimestre', meses: [10, 11, 12] },
];

// Mapeamento de tipo de atividade
const TIPO_ATIVIDADE: Record<string, 'comercio' | 'industria' | 'servicos'> = {
  'comercio': 'comercio',
  'servicos': 'servicos',
  'transporte': 'servicos',
  'transporte_passageiros': 'servicos',
  'servicos_hospitalares': 'servicos',
  'profissionais': 'servicos',
  'intermediacao': 'servicos',
  'construcao': 'servicos',
};

const CalculoLucroPresumido: React.FC<Props> = ({ anoSelecionado, onExportarParaComparativo, onAdicionarAoRelatorio }) => {
  const [modoCalculo, setModoCalculo] = useState<'anual' | 'trimestral' | 'mensal'>('anual');
  const [folhaPagamento, setFolhaPagamento] = useState('');
  
  // Atividades para modo trimestral (único)
  const [atividades, setAtividades] = useState<AtividadeCalculo[]>([
    { id: '1', atividadeId: 'comercio', receita: '', icmsAliquota: '18', ipiAliquota: '', issAliquota: '' }
  ]);
  
  // Atividades mensais
  const [atividadesMensais, setAtividadesMensais] = useState<AtividadeMensal[]>([]);
  
  const [resultados, setResultados] = useState<ResultadoLucroPresumido[]>([]);
  const [resultadosMensais, setResultadosMensais] = useState<ResultadoMensal[]>([]);
  const [totais, setTotais] = useState<TotaisResultado | null>(null);

  const aliquotas = PERIODO_TRANSICAO[anoSelecionado] || PERIODO_TRANSICAO[2033];

  // A partir de 2027 não há mais PIS, COFINS e IPI
  const temPisCofins = anoSelecionado < 2027;
  const temIPI = anoSelecionado < 2027;

  // Inicializar atividades mensais
  useEffect(() => {
    if (modoCalculo === 'mensal' && atividadesMensais.length === 0) {
      const inicial = MESES.map(m => ({
        mes: m.mes,
        nome: m.nome,
        atividades: [{ id: '1', atividadeId: 'comercio', receita: '', icmsAliquota: '18', ipiAliquota: '', issAliquota: '' }]
      }));
      setAtividadesMensais(inicial);
    }
  }, [modoCalculo]);

  // Calcular receita total anual automaticamente no modo mensal
  const receitaTotalAnual = useMemo(() => {
    if (modoCalculo !== 'mensal') return 0;
    
    let total = 0;
    for (const mes of atividadesMensais) {
      for (const atv of mes.atividades) {
        total += extrairValor(atv.receita);
      }
    }
    return total;
  }, [atividadesMensais, modoCalculo]);

  const adicionarAtividade = () => {
    setAtividades(prev => [...prev, {
      id: Date.now().toString(),
      atividadeId: 'comercio',
      receita: '',
      icmsAliquota: '18',
      ipiAliquota: '',
      issAliquota: ''
    }]);
  };

  const adicionarAtividadeMensal = (mes: number) => {
    setAtividadesMensais(prev => prev.map(m => 
      m.mes === mes 
        ? { 
            ...m, 
            atividades: [...m.atividades, {
              id: Date.now().toString(),
              atividadeId: 'comercio',
              receita: '',
              icmsAliquota: '18',
              ipiAliquota: '',
              issAliquota: ''
            }]
          }
        : m
    ));
  };

  const removerAtividade = (id: string) => {
    if (atividades.length <= 1) {
      toast({ title: 'Mantenha ao menos uma atividade', variant: 'destructive' });
      return;
    }
    setAtividades(prev => prev.filter(a => a.id !== id));
  };

  const removerAtividadeMensal = (mes: number, id: string) => {
    setAtividadesMensais(prev => prev.map(m => {
      if (m.mes !== mes) return m;
      if (m.atividades.length <= 1) {
        toast({ title: 'Mantenha ao menos uma atividade', variant: 'destructive' });
        return m;
      }
      return { ...m, atividades: m.atividades.filter(a => a.id !== id) };
    }));
  };

  const atualizarAtividade = (id: string, campo: keyof AtividadeCalculo, valor: string) => {
    setAtividades(prev => prev.map(a => {
      if (a.id !== id) return a;
      
      const novaAtividade = { ...a, [campo]: campo === 'receita' ? formatarMoeda(valor) : valor };
      
      // Auto-ajustar campos de impostos conforme tipo de atividade
      if (campo === 'atividadeId') {
        const tipo = TIPO_ATIVIDADE[valor] || 'comercio';
        if (tipo === 'comercio') {
          novaAtividade.icmsAliquota = '18';
          novaAtividade.ipiAliquota = '';
          novaAtividade.issAliquota = '';
        } else if (tipo === 'industria') {
          novaAtividade.icmsAliquota = '18';
          novaAtividade.ipiAliquota = '5';
          novaAtividade.issAliquota = '';
        } else if (tipo === 'servicos') {
          novaAtividade.icmsAliquota = '';
          novaAtividade.ipiAliquota = '';
          novaAtividade.issAliquota = '5';
        }
      }
      
      return novaAtividade;
    }));
  };

  const atualizarAtividadeMensal = (mes: number, id: string, campo: keyof AtividadeCalculo, valor: string) => {
    setAtividadesMensais(prev => prev.map(m => {
      if (m.mes !== mes) return m;
      
      return {
        ...m,
        atividades: m.atividades.map(a => {
          if (a.id !== id) return a;
          
          const novaAtividade = { ...a, [campo]: campo === 'receita' ? formatarMoeda(valor) : valor };
          
          if (campo === 'atividadeId') {
            const tipo = TIPO_ATIVIDADE[valor] || 'comercio';
            if (tipo === 'comercio') {
              novaAtividade.icmsAliquota = '18';
              novaAtividade.ipiAliquota = '';
              novaAtividade.issAliquota = '';
            } else if (tipo === 'industria') {
              novaAtividade.icmsAliquota = '18';
              novaAtividade.ipiAliquota = '5';
              novaAtividade.issAliquota = '';
            } else if (tipo === 'servicos') {
              novaAtividade.icmsAliquota = '';
              novaAtividade.ipiAliquota = '';
              novaAtividade.issAliquota = '5';
            }
          }
          
          return novaAtividade;
        })
      };
    }));
  };

  const calcularPorAtividade = (atv: AtividadeCalculo, folha: number, isMensal: boolean = false): ResultadoLucroPresumido | null => {
    const receita = extrairValor(atv.receita);
    if (receita <= 0) return null;

    const config = ATIVIDADES_LUCRO_PRESUMIDO.find(a => a.id === atv.atividadeId);
    if (!config) return null;

    const tipo = TIPO_ATIVIDADE[atv.atividadeId] || 'comercio';

    // Para modo mensal, usar receita do mês; para trimestral, receita já é trimestral
    const receitaBase = receita;

    // Base de cálculo
    const baseIRPJ = receitaBase * (config.presuncaoIRPJ / 100);
    const baseCSLL = receitaBase * (config.presuncaoCSLL / 100);

    // IRPJ: 15% + Adicional 10% sobre excedente de R$ 20.000/mês ou R$ 60.000/trimestre
    const limiteAdicional = isMensal ? 20000 : 60000;
    const irpj = baseIRPJ * 0.15;
    const adicionalIRPJ = baseIRPJ > limiteAdicional ? (baseIRPJ - limiteAdicional) * 0.10 : 0;

    // CSLL: 9%
    const csll = baseCSLL * 0.09;

    // PIS: 0.65% e COFINS: 3% (cumulativo) - apenas até 2026
    const pis = temPisCofins ? receitaBase * 0.0065 : 0;
    const cofins = temPisCofins ? receitaBase * 0.03 : 0;

    // IBS e CBS conforme ano de transição
    const ibs = receitaBase * (aliquotas.ibs / 100);
    const cbs = receitaBase * (aliquotas.cbs / 100);

    // ICMS (alíquota cheia informada * proporcional da transição)
    const icmsAliquotaCheia = parseFloat(atv.icmsAliquota) || 0;
    const icms = (tipo === 'comercio' || tipo === 'industria') && icmsAliquotaCheia > 0 
      ? receitaBase * (icmsAliquotaCheia / 100) * (aliquotas.icms / 100)
      : 0;

    // IPI (apenas indústria e até 2026)
    const ipiAliquota = parseFloat(atv.ipiAliquota) || 0;
    const ipi = temIPI && tipo === 'industria' && ipiAliquota > 0 
      ? receitaBase * (ipiAliquota / 100)
      : 0;

    // ISS (alíquota cheia informada * proporcional da transição)
    const issAliquotaCheia = parseFloat(atv.issAliquota) || 0;
    const iss = tipo === 'servicos' && issAliquotaCheia > 0 
      ? receitaBase * (issAliquotaCheia / 100) * (aliquotas.iss / 100)
      : 0;

    // INSS e Sistema S são calculados sobre folha no total, não por atividade
    const totalTributos = irpj + adicionalIRPJ + csll + pis + cofins + ibs + cbs + icms + ipi + iss;

    return {
      atividade: config.nome,
      tipoAtividade: tipo,
      receita: receitaBase,
      presuncaoIRPJ: config.presuncaoIRPJ,
      presuncaoCSLL: config.presuncaoCSLL,
      baseIRPJ,
      baseCSLL,
      irpj,
      adicionalIRPJ,
      csll,
      pis,
      cofins,
      ibs,
      cbs,
      icms,
      ipi,
      iss,
      inssPatronal: 0,
      sistemaS: 0,
      totalTributos
    };
  };

  const calcularTrimestral = () => {
    const folha = extrairValor(folhaPagamento);
    const resultadosCalculo: ResultadoLucroPresumido[] = [];
    let totalReceita = 0;
    let totalIRPJ = 0;
    let totalAdicional = 0;
    let totalCSLL = 0;
    let totalPIS = 0;
    let totalCOFINS = 0;
    let totalIBS = 0;
    let totalCBS = 0;
    let totalICMS = 0;
    let totalIPI = 0;
    let totalISS = 0;

    for (const atv of atividades) {
      const resultado = calcularPorAtividade(atv, folha, false);
      if (resultado) {
        resultadosCalculo.push(resultado);
        totalReceita += resultado.receita;
        totalIRPJ += resultado.irpj;
        totalAdicional += resultado.adicionalIRPJ;
        totalCSLL += resultado.csll;
        totalPIS += resultado.pis;
        totalCOFINS += resultado.cofins;
        totalIBS += resultado.ibs;
        totalCBS += resultado.cbs;
        totalICMS += resultado.icms;
        totalIPI += resultado.ipi;
        totalISS += resultado.iss;
      }
    }

    if (resultadosCalculo.length === 0) {
      toast({ title: 'Informe ao menos uma receita válida', variant: 'destructive' });
      return;
    }

    // Calcular INSS Patronal (20% sobre folha) e Sistema S (5,8% sobre folha)
    const totalINSSPatronal = folha * 0.20;
    const totalSistemaS = folha * 0.058;

    setResultados(resultadosCalculo);
    setTotais({
      receita: totalReceita,
      irpj: totalIRPJ,
      adicionalIRPJ: totalAdicional,
      csll: totalCSLL,
      pis: totalPIS,
      cofins: totalCOFINS,
      ibs: totalIBS,
      cbs: totalCBS,
      icms: totalICMS,
      ipi: totalIPI,
      iss: totalISS,
      inssPatronal: totalINSSPatronal,
      sistemaS: totalSistemaS,
      total: totalIRPJ + totalAdicional + totalCSLL + totalPIS + totalCOFINS + totalIBS + totalCBS + totalICMS + totalIPI + totalISS + totalINSSPatronal + totalSistemaS
    });

    toast({ title: 'Cálculo trimestral realizado com sucesso!' });
  };

  const calcularMensal = () => {
    const folha = extrairValor(folhaPagamento);
    const resultadosPorMes: ResultadoMensal[] = [];

    for (const mesDados of atividadesMensais) {
      const resultadosMes: ResultadoLucroPresumido[] = [];
      let totalReceita = 0;
      let totalIRPJ = 0;
      let totalAdicional = 0;
      let totalCSLL = 0;
      let totalPIS = 0;
      let totalCOFINS = 0;
      let totalIBS = 0;
      let totalCBS = 0;
      let totalICMS = 0;
      let totalIPI = 0;
      let totalISS = 0;

      for (const atv of mesDados.atividades) {
        const resultado = calcularPorAtividade(atv, folha, true);
        if (resultado) {
          resultadosMes.push(resultado);
          totalReceita += resultado.receita;
          totalIRPJ += resultado.irpj;
          totalAdicional += resultado.adicionalIRPJ;
          totalCSLL += resultado.csll;
          totalPIS += resultado.pis;
          totalCOFINS += resultado.cofins;
          totalIBS += resultado.ibs;
          totalCBS += resultado.cbs;
          totalICMS += resultado.icms;
          totalIPI += resultado.ipi;
          totalISS += resultado.iss;
        }
      }

      // INSS e Sistema S mensais
      const inssPatronal = folha * 0.20;
      const sistemaS = folha * 0.058;

      if (resultadosMes.length > 0) {
        resultadosPorMes.push({
          mes: mesDados.mes,
          nome: mesDados.nome,
          resultados: resultadosMes,
          totais: {
            receita: totalReceita,
            irpj: totalIRPJ,
            adicionalIRPJ: totalAdicional,
            csll: totalCSLL,
            pis: totalPIS,
            cofins: totalCOFINS,
            ibs: totalIBS,
            cbs: totalCBS,
            icms: totalICMS,
            ipi: totalIPI,
            iss: totalISS,
            inssPatronal,
            sistemaS,
            total: totalIRPJ + totalAdicional + totalCSLL + totalPIS + totalCOFINS + totalIBS + totalCBS + totalICMS + totalIPI + totalISS + inssPatronal + sistemaS
          }
        });
      }
    }

    if (resultadosPorMes.length === 0) {
      toast({ title: 'Informe ao menos uma receita válida', variant: 'destructive' });
      return;
    }

    setResultadosMensais(resultadosPorMes);

    // Calcular totais anuais
    const totaisAnuais = resultadosPorMes.reduce((acc, mes) => ({
      receita: acc.receita + mes.totais.receita,
      irpj: acc.irpj + mes.totais.irpj,
      adicionalIRPJ: acc.adicionalIRPJ + mes.totais.adicionalIRPJ,
      csll: acc.csll + mes.totais.csll,
      pis: acc.pis + mes.totais.pis,
      cofins: acc.cofins + mes.totais.cofins,
      ibs: acc.ibs + mes.totais.ibs,
      cbs: acc.cbs + mes.totais.cbs,
      icms: acc.icms + mes.totais.icms,
      ipi: acc.ipi + mes.totais.ipi,
      iss: acc.iss + mes.totais.iss,
      inssPatronal: acc.inssPatronal + mes.totais.inssPatronal,
      sistemaS: acc.sistemaS + mes.totais.sistemaS,
      total: acc.total + mes.totais.total
    }), {
      receita: 0, irpj: 0, adicionalIRPJ: 0, csll: 0, pis: 0, cofins: 0,
      ibs: 0, cbs: 0, icms: 0, ipi: 0, iss: 0, inssPatronal: 0, sistemaS: 0, total: 0
    });

    setTotais(totaisAnuais);
    toast({ title: 'Cálculo mensal realizado com sucesso!' });
  };

  const calcularAnual = () => {
    const folha = extrairValor(folhaPagamento);
    const resultadosCalculo: ResultadoLucroPresumido[] = [];
    let totalReceita = 0;
    let totalIRPJ = 0;
    let totalAdicional = 0;
    let totalCSLL = 0;
    let totalPIS = 0;
    let totalCOFINS = 0;
    let totalIBS = 0;
    let totalCBS = 0;
    let totalICMS = 0;
    let totalIPI = 0;
    let totalISS = 0;

    for (const atv of atividades) {
      const receita = extrairValor(atv.receita);
      if (receita <= 0) continue;

      const config = ATIVIDADES_LUCRO_PRESUMIDO.find(a => a.id === atv.atividadeId);
      if (!config) continue;

      const tipo = TIPO_ATIVIDADE[atv.atividadeId] || 'comercio';
      const receitaBase = receita; // Receita anual

      // Base de cálculo anual
      const baseIRPJ = receitaBase * (config.presuncaoIRPJ / 100);
      const baseCSLL = receitaBase * (config.presuncaoCSLL / 100);

      // IRPJ: 15% + Adicional 10% sobre excedente de R$ 240.000/ano (R$ 20.000/mês)
      const irpj = baseIRPJ * 0.15;
      const adicionalIRPJ = baseIRPJ > 240000 ? (baseIRPJ - 240000) * 0.10 : 0;

      // CSLL: 9%
      const csll = baseCSLL * 0.09;

      // PIS: 0.65% e COFINS: 3% (cumulativo) - apenas até 2026
      const pis = temPisCofins ? receitaBase * 0.0065 : 0;
      const cofins = temPisCofins ? receitaBase * 0.03 : 0;

      // IBS e CBS conforme ano de transição
      const ibs = receitaBase * (aliquotas.ibs / 100);
      const cbs = receitaBase * (aliquotas.cbs / 100);

      // ICMS (alíquota cheia informada * proporcional da transição)
      const icmsAliquotaCheia = parseFloat(atv.icmsAliquota) || 0;
      const icms = (tipo === 'comercio' || tipo === 'industria') && icmsAliquotaCheia > 0 
        ? receitaBase * (icmsAliquotaCheia / 100) * (aliquotas.icms / 100)
        : 0;

      // IPI (apenas indústria e até 2026)
      const ipiAliquota = parseFloat(atv.ipiAliquota) || 0;
      const ipi = temIPI && tipo === 'industria' && ipiAliquota > 0 
        ? receitaBase * (ipiAliquota / 100)
        : 0;

      // ISS (alíquota cheia informada * proporcional da transição)
      const issAliquotaCheia = parseFloat(atv.issAliquota) || 0;
      const iss = tipo === 'servicos' && issAliquotaCheia > 0 
        ? receitaBase * (issAliquotaCheia / 100) * (aliquotas.iss / 100)
        : 0;

      const totalTributos = irpj + adicionalIRPJ + csll + pis + cofins + ibs + cbs + icms + ipi + iss;

      resultadosCalculo.push({
        atividade: config.nome,
        tipoAtividade: tipo,
        receita: receitaBase,
        presuncaoIRPJ: config.presuncaoIRPJ,
        presuncaoCSLL: config.presuncaoCSLL,
        baseIRPJ,
        baseCSLL,
        irpj,
        adicionalIRPJ,
        csll,
        pis,
        cofins,
        ibs,
        cbs,
        icms,
        ipi,
        iss,
        inssPatronal: 0,
        sistemaS: 0,
        totalTributos
      });

      totalReceita += receitaBase;
      totalIRPJ += irpj;
      totalAdicional += adicionalIRPJ;
      totalCSLL += csll;
      totalPIS += pis;
      totalCOFINS += cofins;
      totalIBS += ibs;
      totalCBS += cbs;
      totalICMS += icms;
      totalIPI += ipi;
      totalISS += iss;
    }

    if (resultadosCalculo.length === 0) {
      toast({ title: 'Informe ao menos uma receita válida', variant: 'destructive' });
      return;
    }

    // Calcular INSS Patronal (20% sobre folha anual) e Sistema S (5,8% sobre folha anual)
    const totalINSSPatronal = folha * 12 * 0.20;
    const totalSistemaS = folha * 12 * 0.058;

    setResultados(resultadosCalculo);
    setTotais({
      receita: totalReceita,
      irpj: totalIRPJ,
      adicionalIRPJ: totalAdicional,
      csll: totalCSLL,
      pis: totalPIS,
      cofins: totalCOFINS,
      ibs: totalIBS,
      cbs: totalCBS,
      icms: totalICMS,
      ipi: totalIPI,
      iss: totalISS,
      inssPatronal: totalINSSPatronal,
      sistemaS: totalSistemaS,
      total: totalIRPJ + totalAdicional + totalCSLL + totalPIS + totalCOFINS + totalIBS + totalCBS + totalICMS + totalIPI + totalISS + totalINSSPatronal + totalSistemaS
    });

    toast({ title: 'Cálculo anual realizado com sucesso!' });
  };

  const calcular = () => {
    if (modoCalculo === 'anual') {
      calcularAnual();
    } else if (modoCalculo === 'trimestral') {
      calcularTrimestral();
    } else {
      calcularMensal();
    }
  };

  const limpar = () => {
    setAtividades([{ id: '1', atividadeId: 'comercio', receita: '', icmsAliquota: '18', ipiAliquota: '', issAliquota: '' }]);
    setAtividadesMensais(MESES.map(m => ({
      mes: m.mes,
      nome: m.nome,
      atividades: [{ id: '1', atividadeId: 'comercio', receita: '', icmsAliquota: '18', ipiAliquota: '', issAliquota: '' }]
    })));
    setFolhaPagamento('');
    setResultados([]);
    setResultadosMensais([]);
    setTotais(null);
  };

  const exportarParaComparativo = () => {
    if (!onExportarParaComparativo) {
      toast({ title: 'Função de exportação não disponível', variant: 'destructive' });
      return;
    }

    const folha = extrairValor(folhaPagamento);
    const receitaTotal = modoCalculo === 'mensal' 
      ? receitaTotalAnual 
      : atividades.reduce((acc, a) => acc + extrairValor(a.receita), 0) * 4; // Trimestral x 4

    // Pegar alíquotas da primeira atividade como referência
    const primeiraAtividade = modoCalculo === 'mensal' 
      ? atividadesMensais[0]?.atividades[0] 
      : atividades[0];

    onExportarParaComparativo({
      regime: 'presumido',
      anoSelecionado,
      receitaTotal,
      folhaPagamento: folha,
      tipoAtividade: primeiraAtividade?.atividadeId || 'comercio',
      modoCalculo,
      icmsAliquota: parseFloat(primeiraAtividade?.icmsAliquota || '18'),
      issAliquota: parseFloat(primeiraAtividade?.issAliquota || '5'),
      ipiAliquota: parseFloat(primeiraAtividade?.ipiAliquota || '0')
    });

    toast({ title: 'Dados exportados para o Comparativo!' });
  };

  const adicionarAoRelatorio = () => {
    if (!onAdicionarAoRelatorio || !totais) {
      toast({ title: 'Realize um cálculo primeiro', variant: 'destructive' });
      return;
    }

    onAdicionarAoRelatorio({
      tipo: 'presumido',
      titulo: `Lucro Presumido - ${modoCalculo === 'anual' ? 'Anual' : modoCalculo === 'trimestral' ? 'Trimestral' : 'Mensal'} ${anoSelecionado}`,
      dados: {
        resultados: resultados.map(r => ({
          tributo: r.atividade,
          base: r.receita,
          aliquota: (r.totalTributos / r.receita) * 100,
          valor: r.totalTributos
        })),
        receitaTotal: totais.receita,
        periodoCalculo: modoCalculo,
        tipoAtividade: atividades[0]?.atividadeId || 'comercio',
        totais
      },
      dataHora: new Date().toLocaleString('pt-BR')
    });

    toast({ title: 'Dados adicionados ao relatório!' });
  };

  const exportarExcel = () => {
    if (!totais) {
      toast({ title: 'Realize um cálculo primeiro', variant: 'destructive' });
      return;
    }

    const wb = XLSX.utils.book_new();

    if (modoCalculo === 'trimestral') {
      const dadosDetalhados = resultados.map(r => ({
        'Ano': anoSelecionado,
        'Atividade': r.atividade,
        'Tipo': r.tipoAtividade,
        'Receita': r.receita,
        'Presunção IRPJ (%)': r.presuncaoIRPJ,
        'Base IRPJ': r.baseIRPJ,
        'IRPJ': r.irpj,
        'Adicional IRPJ': r.adicionalIRPJ,
        'CSLL': r.csll,
        'PIS': r.pis,
        'COFINS': r.cofins,
        'IBS': r.ibs,
        'CBS': r.cbs,
        'ICMS (proporcional)': r.icms,
        'IPI': r.ipi,
        'ISS (proporcional)': r.iss,
        'Total Tributos': r.totalTributos
      }));

      const wsDetalhes = XLSX.utils.json_to_sheet(dadosDetalhados);
      XLSX.utils.book_append_sheet(wb, wsDetalhes, 'Detalhamento Trimestral');
    } else {
      const dadosMensais: any[] = [];
      for (const mes of resultadosMensais) {
        for (const r of mes.resultados) {
          dadosMensais.push({
            'Mês': mes.nome,
            'Atividade': r.atividade,
            'Receita': r.receita,
            'IRPJ': r.irpj,
            'CSLL': r.csll,
            'IBS': r.ibs,
            'CBS': r.cbs,
            'ICMS': r.icms,
            'ISS': r.iss,
            'Total': r.totalTributos
          });
        }
      }

      const wsMensais = XLSX.utils.json_to_sheet(dadosMensais);
      XLSX.utils.book_append_sheet(wb, wsMensais, 'Detalhamento Mensal');
    }

    // Resumo
    const resumo = [{
      'Ano': anoSelecionado,
      'Modo': modoCalculo === 'trimestral' ? 'Trimestral' : 'Mensal',
      'Receita Total': totais.receita,
      'Folha de Pagamento': extrairValor(folhaPagamento),
      'IRPJ + Adicional': totais.irpj + totais.adicionalIRPJ,
      'CSLL': totais.csll,
      'PIS + COFINS': totais.pis + totais.cofins,
      'IBS + CBS': totais.ibs + totais.cbs,
      'ICMS': totais.icms,
      'IPI': totais.ipi,
      'ISS': totais.iss,
      'INSS Patronal': totais.inssPatronal,
      'Sistema S': totais.sistemaS,
      'Total Geral': totais.total,
      'Carga Efetiva (%)': ((totais.total / totais.receita) * 100).toFixed(2)
    }];

    const wsResumo = XLSX.utils.json_to_sheet(resumo);
    XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

    XLSX.writeFile(wb, `lucro_presumido_${modoCalculo}_${anoSelecionado}.xlsx`);
    toast({ title: 'Excel exportado com sucesso!' });
  };

  const exportarPDF = () => {
    if (!totais) {
      toast({ title: 'Realize um cálculo primeiro', variant: 'destructive' });
      return;
    }

    const printContent = `
      <html>
        <head>
          <title>Cálculo Lucro Presumido - ${anoSelecionado}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #333; border-bottom: 2px solid #0066cc; padding-bottom: 10px; }
            h2 { color: #555; margin-top: 30px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 0.8em; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
            th { background-color: #f5f5f5; font-weight: bold; }
            td:first-child, th:first-child { text-align: left; }
            .resumo { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-top: 20px; }
            .resumo-item { background: #f9f9f9; padding: 15px; border-radius: 8px; text-align: center; }
            .resumo-item .valor { font-size: 1.2em; font-weight: bold; color: #0066cc; }
            .total-box { background: #0066cc; color: white; padding: 20px; border-radius: 8px; text-align: center; margin-top: 30px; }
            .total-box .valor { font-size: 2em; font-weight: bold; }
            .footer { margin-top: 40px; font-size: 0.8em; color: #888; text-align: center; }
          </style>
        </head>
        <body>
          <h1>Cálculo Lucro Presumido - Ano ${anoSelecionado}</h1>
          <p>Modo: ${modoCalculo === 'trimestral' ? 'Trimestral' : 'Mensal'}</p>
          
          <h2>Resumo</h2>
          <div class="resumo">
            <div class="resumo-item">
              <div>Receita Total</div>
              <div class="valor">${formatarValorBRL(totais.receita)}</div>
            </div>
            <div class="resumo-item">
              <div>IBS + CBS</div>
              <div class="valor">${formatarValorBRL(totais.ibs + totais.cbs)}</div>
            </div>
            <div class="resumo-item">
              <div>IRPJ + CSLL</div>
              <div class="valor">${formatarValorBRL(totais.irpj + totais.adicionalIRPJ + totais.csll)}</div>
            </div>
            <div class="resumo-item">
              <div>Total Tributos</div>
              <div class="valor">${formatarValorBRL(totais.total)}</div>
            </div>
          </div>

          <div class="total-box">
            <div>Total Geral de Tributos</div>
            <div class="valor">${formatarValorBRL(totais.total)}</div>
            <div>Carga Efetiva: ${((totais.total / totais.receita) * 100).toFixed(2)}%</div>
          </div>

          <div class="footer">
            Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}<br>
            <small>LC 214/2025 - Reforma Tributária</small>
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

  const getTipoAtividade = (atividadeId: string): 'comercio' | 'industria' | 'servicos' => {
    return TIPO_ATIVIDADE[atividadeId] || 'comercio';
  };

  const renderAtividadeForm = (atv: AtividadeCalculo, onUpdate: (id: string, campo: keyof AtividadeCalculo, valor: string) => void, onRemove: (id: string) => void, canRemove: boolean, index: number) => {
    const tipo = getTipoAtividade(atv.atividadeId);
    return (
      <Card key={atv.id} className="bg-muted/30">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Atividade {index + 1}</span>
            {canRemove && (
              <Button variant="ghost" size="sm" onClick={() => onRemove(atv.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Tipo de Atividade</Label>
              <Select value={atv.atividadeId} onValueChange={(v) => onUpdate(atv.id, 'atividadeId', v)}>
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

            <div>
              <Label className="text-xs">
                Receita {modoCalculo === 'anual' ? 'Anual' : modoCalculo === 'trimestral' ? 'Trimestral' : 'Mensal'} (R$)
              </Label>
              <Input
                value={atv.receita}
                onChange={(e) => onUpdate(atv.id, 'receita', e.target.value)}
                placeholder="0,00"
                className="mt-1 font-mono"
              />
            </div>

            {/* ICMS para Comércio/Indústria */}
            {(tipo === 'comercio' || tipo === 'industria') && (
              <div>
                <Label className="text-xs">ICMS Alíq. Cheia (%)</Label>
                <Input
                  value={atv.icmsAliquota}
                  onChange={(e) => onUpdate(atv.id, 'icmsAliquota', e.target.value)}
                  placeholder="18"
                  className="mt-1 font-mono"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Proporcional: {((parseFloat(atv.icmsAliquota) || 0) * (aliquotas.icms / 100)).toFixed(2)}%
                </p>
              </div>
            )}

            {/* IPI para Indústria (apenas até 2026) */}
            {tipo === 'industria' && temIPI && (
              <div>
                <Label className="text-xs">IPI Alíquota (%)</Label>
                <Input
                  value={atv.ipiAliquota}
                  onChange={(e) => onUpdate(atv.id, 'ipiAliquota', e.target.value)}
                  placeholder="5"
                  className="mt-1 font-mono"
                />
              </div>
            )}

            {/* ISS para Serviços */}
            {tipo === 'servicos' && (
              <div>
                <Label className="text-xs">ISS Alíq. Cheia (%)</Label>
                <Input
                  value={atv.issAliquota}
                  onChange={(e) => onUpdate(atv.id, 'issAliquota', e.target.value)}
                  placeholder="5"
                  className="mt-1 font-mono"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Proporcional: {((parseFloat(atv.issAliquota) || 0) * (aliquotas.iss / 100)).toFixed(2)}%
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
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

      {/* Modo de Cálculo */}
      <Card className="border-blue-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 text-blue-500" />
            Modo de Cálculo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={modoCalculo} onValueChange={(v) => setModoCalculo(v as 'anual' | 'trimestral' | 'mensal')}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="anual">Anual</TabsTrigger>
              <TabsTrigger value="trimestral">Trimestral</TabsTrigger>
              <TabsTrigger value="mensal">Mensal (12 Meses)</TabsTrigger>
            </TabsList>
          </Tabs>
          <p className="text-xs text-muted-foreground mt-2">
            {modoCalculo === 'anual' 
              ? 'Informe as receitas do ano. Adicional de IRPJ sobre base de cálculo acima de R$ 240.000/ano.'
              : modoCalculo === 'trimestral' 
              ? 'Informe as receitas do trimestre. Adicional de IRPJ sobre R$ 60.000/trimestre.'
              : 'Informe as receitas de cada mês. Adicional de IRPJ sobre R$ 20.000/mês.'}
          </p>
        </CardContent>
      </Card>

      {/* Entrada de Dados */}
      <Card className="border-blue-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5 text-blue-500" />
            Dados para Cálculo - Lucro Presumido
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Folha de Pagamento */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Folha de Pagamento (mensal)</Label>
              <Input
                value={folhaPagamento}
                onChange={(e) => setFolhaPagamento(formatarMoeda(e.target.value))}
                placeholder="0,00"
                className="mt-1 font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Base para INSS Patronal (20%) e Sistema S (5,8%)
              </p>
            </div>
            {modoCalculo === 'mensal' && (
              <div>
                <Label>Receita Total Anual (Calculada)</Label>
                <div className="mt-1 p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
                  <p className="text-lg font-bold text-blue-600">{formatarValorBRL(receitaTotalAnual)}</p>
                  <p className="text-xs text-muted-foreground">Soma das receitas dos 12 meses</p>
                </div>
              </div>
            )}
          </div>

          {/* Atividades - Modo Trimestral */}
          {(modoCalculo === 'trimestral' || modoCalculo === 'anual') && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">
                  Atividades e Receitas ({modoCalculo === 'anual' ? 'Ano' : 'Trimestre'})
                </Label>
                <Button variant="outline" size="sm" onClick={adicionarAtividade} className="gap-1">
                  <Plus className="h-4 w-4" />
                  Adicionar Atividade
                </Button>
              </div>

              {atividades.map((atv, index) => 
                renderAtividadeForm(atv, atualizarAtividade, removerAtividade, atividades.length > 1, index)
              )}
            </div>
          )}

          {/* Atividades - Modo Mensal */}
          {modoCalculo === 'mensal' && (
            <div className="space-y-4">
              <Label className="text-base font-semibold">Receitas Mensais por Atividade</Label>
              
              <Accordion type="multiple" className="w-full">
                {TRIMESTRES.map(trim => (
                  <AccordionItem key={trim.trimestre} value={`trim-${trim.trimestre}`}>
                    <AccordionTrigger>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-blue-500" />
                        <span>{trim.nome}</span>
                        <Badge variant="outline" className="ml-2">
                          {formatarValorBRL(
                            atividadesMensais
                              .filter(m => trim.meses.includes(m.mes))
                              .reduce((acc, m) => acc + m.atividades.reduce((a, atv) => a + extrairValor(atv.receita), 0), 0)
                          )}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4">
                      {atividadesMensais
                        .filter(m => trim.meses.includes(m.mes))
                        .map(mesDados => (
                          <div key={mesDados.mes} className="border rounded-lg p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium">{mesDados.nome}</h4>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => adicionarAtividadeMensal(mesDados.mes)}
                                className="gap-1"
                              >
                                <Plus className="h-3 w-3" />
                                Atividade
                              </Button>
                            </div>
                            {mesDados.atividades.map((atv, idx) => 
                              renderAtividadeForm(
                                atv, 
                                (id, campo, valor) => atualizarAtividadeMensal(mesDados.mes, id, campo, valor),
                                (id) => removerAtividadeMensal(mesDados.mes, id),
                                mesDados.atividades.length > 1,
                                idx
                              )
                            )}
                          </div>
                        ))}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <Button onClick={calcular} className="gap-2">
              <Calculator className="h-4 w-4" />
              Calcular Tributos
            </Button>
            {totais && (
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

      {/* Resultados */}
      {totais && (
        <>
          {/* Resumo Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">Receita Total</p>
                <p className="text-xl font-bold text-blue-500">{formatarValorBRL(totais.receita)}</p>
              </CardContent>
            </Card>
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">IBS + CBS</p>
                <p className="text-xl font-bold text-emerald-500">{formatarValorBRL(totais.ibs + totais.cbs)}</p>
              </CardContent>
            </Card>
            <Card className="border-orange-500/30 bg-orange-500/5">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">IRPJ + CSLL</p>
                <p className="text-xl font-bold text-orange-500">{formatarValorBRL(totais.irpj + totais.adicionalIRPJ + totais.csll)}</p>
              </CardContent>
            </Card>
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">Total Tributos</p>
                <p className="text-xl font-bold text-primary">{formatarValorBRL(totais.total)}</p>
                <p className="text-xs text-muted-foreground">
                  Carga: {((totais.total / totais.receita) * 100).toFixed(2)}%
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabela Detalhada - Trimestral */}
          {modoCalculo === 'trimestral' && resultados.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Detalhamento por Atividade - {anoSelecionado}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Atividade</TableHead>
                        <TableHead className="text-right">Receita</TableHead>
                        <TableHead className="text-right">Base IRPJ</TableHead>
                        <TableHead className="text-right">IRPJ</TableHead>
                        <TableHead className="text-right">Adic.</TableHead>
                        <TableHead className="text-right">CSLL</TableHead>
                        {temPisCofins && (
                          <>
                            <TableHead className="text-right">PIS</TableHead>
                            <TableHead className="text-right">COFINS</TableHead>
                          </>
                        )}
                        <TableHead className="text-right">IBS</TableHead>
                        <TableHead className="text-right">CBS</TableHead>
                        <TableHead className="text-right">ICMS</TableHead>
                        {temIPI && <TableHead className="text-right">IPI</TableHead>}
                        <TableHead className="text-right">ISS</TableHead>
                        <TableHead className="text-right font-bold">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resultados.map((r, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{r.atividade}</TableCell>
                          <TableCell className="text-right font-mono">{formatarValorBRL(r.receita)}</TableCell>
                          <TableCell className="text-right font-mono">{formatarValorBRL(r.baseIRPJ)}</TableCell>
                          <TableCell className="text-right font-mono">{formatarValorBRL(r.irpj)}</TableCell>
                          <TableCell className="text-right font-mono">{formatarValorBRL(r.adicionalIRPJ)}</TableCell>
                          <TableCell className="text-right font-mono">{formatarValorBRL(r.csll)}</TableCell>
                          {temPisCofins && (
                            <>
                              <TableCell className="text-right font-mono">{formatarValorBRL(r.pis)}</TableCell>
                              <TableCell className="text-right font-mono">{formatarValorBRL(r.cofins)}</TableCell>
                            </>
                          )}
                          <TableCell className="text-right font-mono text-blue-500">{formatarValorBRL(r.ibs)}</TableCell>
                          <TableCell className="text-right font-mono text-emerald-500">{formatarValorBRL(r.cbs)}</TableCell>
                          <TableCell className="text-right font-mono text-orange-500">{formatarValorBRL(r.icms)}</TableCell>
                          {temIPI && <TableCell className="text-right font-mono">{formatarValorBRL(r.ipi)}</TableCell>}
                          <TableCell className="text-right font-mono text-purple-500">{formatarValorBRL(r.iss)}</TableCell>
                          <TableCell className="text-right font-mono font-bold">{formatarValorBRL(r.totalTributos)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabela Detalhada - Mensal */}
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
                    <AccordionItem key={mes.mes} value={`res-${mes.mes}`}>
                      <AccordionTrigger>
                        <div className="flex items-center justify-between w-full pr-4">
                          <span>{mes.nome}</span>
                          <div className="flex gap-4">
                            <Badge variant="outline">Receita: {formatarValorBRL(mes.totais.receita)}</Badge>
                            <Badge className="bg-primary">Total: {formatarValorBRL(mes.totais.total)}</Badge>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Atividade</TableHead>
                              <TableHead className="text-right">Receita</TableHead>
                              <TableHead className="text-right">IRPJ</TableHead>
                              <TableHead className="text-right">CSLL</TableHead>
                              <TableHead className="text-right">IBS</TableHead>
                              <TableHead className="text-right">CBS</TableHead>
                              <TableHead className="text-right font-bold">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {mes.resultados.map((r, idx) => (
                              <TableRow key={idx}>
                                <TableCell>{r.atividade}</TableCell>
                                <TableCell className="text-right font-mono">{formatarValorBRL(r.receita)}</TableCell>
                                <TableCell className="text-right font-mono">{formatarValorBRL(r.irpj + r.adicionalIRPJ)}</TableCell>
                                <TableCell className="text-right font-mono">{formatarValorBRL(r.csll)}</TableCell>
                                <TableCell className="text-right font-mono text-blue-500">{formatarValorBRL(r.ibs)}</TableCell>
                                <TableCell className="text-right font-mono text-emerald-500">{formatarValorBRL(r.cbs)}</TableCell>
                                <TableCell className="text-right font-mono font-bold">{formatarValorBRL(r.totalTributos)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          )}

          {/* Encargos sobre Folha */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-primary" />
                Encargos sobre Folha de Pagamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Base ({modoCalculo === 'mensal' ? 'Anual' : 'Mensal'})</TableHead>
                      <TableHead className="text-right">Alíquota</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>INSS Patronal</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatarValorBRL(modoCalculo === 'mensal' ? extrairValor(folhaPagamento) * 12 : extrairValor(folhaPagamento))}
                      </TableCell>
                      <TableCell className="text-right">20%</TableCell>
                      <TableCell className="text-right font-mono font-bold text-orange-500">{formatarValorBRL(totais.inssPatronal)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Sistema S (SENAI, SESI, SENAC, etc.)</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatarValorBRL(modoCalculo === 'mensal' ? extrairValor(folhaPagamento) * 12 : extrairValor(folhaPagamento))}
                      </TableCell>
                      <TableCell className="text-right">5,8%</TableCell>
                      <TableCell className="text-right font-mono font-bold text-purple-500">{formatarValorBRL(totais.sistemaS)}</TableCell>
                    </TableRow>
                    <TableRow className="bg-muted/50">
                      <TableCell colSpan={3} className="font-bold">Total Encargos</TableCell>
                      <TableCell className="text-right font-mono font-bold">{formatarValorBRL(totais.inssPatronal + totais.sistemaS)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Total Geral */}
          <Card className="border-primary bg-primary/5">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-medium">Total Geral de Tributos ({modoCalculo === 'trimestral' ? 'Trimestre' : 'Ano'})</p>
                  <p className="text-sm text-muted-foreground">
                    Tributos sobre receita + Encargos sobre folha
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-primary">{formatarValorBRL(totais.total)}</p>
                  <p className="text-sm text-muted-foreground">
                    Carga Efetiva: {((totais.total / totais.receita) * 100).toFixed(2)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default CalculoLucroPresumido;
