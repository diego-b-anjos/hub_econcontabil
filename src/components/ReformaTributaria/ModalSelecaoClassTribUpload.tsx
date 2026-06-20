import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { CheckCircle, AlertCircle } from 'lucide-react';

export interface ItemComMultiplasOpcoes {
  codigo: string;
  descricao: string;
  tipo: 'NCM' | 'NBS';
  indice: number;
  opcoes: Array<{
    classtrib: string;
    nomeClasstrib: string;
    indop?: number;
    reducaoIBS?: number;
    reducaoCBS?: number;
  }>;
}

interface Props {
  aberto: boolean;
  itens: ItemComMultiplasOpcoes[];
  onConfirmar: (selecoes: Map<number, string>) => void;
  onCancelar: () => void;
}

const ModalSelecaoClassTribUpload: React.FC<Props> = ({ aberto, itens, onConfirmar, onCancelar }) => {
  const [selecoes, setSelecoes] = useState<Map<number, string>>(() => {
    // Pré-selecionar a primeira opção de cada item
    const inicial = new Map<number, string>();
    itens.forEach(item => {
      if (item.opcoes.length > 0) {
        inicial.set(item.indice, item.opcoes[0].classtrib);
      }
    });
    return inicial;
  });

  const handleSelecionar = (indice: number, classtrib: string) => {
    const novoMapa = new Map(selecoes);
    novoMapa.set(indice, classtrib);
    setSelecoes(novoMapa);
  };

  const todosConfirmados = itens.every(item => selecoes.has(item.indice));

  return (
    <Dialog open={aberto} onOpenChange={(open) => !open && onCancelar()}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Seleção de Classificação Tributária
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Os itens abaixo possuem múltiplas opções de classificação tributária. 
          Selecione a classificação correta para cada item antes de continuar.
        </p>

        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-6">
            {itens.map((item, idx) => (
              <Card key={idx} className={`border-2 ${selecoes.has(item.indice) ? 'border-emerald-500/30' : 'border-amber-500/30'}`}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">{item.tipo}</Badge>
                        <span className="font-mono font-bold">{item.codigo}</span>
                        {selecoes.has(item.indice) && (
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{item.descricao}</p>
                    </div>
                    <Badge variant="secondary">{item.opcoes.length} opções</Badge>
                  </div>

                  <RadioGroup
                    value={selecoes.get(item.indice) || ''}
                    onValueChange={(value) => handleSelecionar(item.indice, value)}
                    className="space-y-2"
                  >
                    {item.opcoes.map((opcao, opIdx) => (
                      <div 
                        key={opIdx} 
                        className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                          selecoes.get(item.indice) === opcao.classtrib 
                            ? 'border-primary bg-primary/5' 
                            : 'border-muted hover:border-primary/50'
                        }`}
                        onClick={() => handleSelecionar(item.indice, opcao.classtrib)}
                      >
                        <RadioGroupItem value={opcao.classtrib} id={`${item.indice}-${opIdx}`} />
                        <Label 
                          htmlFor={`${item.indice}-${opIdx}`} 
                          className="flex-1 cursor-pointer"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-mono font-medium text-primary">
                                ClassTrib: {opcao.classtrib}
                              </span>
                              <p className="text-sm text-muted-foreground mt-1">
                                {opcao.nomeClasstrib}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              {opcao.reducaoIBS !== undefined && opcao.reducaoIBS > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  Redução IBS: {opcao.reducaoIBS}%
                                </Badge>
                              )}
                              {opcao.reducaoCBS !== undefined && opcao.reducaoCBS > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  Redução CBS: {opcao.reducaoCBS}%
                                </Badge>
                              )}
                            </div>
                          </div>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button 
            onClick={() => onConfirmar(selecoes)} 
            disabled={!todosConfirmados}
            className="gap-2"
          >
            <CheckCircle className="h-4 w-4" />
            Confirmar e Exportar ({itens.length} itens)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ModalSelecaoClassTribUpload;
