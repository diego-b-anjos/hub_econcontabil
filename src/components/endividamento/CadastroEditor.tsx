import { useState, useEffect } from "react";
import { Pencil, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DadosCadastrais } from "@/lib/endividamento/types";

interface Props {
  cadastro: DadosCadastrais;
  onChange: (c: DadosCadastrais) => void;
}

export function CadastroEditor({ cadastro, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DadosCadastrais>(cadastro);

  useEffect(() => setDraft(cadastro), [cadastro]);

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-8 border-background/30 bg-background/10 text-background hover:bg-background/20 hover:text-background"
      >
        <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar dados
      </Button>
    );
  }

  const field = (key: keyof DadosCadastrais, label: string, placeholder?: string) => (
    <div className="space-y-1">
      <Label className="text-xs text-background/80">{label}</Label>
      <Input
        value={draft[key] || ""}
        placeholder={placeholder}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
        className="h-9 bg-background/10 border-background/25 text-background placeholder:text-background/40 focus-visible:ring-primary"
      />
    </div>
  );

  return (
    <div className="rounded-xl border border-background/20 bg-background/5 backdrop-blur-sm p-5 space-y-4 w-full max-w-3xl">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-background">Editar dados cadastrais</h4>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { setDraft(cadastro); setOpen(false); }}
            className="h-8 text-background hover:bg-background/10 hover:text-background"
          >
            <X className="h-3.5 w-3.5 mr-1.5" /> Cancelar
          </Button>
          <Button
            size="sm"
            onClick={() => { onChange(draft); setOpen(false); }}
            className="h-8 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Save className="h-3.5 w-3.5 mr-1.5" /> Salvar
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {field("razaoSocial", "Razão Social")}
        {field("cnpj", "CNPJ", "00.000.000/0000-00")}
        {field("inscricaoMunicipal", "Inscrição Municipal")}
        {field("inscricaoEstadual", "Inscrição Estadual")}
        {field("municipio", "Município")}
        {field("uf", "UF", "SP")}
      </div>
    </div>
  );
}