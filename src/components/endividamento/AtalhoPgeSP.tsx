import { useState } from "react";
import { ExternalLink, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const PGE_URL =
  "https://www.dividaativa.pge.sp.gov.br/sc/pages/consultas/consultarDebito.jsf";

const onlyDigits = (s: string) => s.replace(/\D+/g, "");

const formatCnpj = (v: string) => {
  const d = onlyDigits(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

interface Props {
  cnpjPadrao?: string;
}

/**
 * Atalho para o portal da Dívida Ativa da PGE-SP.
 * O portal é JSF (não aceita CNPJ via querystring), então:
 *  1) copiamos o CNPJ formatado para o clipboard
 *  2) abrimos o portal em nova aba
 *  3) o usuário cola o CNPJ, resolve o captcha e exporta o relatório
 *  4) o arquivo exportado (PDF/HTML) entra pelo importador unificado abaixo
 */
export function AtalhoPgeSP({ cnpjPadrao = "" }: Props) {
  const [cnpj, setCnpj] = useState(formatCnpj(cnpjPadrao));
  const [copiado, setCopiado] = useState(false);

  const abrir = async () => {
    const limpo = onlyDigits(cnpj);
    if (limpo && limpo.length !== 14) {
      toast.error("CNPJ deve ter 14 dígitos");
      return;
    }
    if (limpo) {
      try {
        await navigator.clipboard.writeText(formatCnpj(limpo));
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2500);
        toast.success("CNPJ copiado — cole no portal da PGE-SP");
      } catch {
        toast.message("Copie o CNPJ manualmente: " + formatCnpj(limpo));
      }
    }
    window.open(PGE_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Atalho — Dívida Ativa PGE-SP
          </label>
          <p className="text-xs text-muted-foreground mt-0.5 mb-2">
            Informe o CNPJ, abrimos o portal e copiamos o número para o clipboard.
            Depois exporte o PDF/HTML e arraste no importador abaixo.
          </p>
          <Input
            value={cnpj}
            onChange={(e) => setCnpj(formatCnpj(e.target.value))}
            placeholder="00.000.000/0000-00"
            inputMode="numeric"
            className="h-9"
          />
        </div>
        <Button onClick={abrir} className="h-9 gap-2">
          {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copiado ? "Copiado" : "Copiar CNPJ"}
          <ExternalLink className="h-4 w-4 ml-1" />
          Abrir PGE-SP
        </Button>
      </div>
    </div>
  );
}