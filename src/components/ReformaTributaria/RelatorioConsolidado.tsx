import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { FileText, Download, Printer, Building2, Store, Building, Scale, Search, Plus, Trash2, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PERIODO_TRANSICAO } from '@/constants/tax-tables';

import logoEcon from '@/assets/logo-econ.png';

interface DadosModulo {
  tipo: 'pesquisa' | 'simples' | 'presumido' | 'imobiliario' | 'comparativo';
  titulo: string;
  dados: any;
  dataHora: string;
}

interface Props {
  anoSelecionado: number;
}

export interface RelatorioConsolidadoRef {
  adicionarDados: (dados: DadosModulo) => void;
}

const RelatorioConsolidado = forwardRef<RelatorioConsolidadoRef, Props>(({ anoSelecionado }, ref) => {
  const [dadosRelatorio, setDadosRelatorio] = useState<DadosModulo[]>([]);
  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const aliquotas = PERIODO_TRANSICAO[anoSelecionado] || PERIODO_TRANSICAO[2033];

  useImperativeHandle(ref, () => ({
    adicionarDados: (dados: DadosModulo) => {
      setDadosRelatorio(prev => [...prev, dados]);
      toast({ title: `Dados de ${dados.titulo} adicionados ao relatório!` });
    }
  }));

  const removerDados = (index: number) => {
    setDadosRelatorio(prev => prev.filter((_, i) => i !== index));
    toast({ title: 'Dados removidos do relatório' });
  };

  const limparRelatorio = () => {
    setDadosRelatorio([]);
    setNomeEmpresa('');
    setCnpj('');
    setObservacoes('');
    toast({ title: 'Relatório limpo' });
  };

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  };

  const formatarCNPJ = (valor: string) => {
    const numeros = valor.replace(/\D/g, '');
    return numeros
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .substring(0, 18);
  };

  const renderizarDadosPesquisa = (dados: any) => {
    if (!dados || dados.length === 0) return null;
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Anexo</TableHead>
            <TableHead>ClassTrib</TableHead>
            <TableHead>CST IBS</TableHead>
            <TableHead>CST CBS</TableHead>
            <TableHead className="text-right">IBS</TableHead>
            <TableHead className="text-right">CBS</TableHead>
            <TableHead>IS</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dados.map((item: any, idx: number) => (
            <TableRow key={idx}>
              <TableCell className="font-mono">{item.codigo}</TableCell>
              <TableCell>
                <Badge variant={item.validez === 'ok' ? 'default' : 'destructive'}>
                  {item.validez === 'ok' ? 'OK' : 'ATENÇÃO'}
                </Badge>
              </TableCell>
              <TableCell>{item.anexo || '-'}</TableCell>
              <TableCell className="font-mono">{item.classtrib || '-'}</TableCell>
              <TableCell className="font-mono">{item.cst_ibs || '-'}</TableCell>
              <TableCell className="font-mono">{item.cst_cbs || '-'}</TableCell>
              <TableCell className="text-right">{item.ibsEfetiva}%</TableCell>
              <TableCell className="text-right">{item.cbsEfetiva}%</TableCell>
              <TableCell>{item.impostoSeletivo || 'NÃO'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  const renderizarDadosSimples = (dados: any) => {
    if (!dados) return null;
    const { resultados, fatorR, rbt12, modoCalculo, resultadosMensais } = dados;
    
    if (modoCalculo === 'mensal' && resultadosMensais) {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-xs text-muted-foreground">RBT12</p>
              <p className="font-bold">{formatarMoeda(dados.rbt12 || 0)}</p>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-xs text-muted-foreground">Folha Pagamento</p>
              <p className="font-bold">{formatarMoeda(dados.folhaPagamento || 0)}</p>
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-xs text-muted-foreground">Fator R</p>
              <p className="font-bold">{fatorR ? `${(fatorR * 100).toFixed(2)}%` : 'N/A'}</p>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead>Anexo</TableHead>
                <TableHead className="text-right">Faturamento</TableHead>
                <TableHead className="text-right">Alíq. Efetiva</TableHead>
                <TableHead className="text-right">DAS</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resultadosMensais.flatMap((mes: any, mIdx: number) =>
                mes.resultados.map((r: any, rIdx: number) => (
                  <TableRow key={`${mIdx}-${rIdx}`}>
                    <TableCell>{mes.nome}</TableCell>
                    <TableCell>{r.nomeAnexo}</TableCell>
                    <TableCell className="text-right">{formatarMoeda(r.faturamento)}</TableCell>
                    <TableCell className="text-right">{r.aliquotaEfetiva.toFixed(2)}%</TableCell>
                    <TableCell className="text-right">{formatarMoeda(r.valorImposto)}</TableCell>
                    <TableCell className="text-right font-bold">{formatarMoeda(r.totalTributos)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      );
    }
    
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-muted p-3 rounded-lg">
            <p className="text-xs text-muted-foreground">RBT12</p>
            <p className="font-bold">{formatarMoeda(rbt12 || 0)}</p>
          </div>
          <div className="bg-muted p-3 rounded-lg">
            <p className="text-xs text-muted-foreground">Folha Pagamento</p>
            <p className="font-bold">{formatarMoeda(dados.folhaPagamento || 0)}</p>
          </div>
          <div className="bg-muted p-3 rounded-lg">
            <p className="text-xs text-muted-foreground">Fator R</p>
            <p className="font-bold">{fatorR ? `${(fatorR * 100).toFixed(2)}%` : 'N/A'}</p>
          </div>
        </div>
        {resultados && resultados.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Anexo</TableHead>
                <TableHead className="text-right">Faturamento</TableHead>
                <TableHead className="text-right">Alíq. Efetiva</TableHead>
                <TableHead className="text-right">DAS</TableHead>
                <TableHead className="text-right">IBS/CBS</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resultados.map((r: any, idx: number) => (
                <TableRow key={idx}>
                  <TableCell>{r.nomeAnexo}</TableCell>
                  <TableCell className="text-right">{formatarMoeda(r.faturamento)}</TableCell>
                  <TableCell className="text-right">{r.aliquotaEfetiva.toFixed(2)}%</TableCell>
                  <TableCell className="text-right">{formatarMoeda(r.valorImposto)}</TableCell>
                  <TableCell className="text-right">{formatarMoeda((r.ibs || 0) + (r.cbs || 0))}</TableCell>
                  <TableCell className="text-right font-bold">{formatarMoeda(r.totalTributos)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    );
  };

  const renderizarDadosPresumido = (dados: any) => {
    if (!dados) return null;
    const { resultados, receitaTotal, periodoCalculo } = dados;
    
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-muted p-3 rounded-lg">
            <p className="text-xs text-muted-foreground">Receita Total</p>
            <p className="font-bold">{formatarMoeda(receitaTotal || 0)}</p>
          </div>
          <div className="bg-muted p-3 rounded-lg">
            <p className="text-xs text-muted-foreground">Período</p>
            <p className="font-bold">{periodoCalculo === 'anual' ? 'Anual' : periodoCalculo === 'trimestral' ? 'Trimestral' : 'Mensal'}</p>
          </div>
          <div className="bg-muted p-3 rounded-lg">
            <p className="text-xs text-muted-foreground">Tipo Atividade</p>
            <p className="font-bold">{dados.tipoAtividade || '-'}</p>
          </div>
        </div>
        {resultados && resultados.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tributo</TableHead>
                <TableHead className="text-right">Base de Cálculo</TableHead>
                <TableHead className="text-right">Alíquota</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resultados.map((r: any, idx: number) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{r.tributo}</TableCell>
                  <TableCell className="text-right">{formatarMoeda(r.base)}</TableCell>
                  <TableCell className="text-right">{r.aliquota.toFixed(2)}%</TableCell>
                  <TableCell className="text-right font-bold">{formatarMoeda(r.valor)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    );
  };

  const renderizarDadosImobiliario = (dados: any) => {
    if (!dados) return null;
    const { resultados, valorOperacao, tipoOperacao, periodoCalculo } = dados;
    
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-muted p-3 rounded-lg">
            <p className="text-xs text-muted-foreground">Valor da Operação</p>
            <p className="font-bold">{formatarMoeda(valorOperacao || 0)}</p>
          </div>
          <div className="bg-muted p-3 rounded-lg">
            <p className="text-xs text-muted-foreground">Tipo</p>
            <p className="font-bold">{tipoOperacao || '-'}</p>
          </div>
          <div className="bg-muted p-3 rounded-lg">
            <p className="text-xs text-muted-foreground">Período</p>
            <p className="font-bold">{periodoCalculo === 'anual' ? 'Anual' : 'Mensal'}</p>
          </div>
        </div>
        {resultados && resultados.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">IBS</TableHead>
                <TableHead className="text-right">CBS</TableHead>
                <TableHead className="text-right">IRPJ</TableHead>
                <TableHead className="text-right">CSLL</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resultados.map((r: any, idx: number) => (
                <TableRow key={idx}>
                  <TableCell>{r.periodo || '-'}</TableCell>
                  <TableCell className="text-right">{formatarMoeda(r.ibs || 0)}</TableCell>
                  <TableCell className="text-right">{formatarMoeda(r.cbs || 0)}</TableCell>
                  <TableCell className="text-right">{formatarMoeda(r.irpj || 0)}</TableCell>
                  <TableCell className="text-right">{formatarMoeda(r.csll || 0)}</TableCell>
                  <TableCell className="text-right font-bold">{formatarMoeda(r.total || 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    );
  };

  const renderizarDadosComparativo = (dados: any) => {
    if (!dados) return null;
    const { resultadoSelecionado, resultadosPorAno, melhorOpcao } = dados;
    
    return (
      <div className="space-y-4">
        {melhorOpcao && (
          <Alert className="border-primary/30 bg-primary/5">
            <AlertDescription>
              <strong>Melhor Opção para {anoSelecionado}:</strong> {melhorOpcao}
            </AlertDescription>
          </Alert>
        )}
        
        {resultadoSelecionado && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-500/10 p-3 rounded-lg border border-blue-500/20">
              <p className="text-xs text-blue-500">Simples Nacional</p>
              <p className="font-bold text-blue-500">{formatarMoeda(resultadoSelecionado.simples?.totalTributos || 0)}</p>
              <p className="text-xs">{resultadoSelecionado.simples?.aliquotaEfetiva?.toFixed(2) || 0}%</p>
            </div>
            <div className="bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20">
              <p className="text-xs text-emerald-500">Lucro Presumido</p>
              <p className="font-bold text-emerald-500">{formatarMoeda(resultadoSelecionado.presumido?.totalTributos || 0)}</p>
              <p className="text-xs">{resultadoSelecionado.presumido?.aliquotaEfetiva?.toFixed(2) || 0}%</p>
            </div>
            <div className="bg-orange-500/10 p-3 rounded-lg border border-orange-500/20">
              <p className="text-xs text-orange-500">Lucro Real</p>
              <p className="font-bold text-orange-500">{formatarMoeda(resultadoSelecionado.real?.totalTributos || 0)}</p>
              <p className="text-xs">{resultadoSelecionado.real?.aliquotaEfetiva?.toFixed(2) || 0}%</p>
            </div>
          </div>
        )}
        
        {resultadosPorAno && Object.keys(resultadosPorAno).length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ano</TableHead>
                <TableHead className="text-right">Simples</TableHead>
                <TableHead className="text-right">Presumido</TableHead>
                <TableHead className="text-right">Real</TableHead>
                <TableHead>Melhor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(resultadosPorAno).map(([ano, resultado]: [string, any]) => (
                <TableRow key={ano}>
                  <TableCell className="font-medium">{ano}</TableCell>
                  <TableCell className="text-right">{formatarMoeda(resultado.simples?.totalTributos || 0)}</TableCell>
                  <TableCell className="text-right">{formatarMoeda(resultado.presumido?.totalTributos || 0)}</TableCell>
                  <TableCell className="text-right">{formatarMoeda(resultado.real?.totalTributos || 0)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{resultado.melhorOpcao || '-'}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    );
  };

  const getIconeModulo = (tipo: string) => {
    switch (tipo) {
      case 'pesquisa': return <Search className="h-5 w-5 text-amber-500" />;
      case 'simples': return <Store className="h-5 w-5 text-orange-500" />;
      case 'presumido': return <Building2 className="h-5 w-5 text-blue-500" />;
      case 'imobiliario': return <Building className="h-5 w-5 text-purple-500" />;
      case 'comparativo': return <Scale className="h-5 w-5 text-emerald-500" />;
      default: return <FileText className="h-5 w-5" />;
    }
  };

  const renderizarDados = (item: DadosModulo) => {
    switch (item.tipo) {
      case 'pesquisa': return renderizarDadosPesquisa(item.dados);
      case 'simples': return renderizarDadosSimples(item.dados);
      case 'presumido': return renderizarDadosPresumido(item.dados);
      case 'imobiliario': return renderizarDadosImobiliario(item.dados);
      case 'comparativo': return renderizarDadosComparativo(item.dados);
      default: return <p className="text-muted-foreground">Dados não disponíveis</p>;
    }
  };

  const exportarExcel = () => {
    if (dadosRelatorio.length === 0) {
      toast({ title: 'Adicione dados ao relatório primeiro', variant: 'destructive' });
      return;
    }

    const wb = XLSX.utils.book_new();

    // Página de resumo
    const resumo = [
      { Campo: 'Empresa', Valor: nomeEmpresa || 'Não informado' },
      { Campo: 'CNPJ', Valor: cnpj || 'Não informado' },
      { Campo: 'Ano de Referência', Valor: anoSelecionado },
      { Campo: 'Data do Relatório', Valor: new Date().toLocaleString('pt-BR') },
      { Campo: 'Módulos Incluídos', Valor: dadosRelatorio.map(d => d.titulo).join(', ') },
      { Campo: 'Observações', Valor: observacoes || '-' }
    ];
    const wsResumo = XLSX.utils.json_to_sheet(resumo);
    XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

    // Cada módulo em uma aba separada
    for (const item of dadosRelatorio) {
      let dadosAba: any[] = [];
      
      if (item.tipo === 'pesquisa' && Array.isArray(item.dados)) {
        dadosAba = item.dados.map((d: any) => ({
          Código: d.codigo,
          Descrição: d.descricao || '-',
          Status: d.validez,
          Regime: d.regime,
          Anexo: d.anexo || '-',
          ClassTrib: d.classtrib || '-',
          CST_IBS: d.cst_ibs || '-',
          CST_CBS: d.cst_cbs || '-',
          'Redução IBS': d.reducao_ibs || '0%',
          'Redução CBS': d.reducao_cbs || '0%',
          'IBS Efetiva': `${d.ibsEfetiva}%`,
          'CBS Efetiva': `${d.cbsEfetiva}%`,
          'Imposto Seletivo': d.impostoSeletivo || 'NÃO',
          'CST IS': d.cst_is || '-',
          'Alíquota IS': d.aliquota_is || '-'
        }));
      } else if (item.tipo === 'simples' && item.dados.resultados) {
        dadosAba = item.dados.resultados.map((r: any) => ({
          Anexo: r.nomeAnexo,
          Faturamento: r.faturamento,
          'Alíquota Efetiva': `${r.aliquotaEfetiva.toFixed(2)}%`,
          DAS: r.valorImposto,
          'IBS/CBS': (r.ibs || 0) + (r.cbs || 0),
          Total: r.totalTributos
        }));
      } else if (item.tipo === 'presumido' && item.dados.resultados) {
        dadosAba = item.dados.resultados.map((r: any) => ({
          Tributo: r.tributo,
          Base: r.base,
          Alíquota: `${r.aliquota.toFixed(2)}%`,
          Valor: r.valor
        }));
      } else if (item.tipo === 'imobiliario' && item.dados.resultados) {
        dadosAba = item.dados.resultados.map((r: any) => ({
          Período: r.periodo || '-',
          IBS: r.ibs || 0,
          CBS: r.cbs || 0,
          IRPJ: r.irpj || 0,
          CSLL: r.csll || 0,
          Total: r.total || 0
        }));
      } else if (item.tipo === 'comparativo' && item.dados.resultadosPorAno) {
        dadosAba = Object.entries(item.dados.resultadosPorAno).map(([ano, resultado]: [string, any]) => ({
          Ano: ano,
          Simples: resultado.simples?.totalTributos || 0,
          Presumido: resultado.presumido?.totalTributos || 0,
          Real: resultado.real?.totalTributos || 0,
          'Melhor Opção': resultado.melhorOpcao || '-'
        }));
      }

      if (dadosAba.length > 0) {
        const ws = XLSX.utils.json_to_sheet(dadosAba);
        const nomeAba = item.titulo.substring(0, 31); // Excel limita a 31 caracteres
        XLSX.utils.book_append_sheet(wb, ws, nomeAba);
      }
    }

    const nomeArquivo = `relatorio_consolidado_${nomeEmpresa.replace(/\s/g, '_') || 'empresa'}_${anoSelecionado}.xlsx`;
    XLSX.writeFile(wb, nomeArquivo);
    toast({ title: 'Excel exportado com sucesso!' });
  };

  const exportarPDF = () => {
    if (dadosRelatorio.length === 0) {
      toast({ title: 'Adicione dados ao relatório primeiro', variant: 'destructive' });
      return;
    }

    const gerarSecaoHTML = (item: DadosModulo) => {
      let conteudo = '';
      
      if (item.tipo === 'pesquisa' && Array.isArray(item.dados)) {
        conteudo = `
          <table>
            <tr><th>Código</th><th>Descrição</th><th>Status</th><th>Anexo</th><th>ClassTrib</th><th>CST IBS</th><th>CST CBS</th><th>IBS Efetiva</th><th>CBS Efetiva</th><th>IS</th></tr>
            ${item.dados.map((d: any) => `
              <tr>
                <td>${d.codigo}</td>
                <td>${d.descricao || '-'}</td>
                <td>${d.validez}</td>
                <td>${d.anexo || '-'}</td>
                <td>${d.classtrib || '-'}</td>
                <td>${d.cst_ibs || '-'}</td>
                <td>${d.cst_cbs || '-'}</td>
                <td>${d.ibsEfetiva}%</td>
                <td>${d.cbsEfetiva}%</td>
                <td>${d.impostoSeletivo || 'NÃO'}</td>
              </tr>
            `).join('')}
          </table>
        `;
      } else if (item.tipo === 'simples' && item.dados.resultados) {
        conteudo = `
          <div class="info-grid">
            <div class="info-item"><div class="label">RBT12</div><div class="valor">${formatarMoeda(item.dados.rbt12 || 0)}</div></div>
            <div class="info-item"><div class="label">Folha Pagamento</div><div class="valor">${formatarMoeda(item.dados.folhaPagamento || 0)}</div></div>
          </div>
          <table>
            <tr><th>Anexo</th><th>Faturamento</th><th>Alíq. Efetiva</th><th>DAS</th><th>Total</th></tr>
            ${item.dados.resultados.map((r: any) => `
              <tr>
                <td>${r.nomeAnexo}</td>
                <td>${formatarMoeda(r.faturamento)}</td>
                <td>${r.aliquotaEfetiva.toFixed(2)}%</td>
                <td>${formatarMoeda(r.valorImposto)}</td>
                <td>${formatarMoeda(r.totalTributos)}</td>
              </tr>
            `).join('')}
          </table>
        `;
      } else if (item.tipo === 'presumido' && item.dados.resultados) {
        conteudo = `
          <div class="info-grid">
            <div class="info-item"><div class="label">Receita Total</div><div class="valor">${formatarMoeda(item.dados.receitaTotal || 0)}</div></div>
            <div class="info-item"><div class="label">Período</div><div class="valor">${item.dados.periodoCalculo || '-'}</div></div>
          </div>
          <table>
            <tr><th>Tributo</th><th>Base</th><th>Alíquota</th><th>Valor</th></tr>
            ${item.dados.resultados.map((r: any) => `
              <tr>
                <td>${r.tributo}</td>
                <td>${formatarMoeda(r.base)}</td>
                <td>${r.aliquota.toFixed(2)}%</td>
                <td>${formatarMoeda(r.valor)}</td>
              </tr>
            `).join('')}
          </table>
        `;
      } else if (item.tipo === 'comparativo' && item.dados.resultadosPorAno) {
        conteudo = `
          <table>
            <tr><th>Ano</th><th>Simples</th><th>Presumido</th><th>Real</th><th>Melhor</th></tr>
            ${Object.entries(item.dados.resultadosPorAno).map(([ano, resultado]: [string, any]) => `
              <tr>
                <td>${ano}</td>
                <td>${formatarMoeda(resultado.simples?.totalTributos || 0)}</td>
                <td>${formatarMoeda(resultado.presumido?.totalTributos || 0)}</td>
                <td>${formatarMoeda(resultado.real?.totalTributos || 0)}</td>
                <td>${resultado.melhorOpcao || '-'}</td>
              </tr>
            `).join('')}
          </table>
        `;
      }
      
      return `
        <div class="secao">
          <h2>${item.titulo}</h2>
          <p class="data-hora">Incluído em: ${item.dataHora}</p>
          ${conteudo}
        </div>
      `;
    };

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Relatório Consolidado - ${nomeEmpresa || 'Empresa'}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 30px; max-width: 900px; margin: 0 auto; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; }
            .header h1 { margin: 0; color: #1f2937; }
            .header img { height: 60px; }
            .empresa-info { background: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
            .empresa-info h2 { margin-top: 0; color: #374151; }
            .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 15px 0; }
            .info-item { background: #f9fafb; padding: 15px; border-radius: 8px; }
            .info-item .label { font-size: 0.85em; color: #6b7280; margin-bottom: 5px; }
            .info-item .valor { font-size: 1.2em; font-weight: bold; color: #1f2937; }
            .secao { margin-bottom: 40px; page-break-inside: avoid; }
            .secao h2 { color: #3b82f6; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; }
            .data-hora { font-size: 0.85em; color: #9ca3af; margin-bottom: 15px; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th, td { border: 1px solid #e5e7eb; padding: 10px 12px; text-align: left; }
            th { background: #f9fafb; font-weight: 600; color: #374151; }
            td { color: #4b5563; }
            tr:nth-child(even) { background: #fafafa; }
            .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 0.85em; color: #9ca3af; }
            .observacoes { background: #fef3c7; padding: 15px; border-radius: 8px; margin-top: 30px; }
            .observacoes h3 { margin-top: 0; color: #92400e; }
            @media print { body { padding: 10px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>Relatório Consolidado</h1>
              <p style="color: #6b7280; margin: 5px 0 0 0;">Reforma Tributária - LC 214/2025</p>
            </div>
          </div>

          <div class="empresa-info">
            <h2>${nomeEmpresa || 'Empresa não informada'}</h2>
            <div class="info-grid">
              <div class="info-item">
                <div class="label">CNPJ</div>
                <div class="valor">${cnpj || 'Não informado'}</div>
              </div>
              <div class="info-item">
                <div class="label">Ano de Referência</div>
                <div class="valor">${anoSelecionado}</div>
              </div>
              <div class="info-item">
                <div class="label">Data do Relatório</div>
                <div class="valor">${new Date().toLocaleString('pt-BR')}</div>
              </div>
              <div class="info-item">
                <div class="label">Alíquotas IBS/CBS</div>
                <div class="valor">${aliquotas.ibs.toFixed(2)}% / ${aliquotas.cbs.toFixed(2)}%</div>
              </div>
            </div>
          </div>

          ${dadosRelatorio.map(item => gerarSecaoHTML(item)).join('')}

          ${observacoes ? `
            <div class="observacoes">
              <h3>Observações</h3>
              <p>${observacoes}</p>
            </div>
          ` : ''}

          <div class="footer">
            <p>Relatório gerado pelo Analisador da Reforma Tributária</p>
            <p>LC 214/2025 - ${new Date().toLocaleDateString('pt-BR')}</p>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  return (
    <div className="space-y-6">
      {/* Informações da Empresa */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Relatório Consolidado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Nome da Empresa</Label>
              <Input
                value={nomeEmpresa}
                onChange={(e) => setNomeEmpresa(e.target.value)}
                placeholder="Razão Social"
                className="mt-1"
              />
            </div>
            <div>
              <Label>CNPJ</Label>
              <Input
                value={cnpj}
                onChange={(e) => setCnpj(formatarCNPJ(e.target.value))}
                placeholder="00.000.000/0000-00"
                className="mt-1 font-mono"
                maxLength={18}
              />
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Input
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações adicionais para o relatório"
              className="mt-1"
            />
          </div>
          
          <div className="flex flex-wrap gap-3 pt-4">
            <Button onClick={exportarPDF} className="gap-2" disabled={dadosRelatorio.length === 0}>
              <Printer className="h-4 w-4" />
              Gerar PDF
            </Button>
            <Button onClick={exportarExcel} variant="outline" className="gap-2" disabled={dadosRelatorio.length === 0}>
              <Download className="h-4 w-4" />
              Exportar Excel
            </Button>
            <Button onClick={limparRelatorio} variant="destructive" className="gap-2" disabled={dadosRelatorio.length === 0}>
              <Trash2 className="h-4 w-4" />
              Limpar Relatório
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Status do Relatório */}
      {dadosRelatorio.length === 0 ? (
        <Alert className="border-amber-500/30 bg-amber-500/5">
          <AlertDescription className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-amber-500" />
            <span>
              O relatório está vazio. Use o botão <strong>"Adicionar ao Relatório"</strong> nos outros módulos para incluir dados.
            </span>
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-emerald-500/30 bg-emerald-500/5">
          <AlertDescription className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-emerald-500" />
            <span>
              <strong>{dadosRelatorio.length}</strong> módulo(s) adicionado(s) ao relatório.
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/* Dados Adicionados */}
      {dadosRelatorio.length > 0 && (
        <div className="space-y-4">
          {dadosRelatorio.map((item, index) => (
            <Card key={index} className="border-muted">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {getIconeModulo(item.tipo)}
                    {item.titulo}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      <Calendar className="h-3 w-3 mr-1" />
                      {item.dataHora}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removerDados(index)}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {renderizarDados(item)}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
});

RelatorioConsolidado.displayName = 'RelatorioConsolidado';

export default RelatorioConsolidado;
