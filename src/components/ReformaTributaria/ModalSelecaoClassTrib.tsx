import React from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface OpcaoClassTrib {
  classtrib: string;
  nomeClasstrib: string;
  indop?: number;
  reducaoIBS?: number;
  reducaoCBS?: number;
}

interface Props {
  aberto: boolean;
  onClose: () => void;
  onSelecionar: (opcao: OpcaoClassTrib) => void;
  codigo: string;
  descricao: string;
  opcoes: OpcaoClassTrib[];
}

const ModalSelecaoClassTrib: React.FC<Props> = ({
  aberto,
  onClose,
  onSelecionar,
  codigo,
  descricao,
  opcoes
}) => {
  if (!opcoes || opcoes.length === 0) return null;

  return (
    <Dialog open={aberto} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Múltiplas Classificações Tributárias
          </DialogTitle>
          <DialogDescription>
            O código <strong className="text-foreground font-mono">{codigo}</strong> possui múltiplas classificações tributárias possíveis.
            <br />
            <span className="text-sm">{descricao}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          <p className="text-sm font-medium text-muted-foreground">
            Selecione a classificação apropriada:
          </p>
          
          {opcoes.map((opcao, idx) => (
            <Card 
              key={idx}
              className="cursor-pointer hover:bg-accent/50 transition-colors border-2 hover:border-primary"
              onClick={() => onSelecionar(opcao)}
            >
              <CardContent className="p-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="font-mono">
                        ClassTrib: {opcao.classtrib}
                      </Badge>
                      {opcao.indop && (
                        <Badge variant="secondary" className="font-mono">
                          INDOP: {opcao.indop}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm">{opcao.nomeClasstrib}</p>
                    {(opcao.reducaoIBS !== undefined || opcao.reducaoCBS !== undefined) && (
                      <div className="flex gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          Redução IBS: {opcao.reducaoIBS || 0}%
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          Redução CBS: {opcao.reducaoCBS || 0}%
                        </Badge>
                      </div>
                    )}
                  </div>
                  <Button size="sm" variant="outline" className="shrink-0">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Selecionar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ModalSelecaoClassTrib;
