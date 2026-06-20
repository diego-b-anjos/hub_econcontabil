import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Package, Briefcase, Home, Calculator, Search, FileSpreadsheet, Calendar, Info, Building2, Store, Upload, Download, Building, FileCode, FileText, Plus, TrendingUp, ArrowRight, Scale, Settings2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { apiSimulations, type Simulation } from '@/lib/api';
import { SimulationEditorCore } from '@/components/SimulationEditor/SimulationEditorCore';

import type { TipoCodigo, ResultadoAnalise, ModuloAtivo } from '@/types/tax';
import { PERIODO_TRANSICAO, OPERACOES_IMOBILIARIAS } from '@/constants/tax-tables';
import { analisarNCM, analisarNBS, analisarImovel, buscarPorDescricao, formatarValorBRL, obterCSTporClassTrib } from '@/utils/tax-calculations';
import { buscarNBS, buscarNBSPorDescricao, buscarNBSPorLC116, getNBSDatabase, NBSProcessado, obterCSTdeClassificacao } from '@/utils/nbs-database-loader';

import CalculoLucroPresumido, { DadosExportacaoLP } from './CalculoLucroPresumido';
import CalculoSimplesNacional, { DadosExportacao as DadosExportacaoSN } from './CalculoSimplesNacional';
import CalculoOperacoesImobiliarias from './CalculoOperacoesImobiliarias';
import ModalSelecaoClassTrib from './ModalSelecaoClassTrib';
import ModalSelecaoClassTribUpload, { ItemComMultiplasOpcoes } from './ModalSelecaoClassTribUpload';
import ModalSelecaoNBSUpload, { ItemLC116ComMultiplosNBS } from './ModalSelecaoNBSUpload';
import RelatorioConsolidado, { RelatorioConsolidadoRef } from './RelatorioConsolidado';

import logoEcon from '@/assets/logo-econ.png';
import { addReformaHistory } from '@/lib/reforma-history';

// Tipo para módulo com relatório e transição
type ModuloAtivoExtendido = ModuloAtivo | 'relatorio' | 'transicao' | 'comparativo';

const MODULO_LABELS: Record<string, string> = {
  pesquisa: 'Pesquisa NCM/NBS',
  calculo: 'Cálculo Lucro Presumido',
  simples: 'Cálculo Simples Nacional',
  imobiliario: 'Operações Imobiliárias',
  transicao: 'Transição 2026-2033',
  relatorio: 'Relatório Consolidado',
  comparativo: 'Comparativo de Regimes',
};

interface AliquotasCustom {
  ibsRef: number;
  cbsRef: number;
  isOverrides: Record<string, number>;
}
const DEFAULT_ALIQUOTAS: AliquotasCustom = { ibsRef: 17.70, cbsRef: 8.80, isOverrides: {} };

interface TaxAnalyzerDashboardProps {
  initialSimId?: string;
  newSimulacao?: boolean;
}

