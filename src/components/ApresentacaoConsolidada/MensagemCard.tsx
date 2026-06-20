import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles } from "lucide-react";

export type MensagemCardProps = {
  tituloPersonalizado: string;
  setTituloPersonalizado: (v: string) => void;
  textoLivre: string;
  setTextoLivre: (v: string) => void;
  melhorando: boolean;
  onMelhorar: () => void;
};

export function MensagemCard(p: MensagemCardProps) {
  return (
    <Card>
      <CardHeader><CardTitle className="font-display text-base">Mensagem personalizada (opcional)</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs">Título do slide</Label>
          <Input placeholder="Ex.: Mensagem da diretoria" value={p.tituloPersonalizado} onChange={(e) => p.setTituloPersonalizado(e.target.value)} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label className="text-xs">Texto a incluir na apresentação</Label>
            <Button
              type="button" size="sm" variant="outline"
              onClick={p.onMelhorar} disabled={p.melhorando || !p.textoLivre.trim()}
              className="h-7 text-xs"
            >
              {p.melhorando ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1 text-amber-500" />}
              {p.melhorando ? "Refinando..." : "Melhorar com IA"}
            </Button>
          </div>
          <Textarea
            placeholder="Escreva o texto que deseja incluir como um slide adicional. Será formatado no padrão visual do deck."
            rows={5}
            value={p.textoLivre}
            onChange={(e) => p.setTextoLivre(e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            O slide aparecerá com o mesmo tema (cabeçalho dourado, faixa lateral) dos demais. A IA reescreve mantendo o sentido.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
