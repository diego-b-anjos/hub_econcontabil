import React, { useState } from 'react';
import { Calculator, Home, Building, DollarSign, Download, FileText, Calendar, Users, Plus } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { PERIODO_TRANSICAO, OPERACOES_IMOBILIARIAS } from '@/constants/tax-tables';
import { formatarValorBRL, extrairValor, formatarMoeda } from '@/utils/tax-calculations';

interface DadosRelatorio {
  tipo: 'imobiliario';
  titulo: string;
  dados: any;
  dataHora: string;
}

interface Props {
  anoSelecionado: number;
  onAdicionarAoRelatorio?: (dados: DadosRelatorio) => void;
}

interface ResultadoImobiliario {
  tipoOperacao: string;
  nomeOperacao: string;
  valorOperacao: number;
  ibs: number;
  cbs: number;
  totalIbsCbs: number;
  irpj: number;
  csll: number;
  pis: number;
  cofins: number;
  inssPatronal: number;
  sistemaS: number;
  totalTributos: number;
  cargaEfetiva: number;
  observacao: string;
  periodo: 'mensal' | 'anual';
}

const CalculoOperacoesImobiliarias: React.FC<Props> = ({ anoSelecionado, onAdicionarAoRelatorio }) => {
  const [tipoOperacao, setTipoOperacao] = useState<string>('locacao');
  const [valorOperacao, setValorOperacao] = useState('');
  const [valorAquisicao, setValorAquisicao] = useState(''); // Para RET
  const [folhaPagamento, setFolhaPagamento] = useState('');
  const [periodoCalculo, setPeriodoCalculo] = useState<'mensal' | 'anual'>('mensal');
  const [resultados, setResultados] = useState<ResultadoImobiliario[]>([]);
  const [anoCalculo, setAnoCalculo] = useState<number>(anoSelecionado);

  const aliquotas = PERIODO_TRANSICAO[anoCalculo] || PERIODO_TRANSICAO[2033];
  const operacao = OPERACOES_IMOBILIARIAS[tipoOperacao];

  const calcular = () => {
    const valor = extrairValor(valorOperacao);
    const folha = extrairValor(folhaPagamento);
    
    if (valor <= 0) {
      toast({ title: 'Informe o valor da operação', variant: 'destructive' });
      return;
    }

    // Multiplicar valores se for anual (12 meses)
    const multiplicador = periodoCalculo === 'anual' ? 12 : 1;
    const valorBase = valor * multiplicador;
    const folhaBase = folha * multiplicador;

    let ibs = 0;
    let cbs = 0;
    let irpj = 0;
    let csll = 0;
    let pis = 0;
    let cofins = 0;
    let observacao = operacao.observacao;

    if (tipoOperacao === 'locacao') {
      // Locação: redução de 60%
      const fatorReducao = (100 - operacao.reducao_ibs) / 100;
      ibs = valorBase * (aliquotas.ibs / 100) * fatorReducao;
      cbs = valorBase * (aliquotas.cbs / 100) * fatorReducao;
      
      // PIS/COFINS ainda em transição
      if (anoCalculo <= 2026) {
        pis = valorBase * 0.0065;
        cofins = valorBase * 0.03;
      }
      
      // IRPJ/CSLL sobre presunção de 32%
      const basePresuncao = valorBase * 0.32;
      irpj = basePresuncao * 0.15;
      csll = basePresuncao * 0.09;
      
    } else if (tipoOperacao === 'venda_normal') {
      // Venda normal: tributação integral
      ibs = valorBase * (aliquotas.ibs / 100);
      cbs = valorBase * (aliquotas.cbs / 100);
      
      if (anoCalculo <= 2026) {
        pis = valorBase * 0.0165;
        cofins = valorBase * 0.076;
      }
      
      // IRPJ/CSLL sobre lucro presumido (8% para venda de imóveis)
      const basePresuncao = valorBase * 0.08;
      irpj = basePresuncao * 0.15;
      csll = basePresuncao * 0.09;
      
    } else if (tipoOperacao === 'venda_ret') {
      // RET: alíquota fixa de 4% (2% IBS + 2% CBS)
      ibs = valorBase * (operacao.aliquota_fixa_ibs! / 100);
      cbs = valorBase * (operacao.aliquota_fixa_cbs! / 100);
      
      // No RET, os demais tributos estão incluídos
      // Pagamento unificado de 4% sobre receita bruta
      observacao = 'RET - Pagamento unificado de 4% (inclui IBS, CBS, IRPJ, CSLL, PIS e COFINS)';
    }

    // INSS Patronal (20% sobre folha) e Sistema S (5,8% sobre folha)
    const inssPatronal = folhaBase * 0.20;
    const sistemaS = folhaBase * 0.058;

    const totalIbsCbs = ibs + cbs;
    const totalTributos = ibs + cbs + irpj + csll + pis + cofins + inssPatronal + sistemaS;
    const cargaEfetiva = (totalTributos / valorBase) * 100;

    const resultado: ResultadoImobiliario = {
      tipoOperacao,
      nomeOperacao: operacao.nome,
      valorOperacao: valorBase,
      ibs,
      cbs,
      totalIbsCbs,
      irpj,
      csll,
      pis,
      cofins,
      inssPatronal,
      sistemaS,
      totalTributos,
      cargaEfetiva,
      observacao,
      periodo: periodoCalculo
    };

    setResultados(prev => [...prev, resultado]);
    toast({ title: 'Cálculo realizado com sucesso!' });
  };

  const limpar = () => {
    setValorOperacao('');
    setValorAquisicao('');
    setFolhaPagamento('');
    setResultados([]);
  };

  const exportarExcel = () => {
    if (resultados.length === 0) {
      toast({ title: 'Realize um cálculo primeiro', variant: 'destructive' });
      return;
    }

    const dados = resultados.map(r => ({
      'Operação': r.nomeOperacao,
      'Período': r.periodo === 'anual' ? 'Anual' : 'Mensal',
      'Valor': r.valorOperacao,
      'IBS': r.ibs,
      'CBS': r.cbs,
      'Total IBS/CBS': r.totalIbsCbs,
      'IRPJ': r.irpj,
      'CSLL': r.csll,
      'PIS': r.pis,
      'COFINS': r.cofins,
      'INSS Patronal': r.inssPatronal,
      'Sistema S': r.sistemaS,
      'Total Tributos': r.totalTributos,
      'Carga Efetiva (%)': r.cargaEfetiva.toFixed(2),
      'Observação': r.observacao
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(dados);
    XLSX.utils.book_append_sheet(wb, ws, 'Operações Imobiliárias');
    XLSX.writeFile(wb, `operacoes_imobiliarias_${anoCalculo}.xlsx`);
    toast({ title: 'Excel exportado com sucesso!' });
  };

  const adicionarAoRelatorio = () => {
    if (!onAdicionarAoRelatorio || resultados.length === 0) {
      toast({ title: 'Realize um cálculo primeiro', variant: 'destructive' });
      return;
    }

    onAdicionarAoRelatorio({
      tipo: 'imobiliario',
      titulo: `Operações Imobiliárias - ${anoCalculo}`,
      dados: {
        resultados: resultados.map(r => ({
          periodo: r.periodo === 'anual' ? 'Anual' : 'Mensal',
          ibs: r.ibs,
          cbs: r.cbs,
          irpj: r.irpj,
          csll: r.csll,
          total: r.totalTributos
        })),
        valorOperacao: resultados[0]?.valorOperacao || 0,
        tipoOperacao: resultados[0]?.nomeOperacao || '',
        periodoCalculo
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
          <title>Operações Imobiliárias - ${anoCalculo}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; max-width: 900px; margin: 0 auto; }
            h1 { color: #333; border-bottom: 2px solid #0ea5e9; padding-bottom: 10px; }
            h2 { color: #555; margin-top: 30px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 0.85em; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
            th { background-color: #f5f5f5; font-weight: bold; }
            td:first-child, th:first-child { text-align: left; }
            .resumo { background: #f0f9ff; padding: 20px; border-radius: 8px; margin-top: 20px; }
            .footer { margin-top: 40px; font-size: 0.8em; color: #888; text-align: center; }
          </style>
        </head>
        <body>
          <h1>Cálculo de Operações Imobiliárias - ${anoCalculo}</h1>
          
          <div class="resumo">
            <strong>Ano de Referência:</strong> ${anoCalculo} - ${aliquotas.fase}<br>
            <strong>Alíquotas Base:</strong> IBS ${aliquotas.ibs}% | CBS ${aliquotas.cbs}%
          </div>

          <h2>Detalhamento das Operações</h2>
          <table>
            <tr>
              <th>Operação</th>
              <th>Valor</th>
              <th>IBS</th>
              <th>CBS</th>
              <th>IRPJ</th>
              <th>CSLL</th>
              <th>PIS</th>
              <th>COFINS</th>
              <th>Total</th>
              <th>Carga %</th>
            </tr>
            ${resultados.map(r => `
              <tr>
                <td>${r.nomeOperacao}</td>
                <td>${formatarValorBRL(r.valorOperacao)}</td>
                <td>${formatarValorBRL(r.ibs)}</td>
                <td>${formatarValorBRL(r.cbs)}</td>
                <td>${formatarValorBRL(r.irpj)}</td>
                <td>${formatarValorBRL(r.csll)}</td>
                <td>${formatarValorBRL(r.pis)}</td>
                <td>${formatarValorBRL(r.cofins)}</td>
                <td><strong>${formatarValorBRL(r.totalTributos)}</strong></td>
                <td><strong>${r.cargaEfetiva.toFixed(2)}%</strong></td>
              </tr>
            `).join('')}
          </table>

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

  return (
    <div className="space-y-6">
      {/* Seletor de Ano */}
      <Card className="border-cyan-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 text-cyan-500" />
            Ano de Referência para Cálculo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={anoCalculo.toString()} onValueChange={(v) => setAnoCalculo(Number(v))}>
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

      {/* Período de Cálculo */}
      <Card className="border-cyan-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 text-cyan-500" />
            Período de Cálculo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={periodoCalculo} onValueChange={(v) => setPeriodoCalculo(v as 'mensal' | 'anual')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="mensal">Mensal</TabsTrigger>
              <TabsTrigger value="anual">Anual</TabsTrigger>
            </TabsList>
          </Tabs>
          <p className="text-xs text-muted-foreground mt-2">
            {periodoCalculo === 'mensal' 
              ? 'Informe o valor mensal da operação.'
              : 'Informe o valor mensal que será multiplicado por 12 para cálculo anual.'}
          </p>
        </CardContent>
      </Card>

      {/* Entrada de Dados */}
      <Card className="border-cyan-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Home className="h-5 w-5 text-cyan-500" />
            Dados da Operação Imobiliária
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Tipo de Operação</Label>
              <Select value={tipoOperacao} onValueChange={setTipoOperacao}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(OPERACOES_IMOBILIARIAS).map(([key, op]) => (
                    <SelectItem key={key} value={key}>
                      {op.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor da Operação Mensal (R$)</Label>
              <Input
                value={valorOperacao}
                onChange={(e) => setValorOperacao(formatarMoeda(e.target.value))}
                placeholder="0,00"
                className="mt-1 font-mono"
              />
              {periodoCalculo === 'anual' && (
                <p className="text-xs text-muted-foreground mt-1">
                  Valor anual: {formatarValorBRL(extrairValor(valorOperacao) * 12)}
                </p>
              )}
            </div>
          </div>

          {/* Folha de Pagamento */}
          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-5 w-5 text-cyan-500" />
                <Label className="text-base font-semibold">Folha de Pagamento</Label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Valor Mensal (R$)</Label>
                  <Input
                    value={folhaPagamento}
                    onChange={(e) => setFolhaPagamento(formatarMoeda(e.target.value))}
                    placeholder="0,00"
                    className="mt-1 font-mono"
                  />
                </div>
                <div className="flex flex-col justify-center space-y-1 text-sm">
                  <p>INSS Patronal (20%): <span className="font-mono text-primary">{formatarValorBRL(extrairValor(folhaPagamento) * 0.20 * (periodoCalculo === 'anual' ? 12 : 1))}</span></p>
                  <p>Sistema S (5,8%): <span className="font-mono text-primary">{formatarValorBRL(extrairValor(folhaPagamento) * 0.058 * (periodoCalculo === 'anual' ? 12 : 1))}</span></p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Info sobre a operação selecionada */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-2">
            <p className="font-medium">{operacao.nome}</p>
            <p className="text-sm text-muted-foreground">{operacao.descricao}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {operacao.aliquota_fixa_ibs ? (
                <>
                  <Badge variant="secondary">IBS: {operacao.aliquota_fixa_ibs}% (fixo)</Badge>
                  <Badge variant="secondary">CBS: {operacao.aliquota_fixa_cbs}% (fixo)</Badge>
                </>
              ) : (
                <>
                  <Badge variant="secondary">Redução IBS: {operacao.reducao_ibs}%</Badge>
                  <Badge variant="secondary">Redução CBS: {operacao.reducao_cbs}%</Badge>
                </>
              )}
              <Badge variant="outline">ClassTrib: {operacao.classtrib}</Badge>
              <Badge variant="outline">CST: {operacao.cst_ibs}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">{operacao.observacao}</p>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button onClick={calcular} className="gap-2">
              <Calculator className="h-4 w-4" />
              Calcular
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

      {/* Resultados */}
      {resultados.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Resultados dos Cálculos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Operação</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">IBS</TableHead>
                    <TableHead className="text-right">CBS</TableHead>
                    <TableHead className="text-right">IRPJ</TableHead>
                    <TableHead className="text-right">CSLL</TableHead>
                    <TableHead className="text-right">INSS Patr.</TableHead>
                    <TableHead className="text-right">Sist. S</TableHead>
                    <TableHead className="text-right font-bold">Total</TableHead>
                    <TableHead className="text-right font-bold">Carga %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultados.map((r, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{r.nomeOperacao}</p>
                          <p className="text-xs text-muted-foreground">{r.observacao}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.periodo === 'anual' ? 'default' : 'outline'}>
                          {r.periodo === 'anual' ? 'Anual' : 'Mensal'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatarValorBRL(r.valorOperacao)}</TableCell>
                      <TableCell className="text-right font-mono text-blue-500">{formatarValorBRL(r.ibs)}</TableCell>
                      <TableCell className="text-right font-mono text-emerald-500">{formatarValorBRL(r.cbs)}</TableCell>
                      <TableCell className="text-right font-mono">{formatarValorBRL(r.irpj)}</TableCell>
                      <TableCell className="text-right font-mono">{formatarValorBRL(r.csll)}</TableCell>
                      <TableCell className="text-right font-mono text-orange-500">{formatarValorBRL(r.inssPatronal)}</TableCell>
                      <TableCell className="text-right font-mono text-purple-500">{formatarValorBRL(r.sistemaS)}</TableCell>
                      <TableCell className="text-right font-mono font-bold">{formatarValorBRL(r.totalTributos)}</TableCell>
                      <TableCell className="text-right font-bold text-primary">{r.cargaEfetiva.toFixed(2)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CalculoOperacoesImobiliarias;
