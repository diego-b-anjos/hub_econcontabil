import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react';

export interface ItemLC116ComMultiplosNBS {
  codigoLC116: string;
  descricaoLC116: string;
  nbsDisponiveis: Array<{
    nbs: string;
    descricao: string;
  }>;
}

interface Props {
  aberto: boolean;
  itens: ItemLC116ComMultiplosNBS[];
  onConfirmar: (selecoes: Map<string, string[]>) => void;
  onCancelar: () => void;
}

const ModalSelecaoNBSUpload: React.FC<Props> = ({ aberto, itens, onConfirmar, onCancelar }) => {
  const [selecoes, setSelecoes] = useState<Map<string, string[]>>(() => {
    // Pré-selecionar todos os NBS de cada item
    const inicial = new Map<string, string[]>();
    itens.forEach(item => {
      inicial.set(item.codigoLC116, item.nbsDisponiveis.map(n => n.nbs));
    });
    return inicial;
  });

  // Atualizar seleções quando itens mudam
  useEffect(() => {
    const inicial = new Map<string, string[]>();
    itens.forEach(item => {
      inicial.set(item.codigoLC116, item.nbsDisponiveis.map(n => n.nbs));
    });
    setSelecoes(inicial);
  }, [itens]);

  const handleToggleNBS = (codigoLC116: string, nbs: string) => {
    const novoMapa = new Map(selecoes);
    const atual = novoMapa.get(codigoLC116) || [];
    
    if (atual.includes(nbs)) {
      novoMapa.set(codigoLC116, atual.filter(n => n !== nbs));
    } else {
      novoMapa.set(codigoLC116, [...atual, nbs]);
    }
    
    setSelecoes(novoMapa);
  };

  const handleSelecionarTodos = (codigoLC116: string, nbsList: string[]) => {
    const novoMapa = new Map(selecoes);
    novoMapa.set(codigoLC116, nbsList);
    setSelecoes(novoMapa);
  };

  const handleDeselecionarTodos = (codigoLC116: string) => {
    const novoMapa = new Map(selecoes);
    novoMapa.set(codigoLC116, []);
    setSelecoes(novoMapa);
  };

  const totalSelecionados = Array.from(selecoes.values()).reduce((acc, arr) => acc + arr.length, 0);
  const algumSelecionado = totalSelecionados > 0;

  return (
    <Dialog open={aberto} onOpenChange={(open) => !open && onCancelar()}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Seleção de Códigos NBS
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Os códigos LC 116 abaixo possuem múltiplos NBS correspondentes. 
          Selecione quais NBS deseja incluir na exportação.
        </p>

        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-6">
            {itens.map((item, idx) => {
              const selecionadosItem = selecoes.get(item.codigoLC116) || [];
              const todosSelecionados = selecionadosItem.length === item.nbsDisponiveis.length;
              
              return (
                <Card key={idx} className="border-2 border-primary/20">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                            LC 116
                          </Badge>
                          <span className="font-mono font-bold text-lg">{item.codigoLC116}</span>
                          {selecionadosItem.length > 0 && (
                            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">
                              {selecionadosItem.length} selecionado(s)
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{item.descricaoLC116}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleSelecionarTodos(item.codigoLC116, item.nbsDisponiveis.map(n => n.nbs))}
                          disabled={todosSelecionados}
                        >
                          Selecionar todos
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDeselecionarTodos(item.codigoLC116)}
                          disabled={selecionadosItem.length === 0}
                        >
                          Limpar
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2 mt-4">
                      {item.nbsDisponiveis.map((nbs, nbsIdx) => {
                        const isSelected = selecionadosItem.includes(nbs.nbs);
                        return (
                          <div 
                            key={nbsIdx} 
                            className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                              isSelected
                                ? 'border-primary bg-primary/5' 
                                : 'border-muted hover:border-primary/50'
                            }`}
                            onClick={() => handleToggleNBS(item.codigoLC116, nbs.nbs)}
                          >
                            <Checkbox 
                              checked={isSelected}
                              onCheckedChange={() => handleToggleNBS(item.codigoLC116, nbs.nbs)}
                              id={`${item.codigoLC116}-${nbsIdx}`}
                              className="mt-1"
                            />
                            <Label 
                              htmlFor={`${item.codigoLC116}-${nbsIdx}`} 
                              className="flex-1 cursor-pointer"
                            >
                              <div>
                                <span className="font-mono font-medium text-primary">
                                  NBS: {nbs.nbs}
                                </span>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {nbs.descricao}
                                </p>
                              </div>
                            </Label>
                            {isSelected && (
                              <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <div className="flex-1 text-sm text-muted-foreground">
            {totalSelecionados} NBS selecionado(s) para exportação
          </div>
          <Button variant="outline" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button 
            onClick={() => onConfirmar(selecoes)} 
            disabled={!algumSelecionado}
            className="gap-2"
          >
            <CheckCircle className="h-4 w-4" />
            Confirmar Seleção
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ModalSelecaoNBSUpload;