const TaxAnalyzerDashboard: React.FC<TaxAnalyzerDashboardProps> = ({ initialSimId, newSimulacao }) => {
  const [modulo, setModulo] = useState<ModuloAtivoExtendido>('pesquisa');

  // Alíquotas customizadas
  const [aliquotasCustom, setAliquotasCustom] = useState<AliquotasCustom>(() => {
    try {
      const saved = localStorage.getItem('econ:aliquotas-custom');
      return saved ? { ...DEFAULT_ALIQUOTAS, ...JSON.parse(saved) } : DEFAULT_ALIQUOTAS;
    } catch { return DEFAULT_ALIQUOTAS; }
  });
  const [aliqOpen, setAliqOpen] = useState(false);
  const [draftIBS, setDraftIBS] = useState(String(
    (() => { try { const s = localStorage.getItem('econ:aliquotas-custom'); return s ? (JSON.parse(s).ibsRef ?? 17.70) : 17.70; } catch { return 17.70; } })()
  ));
  const [draftCBS, setDraftCBS] = useState(String(
    (() => { try { const s = localStorage.getItem('econ:aliquotas-custom'); return s ? (JSON.parse(s).cbsRef ?? 8.80) : 8.80; } catch { return 8.80; } })()
  ));

  // Comparativo de Regimes
  const [comparativoView, setComparativoView] = useState<'list' | 'editor'>('list');
  const [comparativoId, setComparativoId] = useState<string | undefined>(undefined);
  const [simsList, setSimsList] = useState<Simulation[]>([]);
  const [simsLoading, setSimsLoading] = useState(false);

  // Registra no histórico (Comparativo Tributário) cada módulo visitado nesta sessão
  useEffect(() => {
    const label = MODULO_LABELS[modulo] || String(modulo);
    addReformaHistory({ modulo: String(modulo), moduloLabel: label });
  }, [modulo]);

  // Persistência das alíquotas customizadas
  useEffect(() => {
    localStorage.setItem('econ:aliquotas-custom', JSON.stringify(aliquotasCustom));
  }, [aliquotasCustom]);

  // Auto-abre aba Comparativo se viemos de uma rota com id ou nova
  useEffect(() => {
    if (initialSimId || newSimulacao) {
      setModulo('comparativo');
      setComparativoView('editor');
      setComparativoId(initialSimId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Carrega lista de simulações quando a aba Comparativo é ativada (visão lista)
  useEffect(() => {
    if (modulo !== 'comparativo' || comparativoView !== 'list') return;
    setSimsLoading(true);
    apiSimulations.list()
      .then((data) => setSimsList(data))
      .catch(() => setSimsList([]))
      .finally(() => setSimsLoading(false));
  }, [modulo, comparativoView]);

  const relatorioRef = useRef<RelatorioConsolidadoRef>(null);
  const [anoSelecionado, setAnoSelecionado] = useState<number>(2033);
  const [tipoCodigo, setTipoCodigo] = useState<TipoCodigo>('NCM');
  const [codigoPesquisa, setCodigoPesquisa] = useState('');
  const [tipoOperacaoImovel, setTipoOperacaoImovel] = useState('locacao');
  const [processedData, setProcessedData] = useState<ResultadoAnalise[]>([]);
  const [resultadosBusca, setResultadosBusca] = useState<Array<{ codigo: string; nome: string; anexo: number; regime: string }>>([]);

// Modal de seleção NBS com múltiplas opções
  const [modalNBSAberto, setModalNBSAberto] = useState(false);
  const [nbsParaSelecao, setNbsParaSelecao] = useState<NBSProcessado | null>(null);

  // Modal de seleção cClassTrib para upload
  const [modalUploadAberto, setModalUploadAberto] = useState(false);
  const [itensParaSelecao, setItensParaSelecao] = useState<ItemComMultiplasOpcoes[]>([]);
  const [resultadosPendentes, setResultadosPendentes] = useState<ResultadoAnalise[]>([]);

  // Estado para armazenar dados originais da planilha LC 116 importada
  const [dadosOriginaisLC116, setDadosOriginaisLC116] = useState<Array<{ codigoLC116: string; descricaoLC116: string }>>([]);

  // Modal de seleção de NBS para LC 116 com múltiplos NBS
  const [modalNBSUploadAberto, setModalNBSUploadAberto] = useState(false);
  const [itensLC116ParaSelecao, setItensLC116ParaSelecao] = useState<ItemLC116ComMultiplosNBS[]>([]);
  const [dadosLC116Pendentes, setDadosLC116Pendentes] = useState<Array<{ codigoLC116: string; descricaoLC116: string; nbsDisponiveis: NBSProcessado[] }>>([]);

  const aliquotasEfetivas = useMemo(() => {
    const base = PERIODO_TRANSICAO[anoSelecionado] || PERIODO_TRANSICAO[2033];
    const ratioIBS = aliquotasCustom.ibsRef / 17.70;
    const ratioCBS = aliquotasCustom.cbsRef / 8.80;
    return {
      ...base,
      ibs: parseFloat((base.ibs * ratioIBS).toFixed(2)),
      cbs: parseFloat((base.cbs * ratioCBS).toFixed(2)),
    };
  }, [anoSelecionado, aliquotasCustom]);

  // Handler para exportar do Simples Nacional para Comparativo Tributário
  const handleExportarSimplesParaComparativo = useCallback((_dados: DadosExportacaoSN) => {
    setModulo('comparativo');
    setComparativoView('editor');
    setComparativoId(undefined);
    toast({
      title: 'Comparativo Tributário',
      description: 'Preencha os dados no editor para comparar Simples Nacional, Lucro Presumido e Lucro Real.',
    });
  }, []);

  // Handler para exportar do Lucro Presumido para Comparativo Tributário
  const handleExportarPresumidoParaComparativo = useCallback((_dados: DadosExportacaoLP) => {
    setModulo('comparativo');
    setComparativoView('editor');
    setComparativoId(undefined);
    toast({
      title: 'Comparativo Tributário',
      description: 'Preencha os dados no editor para comparar Simples Nacional, Lucro Presumido e Lucro Real.',
    });
  }, []);

  const pesquisarCodigo = () => {
    if (!codigoPesquisa.trim()) {
      toast({ title: 'Digite um código ou descrição', variant: 'destructive' });
      return;
    }

    const termo = codigoPesquisa.trim();
    const isDescricao = /[a-zA-ZáéíóúÁÉÍÓÚãõÃÕçÇ]/.test(termo);

    if (isDescricao) {
      if (tipoCodigo === 'NBS') {
        // Usar busca por descrição do nbs-database-loader
        const resultadosNBS = buscarNBSPorDescricao(termo);
        const resultadosFormatados = resultadosNBS.map(r => ({
          codigo: r.nbs,
          nome: r.descricao,
          anexo: 0,
          regime: 'NBS'
        }));
        setResultadosBusca(resultadosFormatados);
        if (resultadosFormatados.length === 0) {
          toast({ title: 'Nenhum resultado encontrado', variant: 'destructive' });
        }
      } else {
        const resultados = buscarPorDescricao(termo, tipoCodigo === 'IMOVEL' ? 'NCM' : tipoCodigo);
        setResultadosBusca(resultados);
        if (resultados.length === 0) {
          toast({ title: 'Nenhum resultado encontrado', variant: 'destructive' });
        }
      }
    } else {
      if (tipoCodigo === 'NCM') {
        const resultado = analisarNCM(termo, anoSelecionado);
        setProcessedData(prev => [...prev, resultado]);
        setResultadosBusca([]);
        toast({ title: 'Código analisado com sucesso!' });
      } else if (tipoCodigo === 'NBS') {
        // Buscar NBS na base de dados local
        const nbsEncontrado = buscarNBS(termo);
        
        if (nbsEncontrado && nbsEncontrado.opcoes.length > 1) {
          // Tem múltiplas opções - abrir modal
          setNbsParaSelecao(nbsEncontrado);
          setModalNBSAberto(true);
        } else if (nbsEncontrado) {
          // Única opção
          const resultado = criarResultadoNBS(nbsEncontrado, 0);
          setProcessedData(prev => [...prev, resultado]);
          toast({ title: 'Código analisado com sucesso!' });
        } else {
          // NBS não encontrado - usar análise padrão
          const resultado = analisarNBS(termo, anoSelecionado, null);
          setProcessedData(prev => [...prev, resultado]);
          toast({ title: 'Código analisado com sucesso!' });
        }
        setResultadosBusca([]);
      } else {
        const resultado = analisarImovel(tipoOperacaoImovel, 0, anoSelecionado);
        setProcessedData(prev => [...prev, resultado]);
        setResultadosBusca([]);
        toast({ title: 'Código analisado com sucesso!' });
      }
    }
  };

  const criarResultadoNBS = (nbsInfo: NBSProcessado, indiceOpcao: number): ResultadoAnalise => {
    const opcao = nbsInfo.opcoes[indiceOpcao];
    const aliquotas = aliquotasEfetivas;
    const classtrib = String(opcao.classtrib).padStart(6, '0');
    
    // Buscar CST e reduções da base de classificação tributária
    const detalhesClass = obterCSTdeClassificacao(classtrib);
    const cstInfo = obterCSTporClassTrib(classtrib);
    
    // Usar reduções da base de dados, ou calcular se não encontrar
    let reducao_ibs = detalhesClass?.reducaoIBS || 0;
    let reducao_cbs = detalhesClass?.reducaoCBS || 0;
    
    // Fallback para mapeamento manual se não encontrar na base
    if (reducao_ibs === 0 && reducao_cbs === 0) {
      // ClassTribs conhecidos com redução de 60%
      if (['200028', '200029', '200043', '200044', '200039', '200045', '200046', '200052'].includes(classtrib)) {
        reducao_ibs = 60;
        reducao_cbs = 60;
      } else if (classtrib === '200016') {
        reducao_ibs = 100;
        reducao_cbs = 100;
      }
    }
    
    const fatorReducao = (100 - reducao_ibs) / 100;
    const ibsEfetiva = aliquotas.ibs * fatorReducao;
    const cbsEfetiva = aliquotas.cbs * fatorReducao;
    
    return {
      codigo: nbsInfo.nbs,
      validez: 'ok',
      mensagem: nbsInfo.descricao,
      regime: reducao_ibs === 0 ? 'Tributação Integral' : `Redução de ${reducao_ibs}%`,
      anexo: opcao.nomeClasstrib ? `ClassTrib ${classtrib}` : '-',
      classtrib: classtrib,
      cst_ibs: cstInfo.cst_ibs,
      cst_cbs: cstInfo.cst_cbs,
      ibsBase: aliquotas.ibs.toFixed(2),
      cbsBase: aliquotas.cbs.toFixed(2),
      reducao_ibs: reducao_ibs.toString(),
      reducao_cbs: reducao_cbs.toString(),
      ibsEfetiva: ibsEfetiva.toFixed(2),
      cbsEfetiva: cbsEfetiva.toFixed(2),
      impostoSeletivo: 'NÃO',
      cst_is: '-',
      classtrib_is: '-',
      aliquota_is: '-',
      anexo_is: '-',
      temMultiplasOpcoes: nbsInfo.opcoes.length > 1,
      totalOpcoes: nbsInfo.opcoes.length
    };
  };

  const handleSelecaoNBS = (opcao: { classtrib: string; nomeClasstrib: string; indop: number }) => {
    if (!nbsParaSelecao) return;
    
    const indice = nbsParaSelecao.opcoes.findIndex(o => o.classtrib === opcao.classtrib);
    const resultado = criarResultadoNBS(nbsParaSelecao, indice >= 0 ? indice : 0);
    setProcessedData(prev => [...prev, resultado]);
    setModalNBSAberto(false);
    setNbsParaSelecao(null);
    toast({ title: 'Código analisado com sucesso!' });
  };

  const adicionarDaBusca = (codigo: string) => {
    if (tipoCodigo === 'NCM') {
      const resultado = analisarNCM(codigo, anoSelecionado);
      setProcessedData(prev => [...prev, resultado]);
    } else if (tipoCodigo === 'NBS') {
      const nbsEncontrado = buscarNBS(codigo);
      if (nbsEncontrado && nbsEncontrado.opcoes.length > 1) {
        setNbsParaSelecao(nbsEncontrado);
        setModalNBSAberto(true);
      } else if (nbsEncontrado) {
        const resultado = criarResultadoNBS(nbsEncontrado, 0);
        setProcessedData(prev => [...prev, resultado]);
      } else {
        const resultado = analisarNBS(codigo, anoSelecionado, null);
        setProcessedData(prev => [...prev, resultado]);
      }
    }
    setResultadosBusca([]);
    toast({ title: 'Código adicionado!' });
  };

  const limparResultados = () => {
    setProcessedData([]);
    setResultadosBusca([]);
    setCodigoPesquisa('');
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const spedInputRef = useRef<HTMLInputElement>(null);
  const lc116FileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadExcel = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);

        const novosResultados: ResultadoAnalise[] = [];
        const itensComMultiplasOpcoes: ItemComMultiplasOpcoes[] = [];
        
        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i];
          const codigo = String(row.codigo || row.Codigo || row.NCM || row.NBS || row.ncm || row.nbs || '').trim();
          if (!codigo) continue;

          if (tipoCodigo === 'NCM') {
            const resultado = analisarNCM(codigo, anoSelecionado);
            novosResultados.push(resultado);
          } else if (tipoCodigo === 'NBS') {
            // Verificar se tem múltiplas opções
            const nbsEncontrado = buscarNBS(codigo);
            if (nbsEncontrado && nbsEncontrado.opcoes.length > 1) {
              itensComMultiplasOpcoes.push({
                codigo: nbsEncontrado.nbs,
                descricao: nbsEncontrado.descricao,
                tipo: 'NBS',
                indice: i,
                opcoes: nbsEncontrado.opcoes.map(o => ({
                  classtrib: o.classtrib,
                  nomeClasstrib: o.nomeClasstrib,
                  indop: o.indop
                }))
              });
            } else if (nbsEncontrado) {
              const resultado = criarResultadoNBS(nbsEncontrado, 0);
              novosResultados.push(resultado);
            } else {
              const resultado = analisarNBS(codigo, anoSelecionado, null);
              novosResultados.push(resultado);
            }
          }
        }

        // Se há itens com múltiplas opções, abrir modal para seleção
        if (itensComMultiplasOpcoes.length > 0) {
          setItensParaSelecao(itensComMultiplasOpcoes);
          setResultadosPendentes(novosResultados);
          setModalUploadAberto(true);
        } else if (novosResultados.length > 0) {
          setProcessedData(prev => [...prev, ...novosResultados]);
          toast({ title: `${novosResultados.length} código(s) importado(s) com sucesso!` });
        } else {
          toast({ title: 'Nenhum código válido encontrado no arquivo', variant: 'destructive' });
        }
      } catch (error) {
        toast({ title: 'Erro ao processar arquivo Excel', variant: 'destructive' });
      }
    };
    reader.readAsArrayBuffer(file);
    if (event.target) event.target.value = '';
  };

  const handleConfirmarSelecoesUpload = (selecoes: Map<number, string>) => {
    const novosResultadosComSelecao: ResultadoAnalise[] = [];
    
    for (const item of itensParaSelecao) {
      const classtribSelecionado = selecoes.get(item.indice);
      const nbsEncontrado = buscarNBS(item.codigo);
      if (nbsEncontrado && classtribSelecionado) {
        const indice = nbsEncontrado.opcoes.findIndex(o => o.classtrib === classtribSelecionado);
        const resultado = criarResultadoNBS(nbsEncontrado, indice >= 0 ? indice : 0);
        novosResultadosComSelecao.push(resultado);
      }
    }
    
    // Combinar com resultados pendentes
    const todosResultados = [...resultadosPendentes, ...novosResultadosComSelecao];
    setProcessedData(prev => [...prev, ...todosResultados]);
    
    toast({ title: `${todosResultados.length} código(s) importado(s) com sucesso!` });
    
    setModalUploadAberto(false);
    setItensParaSelecao([]);
    setResultadosPendentes([]);
  };

  // Importação de arquivos SPED
  const handleUploadSPED = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const lines = content.split('\n');
        
        const ncms = new Set<string>();
        const nbsSet = new Set<string>();

        for (const line of lines) {
          const campos = line.split('|');
          
          // SPED Contribuições - Registro 0200 (Cadastro de Itens) - NCM no campo 8
          if (campos[1] === '0200' && campos.length > 8) {
            const ncm = campos[8]?.trim();
            if (ncm && ncm.length >= 4) {
              ncms.add(ncm);
            }
          }
          
          // SPED Contribuições - Registro A170 (Serviços) - Código de Serviço no campo 4
          if (campos[1] === 'A170' && campos.length > 4) {
            const codServico = campos[4]?.trim();
            if (codServico && codServico.length >= 4) {
              nbsSet.add(codServico);
            }
          }

          // SPED Fiscal - Registro 0200 (Cadastro de Itens) - NCM no campo 8
          if (campos[1] === '0200' && campos.length > 8) {
            const ncm = campos[8]?.trim();
            if (ncm && ncm.length >= 4) {
              ncms.add(ncm);
            }
          }

          // SPED Fiscal - Registro C170 (Itens do Documento) - NCM no campo 13
          if (campos[1] === 'C170' && campos.length > 13) {
            const ncm = campos[13]?.trim();
            if (ncm && ncm.length >= 4) {
              ncms.add(ncm);
            }
          }

          // SPED Contribuições - Registro M400 (CST de Serviço)
          if (campos[1] === 'M400' && campos.length > 3) {
            const codServico = campos[3]?.trim();
            if (codServico && codServico.length >= 4) {
              nbsSet.add(codServico);
            }
          }
        }

        const novosResultados: ResultadoAnalise[] = [];

        // Processar NCMs
        for (const ncm of ncms) {
          const resultado = analisarNCM(ncm, anoSelecionado);
          novosResultados.push(resultado);
        }

        // Processar NBS/Códigos de Serviço
        for (const nbs of nbsSet) {
          const nbsEncontrado = buscarNBS(nbs);
          if (nbsEncontrado) {
            const resultado = criarResultadoNBS(nbsEncontrado, 0);
            novosResultados.push(resultado);
          } else {
            const resultado = analisarNBS(nbs, anoSelecionado, null);
            novosResultados.push(resultado);
          }
        }

        if (novosResultados.length > 0) {
          setProcessedData(prev => [...prev, ...novosResultados]);
          toast({ 
            title: `SPED importado com sucesso!`,
            description: `${ncms.size} NCM(s) e ${nbsSet.size} código(s) de serviço encontrados.`
          });
        } else {
          toast({ title: 'Nenhum NCM ou código de serviço encontrado no arquivo SPED', variant: 'destructive' });
        }
      } catch (error) {
        toast({ title: 'Erro ao processar arquivo SPED', variant: 'destructive' });
      }
    };
    reader.readAsText(file);
    if (event.target) event.target.value = '';
  };

  const exportarPesquisaExcel = () => {
    if (processedData.length === 0) {
      toast({ title: 'Nenhum dado para exportar', variant: 'destructive' });
      return;
    }

    const dadosExport = processedData.map(item => ({
      Codigo: item.codigo,
      Status: item.validez === 'ok' ? 'OK' : item.validez === 'atencao' ? 'ATENÇÃO' : 'ERRO',
      Regime: item.regime,
      Anexo: item.anexo,
      ClassTrib: item.classtrib,
      CST_IBS: item.cst_ibs,
      CST_CBS: item.cst_cbs,
      IBS_Efetiva: `${item.ibsEfetiva}%`,
      CBS_Efetiva: `${item.cbsEfetiva}%`,
      Imposto_Seletivo: item.impostoSeletivo
    }));

    const ws = XLSX.utils.json_to_sheet(dadosExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Análise NCM-NBS');
    XLSX.writeFile(wb, `analise_${tipoCodigo}_${anoSelecionado}.xlsx`);
    toast({ title: 'Excel exportado com sucesso!' });
  };

  // Importação de planilha LC 116/2003 para análise e conversão para NBS
  const handleUploadLC116Excel = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Ler sem cabeçalho (header: 1 retorna array de arrays)
        const rawData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

        const itensComMultiplosNBS: ItemLC116ComMultiplosNBS[] = [];
        const dadosPendentes: Array<{ codigoLC116: string; descricaoLC116: string; nbsDisponiveis: NBSProcessado[] }> = [];
        let codigosNaoEncontrados = 0;
        let codigosProcessados = 0;
        
        // Processar dados
        for (let i = 0; i < rawData.length; i++) {
          const row = rawData[i];
          if (!row || row.length === 0) continue;
          
          const primeiraColuna = String(row[0] || '').trim();
          const segundaColuna = String(row[1] || '').trim();
          
          // Verificar se parece com código LC 116 (formato: XX.XX ou X.XX)
          if (!/^\d{1,2}\.\d{2}$/.test(primeiraColuna)) continue;
          
          const codigoLC116 = primeiraColuna;
          const descricaoLC116 = segundaColuna;
          codigosProcessados++;

          // Buscar NBS correspondentes ao código LC 116
          const nbsEncontrados = buscarNBSPorLC116(codigoLC116);
          
          if (nbsEncontrados.length === 0) {
            codigosNaoEncontrados++;
            // Salvar mesmo sem NBS encontrado
            dadosPendentes.push({ codigoLC116, descricaoLC116, nbsDisponiveis: [] });
            continue;
          }
          
          // Se tem múltiplos NBS, adicionar para seleção
          if (nbsEncontrados.length > 1) {
            itensComMultiplosNBS.push({
              codigoLC116,
              descricaoLC116,
              nbsDisponiveis: nbsEncontrados.map(nbs => ({
                nbs: nbs.nbs,
                descricao: nbs.descricao
              }))
            });
          }
          
          dadosPendentes.push({ codigoLC116, descricaoLC116, nbsDisponiveis: nbsEncontrados });
        }

        console.log(`Total processados: ${codigosProcessados}, Com múltiplos NBS: ${itensComMultiplosNBS.length}, Não encontrados: ${codigosNaoEncontrados}`);

        // Se há itens com múltiplos NBS, abrir modal de seleção
        if (itensComMultiplosNBS.length > 0) {
          setItensLC116ParaSelecao(itensComMultiplosNBS);
          setDadosLC116Pendentes(dadosPendentes);
          setModalNBSUploadAberto(true);
          if (codigosNaoEncontrados > 0) {
            toast({ 
              title: `${codigosNaoEncontrados} código(s) LC 116 não encontrado(s)`,
              variant: 'destructive'
            });
          }
        } else {
          // Processar diretamente
          processarLC116Selecionados(dadosPendentes, null);
        }
      } catch (error) {
        console.error('Erro ao processar:', error);
        toast({ title: 'Erro ao processar arquivo Excel', variant: 'destructive' });
      }
    };
    reader.readAsArrayBuffer(file);
    if (event.target) event.target.value = '';
  };

  // Processar LC 116 após seleção de NBS
  const processarLC116Selecionados = (
    dados: Array<{ codigoLC116: string; descricaoLC116: string; nbsDisponiveis: NBSProcessado[] }>,
    selecoesNBS: Map<string, string[]> | null
  ) => {
    const novosResultados: ResultadoAnalise[] = [];
    const dadosOriginais: Array<{ codigoLC116: string; descricaoLC116: string }> = [];
    const itensComMultiplasClasstrib: ItemComMultiplasOpcoes[] = [];
    
    for (const item of dados) {
      if (item.nbsDisponiveis.length === 0) {
        // NBS não encontrado
        dadosOriginais.push({ codigoLC116: item.codigoLC116, descricaoLC116: item.descricaoLC116 });
        novosResultados.push({
          codigo: '-',
          validez: 'invalido',
          mensagem: `LC 116 ${item.codigoLC116} não encontrado na base`,
          regime: '-',
          anexo: '-',
          classtrib: '-',
          cst_ibs: '-',
          cst_cbs: '-',
          ibsBase: '-',
          cbsBase: '-',
          reducao_ibs: '-',
          reducao_cbs: '-',
          ibsEfetiva: '-',
          cbsEfetiva: '-',
          impostoSeletivo: 'NÃO',
          cst_is: '-',
          classtrib_is: '-',
          aliquota_is: '-',
          anexo_is: '-'
        });
        continue;
      }
      
      // Determinar quais NBS usar
      let nbsParaProcessar = item.nbsDisponiveis;
      if (selecoesNBS && selecoesNBS.has(item.codigoLC116)) {
        const nbsSelecionados = selecoesNBS.get(item.codigoLC116) || [];
        nbsParaProcessar = item.nbsDisponiveis.filter(nbs => nbsSelecionados.includes(nbs.nbs));
      }
      
      for (const nbsInfo of nbsParaProcessar) {
        dadosOriginais.push({ codigoLC116: item.codigoLC116, descricaoLC116: item.descricaoLC116 });
        
        if (nbsInfo.opcoes.length > 1) {
          const jaExiste = itensComMultiplasClasstrib.some(i => i.codigo === nbsInfo.nbs);
          if (!jaExiste) {
            itensComMultiplasClasstrib.push({
              codigo: nbsInfo.nbs,
              descricao: nbsInfo.descricao,
              tipo: 'NBS',
              indice: dadosOriginais.length - 1,
              opcoes: nbsInfo.opcoes.map(o => ({
                classtrib: o.classtrib,
                nomeClasstrib: o.nomeClasstrib,
                indop: o.indop
              }))
            });
          }
        } else {
          const resultado = criarResultadoNBS(nbsInfo, 0);
          novosResultados.push(resultado);
        }
      }
    }
    
    // Salvar dados originais
    setDadosOriginaisLC116(dadosOriginais);
    
    if (itensComMultiplasClasstrib.length > 0) {
      setItensParaSelecao(itensComMultiplasClasstrib);
      setResultadosPendentes(novosResultados);
      setModalUploadAberto(true);
    } else if (novosResultados.length > 0) {
      setProcessedData(prev => [...prev, ...novosResultados]);
      toast({ title: `${novosResultados.length} linha(s) processada(s)!` });
    } else {
      toast({ title: 'Nenhum código LC 116 válido encontrado', variant: 'destructive' });
    }
  };

  // Handler para confirmação de seleção de NBS
  const handleConfirmarSelecaoNBS = (selecoes: Map<string, string[]>) => {
    setModalNBSUploadAberto(false);
    processarLC116Selecionados(dadosLC116Pendentes, selecoes);
    setItensLC116ParaSelecao([]);
    setDadosLC116Pendentes([]);
  };

  // Exportar análise NBS em formato específico (com dados originais da LC 116)
  const exportarNBSExcel = () => {
    if (processedData.length === 0) {
      toast({ title: 'Nenhum dado para exportar', variant: 'destructive' });
      return;
    }

    const dadosExport = processedData.map((item, index) => {
      const dadoOriginal = dadosOriginaisLC116[index] || { codigoLC116: '', descricaoLC116: '' };
      return {
        'Item LC 116': dadoOriginal.codigoLC116 || '-',
        'Descrição LC 116': dadoOriginal.descricaoLC116 || '-',
        'NBS': item.codigo,
        'Descrição do NBS': item.mensagem || '-',
        'CST IBS': item.cst_ibs || '-',
        'CST CBS': item.cst_cbs || '-',
        'ClassTrib': item.classtrib || '-',
        'Alíquota Efetiva IBS (%)': item.ibsEfetiva || '0',
        'Alíquota Efetiva CBS (%)': item.cbsEfetiva || '0',
        'Alíquota Padrão IBS (%)': item.ibsBase || aliquotasEfetivas.ibs.toFixed(2),
        'Alíquota Padrão CBS (%)': item.cbsBase || aliquotasEfetivas.cbs.toFixed(2)
      };
    });

    const ws = XLSX.utils.json_to_sheet(dadosExport);
    
    // Ajustar largura das colunas
    ws['!cols'] = [
      { wch: 12 },  // Item LC 116
      { wch: 50 },  // Descrição LC 116
      { wch: 15 },  // NBS
      { wch: 50 },  // Descrição NBS
      { wch: 10 },  // CST IBS
      { wch: 10 },  // CST CBS
      { wch: 12 },  // ClassTrib
      { wch: 22 },  // Alíquota Efetiva IBS
      { wch: 22 },  // Alíquota Efetiva CBS
      { wch: 22 },  // Alíquota Padrão IBS
      { wch: 22 },  // Alíquota Padrão CBS
    ];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Análise LC116-NBS');
    XLSX.writeFile(wb, `analise_lc116_nbs_${anoSelecionado}.xlsx`);
    toast({ title: 'Excel exportado com sucesso!' });
  };

  const getStatusColor = (validez: string) => {
    switch (validez) {
      case 'ok': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'atencao': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'invalido': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header with Logo */}
        <div className="flex items-center justify-between">
          <div className="text-center flex-1 space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">
              Analisador da Reforma Tributária
            </h1>
            <p className="text-muted-foreground">
              LC 214/2025 - Análise de NCM, NBS, Cálculos e Simulações
            </p>
          </div>
          <img 
            src={logoEcon} 
            alt="Econ Escritório Contábil" 
            className="h-16 object-contain hidden md:block"
          />
        </div>

        {/* Seletor de Módulo */}
        <Card className="border-primary/30">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
              <Button
                variant={modulo === 'pesquisa' ? 'default' : 'outline'}
                className="h-auto py-4 flex-col gap-1"
                onClick={() => setModulo('pesquisa')}
              >
                <Search className="h-6 w-6" />
                <span className="font-bold">Pesquisa</span>
                <span className="text-xs opacity-80">NCM, NBS e Imóveis</span>
              </Button>
              <Button
                variant={modulo === 'calculo' ? 'default' : 'outline'}
                className="h-auto py-4 flex-col gap-1"
                onClick={() => setModulo('calculo')}
              >
                <Building2 className="h-6 w-6" />
                <span className="font-bold">Lucro Presumido</span>
                <span className="text-xs opacity-80">Cálculo Trimestral</span>
              </Button>
              <Button
                variant={modulo === 'simples' ? 'default' : 'outline'}
                className="h-auto py-4 flex-col gap-1"
                onClick={() => setModulo('simples')}
              >
                <Store className="h-6 w-6" />
                <span className="font-bold">Simples Nacional</span>
                <span className="text-xs opacity-80">Cálculo do DAS</span>
              </Button>
              <Button
                variant={modulo === 'imobiliario' ? 'default' : 'outline'}
                className="h-auto py-4 flex-col gap-1"
                onClick={() => setModulo('imobiliario')}
              >
                <Building className="h-6 w-6" />
                <span className="font-bold">Op. Imobiliárias</span>
                <span className="text-xs opacity-80">Venda, RET e Locação</span>
              </Button>
              <Button
                variant={modulo === 'transicao' ? 'default' : 'outline'}
                className="h-auto py-4 flex-col gap-1"
                onClick={() => setModulo('transicao')}
              >
                <TrendingUp className="h-6 w-6" />
                <span className="font-bold">Transição</span>
                <span className="text-xs opacity-80">2026 – 2033</span>
              </Button>
              <Button
                variant={modulo === 'relatorio' ? 'default' : 'outline'}
                className="h-auto py-4 flex-col gap-1"
                onClick={() => setModulo('relatorio')}
              >
                <FileText className="h-6 w-6" />
                <span className="font-bold">Relatório</span>
                <span className="text-xs opacity-80">Consolidado PDF</span>
              </Button>
              <Button
                variant={modulo === 'comparativo' ? 'default' : 'outline'}
                className="h-auto py-4 flex-col gap-1"
                onClick={() => setModulo('comparativo')}
              >
                <Scale className="h-6 w-6" />
                <span className="font-bold">Comparativo</span>
                <span className="text-xs opacity-80">Análise de regimes</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Seletor de Ano */}
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-primary" />
              Ano de Referência
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={anoSelecionado.toString()} onValueChange={(v) => setAnoSelecionado(Number(v))}>
              <SelectTrigger className="w-full md:w-96">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PERIODO_TRANSICAO).map(([ano, dados]) => (
                  <SelectItem key={ano} value={ano}>
                    {ano} - {dados.fase} ({dados.descricao})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Alíquotas do Ano */}
        <div className="flex items-center gap-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
            <Card className={`border-blue-500/30 bg-blue-500/5 ${aliquotasCustom.ibsRef !== 17.70 ? 'ring-1 ring-purple-400' : ''}`}>
              <CardContent className="p-4 text-center">
                <p className="text-xs font-semibold text-blue-500">IBS{aliquotasCustom.ibsRef !== 17.70 ? ' ✏' : ''}</p>
                <p className="text-2xl font-bold text-blue-500">{aliquotasEfetivas.ibs.toFixed(2)}%</p>
              </CardContent>
            </Card>
            <Card className={`border-emerald-500/30 bg-emerald-500/5 ${aliquotasCustom.cbsRef !== 8.80 ? 'ring-1 ring-purple-400' : ''}`}>
              <CardContent className="p-4 text-center">
                <p className="text-xs font-semibold text-emerald-500">CBS{aliquotasCustom.cbsRef !== 8.80 ? ' ✏' : ''}</p>
                <p className="text-2xl font-bold text-emerald-500">{aliquotasEfetivas.cbs.toFixed(2)}%</p>
              </CardContent>
            </Card>
            <Card className="border-orange-500/30 bg-orange-500/5">
              <CardContent className="p-4 text-center">
                <p className="text-xs font-semibold text-orange-500">ICMS</p>
                <p className="text-2xl font-bold text-orange-500">{aliquotasEfetivas.icms}%</p>
              </CardContent>
            </Card>
            <Card className="border-purple-500/30 bg-purple-500/5">
              <CardContent className="p-4 text-center">
                <p className="text-xs font-semibold text-purple-500">ISS</p>
                <p className="text-2xl font-bold text-purple-500">{aliquotasEfetivas.iss}%</p>
              </CardContent>
            </Card>
          </div>
          <button
            onClick={() => { setDraftIBS(String(aliquotasCustom.ibsRef)); setDraftCBS(String(aliquotasCustom.cbsRef)); setAliqOpen(true); }}
            className="p-2 rounded-lg border border-border hover:bg-muted transition-colors self-stretch flex items-center"
            title="Editar alíquotas de referência IBS/CBS"
          >
            <Settings2 className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Conteúdo do Módulo */}
        {modulo === 'pesquisa' && (
          <>
            {/* Tipo de Análise */}
            <Card>
              <CardHeader>
                <CardTitle>Tipo de Análise</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button
                    variant={tipoCodigo === 'NCM' ? 'default' : 'outline'}
                    className="h-auto py-4 flex-col gap-1"
                    onClick={() => { setTipoCodigo('NCM'); setProcessedData([]); setResultadosBusca([]); }}
                  >
                    <Package className="h-6 w-6" />
                    <span className="font-bold">NCM</span>
                    <span className="text-xs opacity-80">Produtos</span>
                  </Button>
                  <Button
                    variant={tipoCodigo === 'NBS' ? 'default' : 'outline'}
                    className="h-auto py-4 flex-col gap-1"
                    onClick={() => { setTipoCodigo('NBS'); setProcessedData([]); setResultadosBusca([]); }}
                  >
                    <Briefcase className="h-6 w-6" />
                    <span className="font-bold">NBS</span>
                    <span className="text-xs opacity-80">Serviços</span>
                  </Button>
                  <Button
                    variant={tipoCodigo === 'IMOVEL' ? 'default' : 'outline'}
                    className="h-auto py-4 flex-col gap-1"
                    onClick={() => { setTipoCodigo('IMOVEL'); setProcessedData([]); setResultadosBusca([]); }}
                  >
                    <Home className="h-6 w-6" />
                    <span className="font-bold">Imóveis</span>
                    <span className="text-xs opacity-80">Operações Imobiliárias</span>
                  </Button>
                </div>

                {tipoCodigo === 'IMOVEL' && (
                  <div className="mt-4">
                    <Label>Tipo de Operação</Label>
                    <Select value={tipoOperacaoImovel} onValueChange={setTipoOperacaoImovel}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(OPERACOES_IMOBILIARIAS).map(([key, op]) => (
                          <SelectItem key={key} value={key}>{op.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pesquisa */}
            <Card className="border-amber-500/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-amber-500" />
                  Pesquisar {tipoCodigo === 'IMOVEL' ? 'Operação' : `por Código ou Descrição (${tipoCodigo})`}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Input
                    value={codigoPesquisa}
                    onChange={(e) => setCodigoPesquisa(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && pesquisarCodigo()}
                    placeholder={tipoCodigo === 'NCM' ? 'Ex: 0401.10.10 ou "leite"' : tipoCodigo === 'NBS' ? 'Ex: 1.2201.11.00 ou "educação"' : 'Clique em pesquisar'}
                    className="flex-1 min-w-48 font-mono"
                  />
                  <Button onClick={pesquisarCodigo} className="gap-2">
                    <Search className="h-4 w-4" />
                    Pesquisar
                  </Button>
                  
                  {tipoCodigo !== 'IMOVEL' && (
                    <>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleUploadExcel}
                        accept=".xlsx,.xls,.csv"
                        className="hidden"
                      />
                      <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
                        <Upload className="h-4 w-4" />
                        Importar Excel
                      </Button>
                      
                      <input
                        type="file"
                        ref={spedInputRef}
                        onChange={handleUploadSPED}
                        accept=".txt"
                        className="hidden"
                      />
                      <Button variant="outline" onClick={() => spedInputRef.current?.click()} className="gap-2">
                        <FileCode className="h-4 w-4" />
                        Importar SPED
                      </Button>
                      
                      {tipoCodigo === 'NBS' && (
                        <>
                          <input
                            type="file"
                            ref={lc116FileInputRef}
                            onChange={handleUploadLC116Excel}
                            accept=".xlsx,.xls,.csv"
                            className="hidden"
                          />
                          <Button variant="secondary" onClick={() => lc116FileInputRef.current?.click()} className="gap-2">
                            <FileSpreadsheet className="h-4 w-4" />
                            Importar LC 116
                          </Button>
                        </>
                      )}
                    </>
                  )}
                  
                  {processedData.length > 0 && (
                    <>
                      <Button variant="outline" onClick={exportarPesquisaExcel} className="gap-2">
                        <Download className="h-4 w-4" />
                        Exportar
                      </Button>
                      {tipoCodigo === 'NBS' && (
                        <Button variant="secondary" onClick={exportarNBSExcel} className="gap-2">
                          <FileSpreadsheet className="h-4 w-4" />
                          Exportar NBS Detalhado
                        </Button>
                      )}
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          relatorioRef.current?.adicionarDados({
                            tipo: 'pesquisa',
                            titulo: `Pesquisa ${tipoCodigo} - ${anoSelecionado}`,
                            dados: processedData,
                            dataHora: new Date().toLocaleString('pt-BR')
                          });
                        }} 
                        className="gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Adicionar ao Relatório
                      </Button>
                      <Button variant="destructive" onClick={limparResultados}>
                        Limpar
                      </Button>
                    </>
                  )}
                </div>

                {/* Dica de importação SPED */}
                <Alert className="border-blue-500/30 bg-blue-500/5">
                  <Info className="h-4 w-4 text-blue-500" />
                  <AlertDescription className="text-sm">
                    <strong>Importar SPED:</strong> Você pode importar arquivos do SPED Contribuições ou SPED Fiscal (.txt) 
                    para extrair automaticamente os NCMs e códigos de serviços.
                  </AlertDescription>
                </Alert>

                {/* Resultados da Busca por Descrição */}
                {resultadosBusca.length > 0 && (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    <p className="text-sm font-medium">Resultados encontrados ({resultadosBusca.length}):</p>
                    {resultadosBusca.map((item, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                        onClick={() => adicionarDaBusca(item.codigo)}
                      >
                        <div>
                          <span className="font-mono font-medium">{item.codigo}</span>
                          <p className="text-sm text-muted-foreground">{item.nome}</p>
                        </div>
                        <Badge variant="outline">Anexo {item.anexo}</Badge>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tabela de Resultados */}
                {processedData.length > 0 && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Regime</TableHead>
                          <TableHead>Anexo</TableHead>
                          <TableHead>ClassTrib</TableHead>
                          <TableHead>CST IBS</TableHead>
                          <TableHead>CST CBS</TableHead>
                          <TableHead className="text-right">IBS</TableHead>
                          <TableHead className="text-right">CBS</TableHead>
                          <TableHead>Seletivo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {processedData.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono">{item.codigo}</TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(item.validez)}>
                                {item.validez === 'ok' ? 'OK' : item.validez === 'atencao' ? 'ATENÇÃO' : 'ERRO'}
                              </Badge>
                            </TableCell>
                            <TableCell>{item.regime}</TableCell>
                            <TableCell>{item.anexo}</TableCell>
                            <TableCell className="font-mono">{item.classtrib}</TableCell>
                            <TableCell className="font-mono">{item.cst_ibs}</TableCell>
                            <TableCell className="font-mono">{item.cst_cbs}</TableCell>
                            <TableCell className="text-right font-mono">{Number(item.ibsEfetiva).toFixed(2)}%</TableCell>
                            <TableCell className="text-right font-mono">{Number(item.cbsEfetiva).toFixed(2)}%</TableCell>
                            <TableCell>
                              {item.impostoSeletivo ? (
                                <Badge variant="destructive">{item.impostoSeletivo}</Badge>
                              ) : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {modulo === 'calculo' && (
          <CalculoLucroPresumido 
            anoSelecionado={anoSelecionado} 
            onExportarParaComparativo={handleExportarPresumidoParaComparativo}
            onAdicionarAoRelatorio={(dados) => relatorioRef.current?.adicionarDados(dados)}
          />
        )}
        {modulo === 'simples' && (
          <CalculoSimplesNacional 
            anoSelecionado={anoSelecionado} 
            onExportarParaComparativo={handleExportarSimplesParaComparativo}
            onAdicionarAoRelatorio={(dados) => relatorioRef.current?.adicionarDados(dados)}
          />
        )}
        {modulo === 'imobiliario' && (
          <CalculoOperacoesImobiliarias 
            anoSelecionado={anoSelecionado}
            onAdicionarAoRelatorio={(dados) => relatorioRef.current?.adicionarDados(dados)}
          />
        )}
        {modulo === 'transicao' && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Cronograma de Transição — 2026 a 2033
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  EC 132/2023 · LC 214/2025 · Decreto 12955/2026 (Regulamento CBS)
                </p>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-wide border">Ano</th>
                      <th className="text-center px-3 py-2.5 text-xs font-semibold uppercase tracking-wide border text-blue-600">IBS (%)</th>
                      <th className="text-center px-3 py-2.5 text-xs font-semibold uppercase tracking-wide border text-emerald-600">CBS (%)</th>
                      <th className="text-center px-3 py-2.5 text-xs font-semibold uppercase tracking-wide border text-primary">IBS+CBS (%)</th>
                      <th className="text-center px-3 py-2.5 text-xs font-semibold uppercase tracking-wide border text-orange-600">ICMS/ISS (%)</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-wide border">Fase</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-wide border">Descrição</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(PERIODO_TRANSICAO).map(([ano, dados]) => {
                      const isAtual = Number(ano) === anoSelecionado;
                      return (
                        <tr
                          key={ano}
                          className={`border-b cursor-pointer transition-colors ${isAtual ? 'bg-primary/10 font-semibold' : 'hover:bg-muted/30'}`}
                          onClick={() => setAnoSelecionado(Number(ano))}
                        >
                          <td className="px-3 py-2 border font-bold">{ano}</td>
                          <td className="px-3 py-2 border text-center text-blue-600">{dados.ibs.toFixed(2)}</td>
                          <td className="px-3 py-2 border text-center text-emerald-600">{dados.cbs.toFixed(2)}</td>
                          <td className="px-3 py-2 border text-center font-bold text-primary">{(dados.ibs + dados.cbs).toFixed(2)}</td>
                          <td className="px-3 py-2 border text-center text-orange-600">{dados.icms}</td>
                          <td className="px-3 py-2 border">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                              dados.fase === 'Plena' ? 'bg-green-100 text-green-800' :
                              dados.fase === 'Teste' ? 'bg-blue-100 text-blue-800' :
                              dados.fase === 'CBS Plena' ? 'bg-emerald-100 text-emerald-800' :
                              'bg-amber-100 text-amber-800'
                            }`}>{dados.fase}</span>
                          </td>
                          <td className="px-3 py-2 border text-xs text-muted-foreground">{dados.descricao}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="text-[10px] text-muted-foreground mt-2">
                  Clique em uma linha para selecionar o ano de referência. IBS (Imposto sobre Bens e Serviços) · CBS (Contribuição sobre Bens e Serviços).
                </p>
              </CardContent>
            </Card>

            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex-1">
                  <p className="font-semibold text-sm">Comparativo completo de regimes tributários</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Para comparar Simples Nacional, Lucro Presumido e Lucro Real com cálculo mensal detalhado,
                    acesse o <strong>Comparativo Tributário</strong>.
                  </p>
                </div>
                <Button
                  size="sm"
                  className="gap-1.5 shrink-0"
                  onClick={() => { setModulo('comparativo'); setComparativoView('editor'); setComparativoId(undefined); }}
                >
                  Acessar <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
        {/* RelatorioConsolidado sempre renderizado para manter a ref ativa */}
        <div className={modulo === 'relatorio' ? '' : 'hidden'}>
          <RelatorioConsolidado
            ref={relatorioRef}
            anoSelecionado={anoSelecionado}
          />
        </div>

        {/* Comparativo de Regimes */}
        {modulo === 'comparativo' && (
          comparativoView === 'editor'
            ? (
              <SimulationEditorCore
                id={comparativoId}
                embeddedMode={true}
                onBack={() => setComparativoView('list')}
                onAfterSave={(id) => setComparativoId(id)}
              />
            )
            : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Comparativo de Regimes</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Compare Simples Nacional, Lucro Presumido e Lucro Real com cálculo mensal detalhado.
                    </p>
                  </div>
                  <Button
                    onClick={() => { setComparativoId(undefined); setComparativoView('editor'); }}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Nova Simulação
                  </Button>
                </div>

                {simsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  </div>
                ) : simsList.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Scale className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">Nenhuma simulação salva</p>
                    <p className="text-sm mt-1">Crie sua primeira simulação para comparar os regimes tributários.</p>
                    <Button
                      className="mt-4 gap-2"
                      onClick={() => { setComparativoId(undefined); setComparativoView('editor'); }}
                    >
                      <Plus className="h-4 w-4" /> Nova Simulação
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-md border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">Nome</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide">Ano</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide hidden md:table-cell">Atualizado</th>
                          <th className="px-4 py-2.5"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {simsList.map((sim) => (
                          <tr key={sim.id} className="border-t hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-2.5 font-medium">{sim.name || 'Sem nome'}</td>
                            <td className="px-4 py-2.5 text-muted-foreground">{sim.year}</td>
                            <td className="px-4 py-2.5 text-muted-foreground text-xs hidden md:table-cell">
                              {sim.updatedAt ? new Date(sim.updatedAt).toLocaleDateString('pt-BR') : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setComparativoId(sim.id); setComparativoView('editor'); }}
                              >
                                Abrir
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
        )}

        {/* Dialog de alíquotas editáveis */}
        <Dialog open={aliqOpen} onOpenChange={setAliqOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" /> Alíquotas de Referência
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-xs text-muted-foreground">
                Ajuste as alíquotas de referência para 2033. Os valores dos anos de transição serão recalculados proporcionalmente.
              </p>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">IBS referência (%) — padrão: 17,70</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={draftIBS}
                  onChange={(e) => setDraftIBS(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">CBS referência (%) — padrão: 8,80</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={draftCBS}
                  onChange={(e) => setDraftCBS(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setDraftIBS('17.70'); setDraftCBS('8.80'); setAliquotasCustom({ ...aliquotasCustom, ibsRef: 17.70, cbsRef: 8.80 }); setAliqOpen(false); }}
              >
                Restaurar padrões
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const ibs = parseFloat(draftIBS.replace(',', '.'));
                  const cbs = parseFloat(draftCBS.replace(',', '.'));
                  if (isNaN(ibs) || isNaN(cbs) || ibs <= 0 || cbs <= 0) return;
                  setAliquotasCustom({ ...aliquotasCustom, ibsRef: ibs, cbsRef: cbs });
                  setAliqOpen(false);
                }}
              >
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de seleção NBS para pesquisa individual */}
        {nbsParaSelecao && (
          <ModalSelecaoClassTrib
            aberto={modalNBSAberto}
            onClose={() => {
              setModalNBSAberto(false);
              setNbsParaSelecao(null);
            }}
            onSelecionar={handleSelecaoNBS}
            codigo={nbsParaSelecao.nbs}
            descricao={nbsParaSelecao.descricao}
            opcoes={nbsParaSelecao.opcoes.map(o => ({
              classtrib: o.classtrib,
              nomeClasstrib: o.nomeClasstrib,
              indop: o.indop
            }))}
          />
        )}

        {/* Modal de seleção cClassTrib para upload */}
        <ModalSelecaoClassTribUpload
          aberto={modalUploadAberto}
          itens={itensParaSelecao}
          onConfirmar={handleConfirmarSelecoesUpload}
          onCancelar={() => {
            setModalUploadAberto(false);
            setItensParaSelecao([]);
            setResultadosPendentes([]);
          }}
        />

        {/* Modal de seleção de NBS para LC 116 com múltiplos NBS */}
        <ModalSelecaoNBSUpload
          aberto={modalNBSUploadAberto}
          itens={itensLC116ParaSelecao}
          onConfirmar={handleConfirmarSelecaoNBS}
          onCancelar={() => {
            setModalNBSUploadAberto(false);
            setItensLC116ParaSelecao([]);
            setDadosLC116Pendentes([]);
          }}
        />
      </div>
    </div>
  );
};

export default TaxAnalyzerDashboard;
