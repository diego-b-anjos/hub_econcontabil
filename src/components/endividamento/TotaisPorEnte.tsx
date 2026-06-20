import { CheckCircle2, Building2, Landmark, FileWarning } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Debito, Parcelamento } from "@/lib/endividamento/types";
import { fmtBRL } from "@/lib/endividamento/format";
import { cn } from "@/lib/utils";

interface Props {
  debitos: Debito[];
  parcelamentos: Parcelamento[];
}

type SubKey = "RFB" | "PGFN" | "SEFAZ" | "PGE" | "MUN";
type SubAcc = { devido: number; debitos: number; pendencias: number };

function emptyAcc(): SubAcc {
  return { devido: 0, debitos: 0, pendencias: 0 };
}

/** Heurística: distingue débitos de SEFAZ vs PGE no nível Estadual.
 *  PGE = inscrição em dívida ativa, CDA, PEP, Procuradoria.
 *  Demais débitos Estaduais → SEFAZ. */
function isPGE(d: Debito): boolean {
  const s = `${d.receita} ${d.situacao || ""} ${d.observacao || ""}`.toUpperCase();
  return /\b(PGE|CDA|D[ÍI]VIDA ATIVA|PROCURADORIA|PEP)\b/.test(s);
}

/**
 * 3 blocos pais no padrão visual dos cards de totais:
 *  • Federal  → Receita Federal + PGFN
 *  • Estadual → SEFAZ + PGE
 *  • Totais de Pendências → declarações por ente + municipal
 */
export function TotaisPorEnte({ debitos, parcelamentos }: Props) {
  const acc: Record<SubKey, SubAcc> = {
    RFB: emptyAcc(),
    PGFN: emptyAcc(),
    SEFAZ: emptyAcc(),
    PGE: emptyAcc(),
    MUN: emptyAcc(),
  };

  debitos.forEach((d) => {
    let key: SubKey;
    if (d.orgao === "RFB") key = "RFB";
    else if (d.orgao === "PGFN") key = "PGFN";
    else if (d.orgao === "Estadual") key = isPGE(d) ? "PGE" : "SEFAZ";
    else key = "MUN";

    if (d.pendenciaDeclaracao) {
      acc[key].pendencias += 1;
      return;
    }
    if (d.statusParc === "em-dia") return;
    acc[key].devido += d.total;
    acc[key].debitos += 1;
  });

  parcelamentos.forEach((p) => {
    let key: SubKey;
    if (p.orgao === "RFB") key = "RFB";
    else if (p.orgao === "PGFN") key = "PGFN";
    else if (p.orgao === "Estadual") {
      key = /PGE|CDA|D[ÍI]VIDA ATIVA|PROCURADORIA/i.test(`${p.identificador} ${p.modalidade || ""}`)
        ? "PGE"
        : "SEFAZ";
    } else key = "MUN";
    acc[key].devido += p.valorEmAtraso || 0;
  });

  const totalFederal = acc.RFB.devido + acc.PGFN.devido;
  const totalEstadual = acc.SEFAZ.devido + acc.PGE.devido;
  const totalPendencias = acc.RFB.pendencias + acc.PGFN.pendencias + acc.SEFAZ.pendencias + acc.PGE.pendencias + acc.MUN.pendencias;
  const totalMunicipal = acc.MUN.devido;

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      <BlocoPai
        titulo="Federal"
        icon={Landmark}
        total={totalFederal}
        subs={[
          { label: "Receita Federal (RFB)", acc: acc.RFB },
          { label: "PGFN — Dívida Ativa", acc: acc.PGFN },
        ]}
      />
      <BlocoPai
        titulo="Estadual"
        icon={Landmark}
        total={totalEstadual}
        subs={[
          { label: "SEFAZ", acc: acc.SEFAZ },
          { label: "PGE — Dívida Ativa Estadual", acc: acc.PGE },
        ]}
      />
      <BlocoPai
        titulo="Municipal"
        icon={Landmark}
        total={totalMunicipal}
        subs={[
          { label: "Município", acc: acc.MUN },
        ]}
      />
      <BlocoPai
        titulo="Pendências de Declarações"
        icon={FileWarning}
        total={0}
        textoTotal={totalPendencias > 0 ? `${totalPendencias} pendência(s)` : undefined}
        subs={[
          { label: "Declarações — Receita Federal", acc: { devido: 0, debitos: 0, pendencias: acc.RFB.pendencias }, modoPendencia: true },
          { label: "Declarações — SEFAZ", acc: { devido: 0, debitos: 0, pendencias: acc.SEFAZ.pendencias }, modoPendencia: true },
        ]}
      />
    </section>
  );
}

interface BlocoPaiProps {
  titulo: string;
  icon: LucideIcon;
  total: number;
  textoTotal?: string;
  subs: { label: string; acc: SubAcc; modoPendencia?: boolean }[];
}

function BlocoPai({ titulo, icon: Icon, total, textoTotal, subs }: BlocoPaiProps) {
  const semDevido = total <= 0 && !textoTotal;
  return (
    <div
      className={cn(
        "rounded-xl border shadow-card overflow-hidden flex flex-col bg-card min-w-0",
        semDevido ? "border-success/30" : "border-border",
      )}
    >
      <header
        className={cn(
          "flex items-center justify-between gap-3 px-4 py-3 border-b",
          semDevido ? "bg-success/10 border-success/20" : "bg-muted/40 border-border",
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {titulo}
          </p>
          <p
            className={cn(
              "font-bold mt-1 tabular-nums leading-tight whitespace-nowrap overflow-hidden text-ellipsis text-base xl:text-lg",
              semDevido ? "text-success" : "text-foreground",
            )}
            title={textoTotal || fmtBRL(total)}
          >
            {textoTotal || (semDevido ? "Sem pendências" : fmtBRL(total))}
          </p>
        </div>
        <div
          className={cn(
            "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
            semDevido ? "bg-success/15 text-success" : "bg-primary/10 text-secondary",
          )}
        >
          {semDevido ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
        </div>
      </header>
      <div className="p-3 grid gap-2 flex-1">
        {subs.map((s) => (
          <SubBloco key={s.label} {...s} />
        ))}
      </div>
    </div>
  );
}

function SubBloco({
  label,
  acc,
  modoPendencia,
}: {
  label: string;
  acc: SubAcc;
  modoPendencia?: boolean;
}) {
  const ok = modoPendencia ? acc.pendencias === 0 : acc.devido <= 0 && acc.debitos === 0;
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2 flex items-start justify-between gap-3 min-w-0 overflow-hidden",
        ok
          ? "bg-success/5 border-success/20"
          : "bg-background border-border",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground truncate" title={label}>
          {label}
        </p>
        {modoPendencia ? (
          <p
            className={cn(
              "text-sm font-semibold mt-0.5",
              ok ? "text-success" : "text-warning",
            )}
          >
            {acc.pendencias > 0
              ? `${acc.pendencias} pendência(s) de declaração`
              : "Sem pendências"}
          </p>
        ) : (
          <p
            className={cn(
              "text-sm font-bold mt-0.5 tabular-nums break-all leading-tight",
              ok ? "text-success" : "text-foreground",
            )}
            title={fmtBRL(acc.devido)}
          >
            {ok ? "Sem pendências" : fmtBRL(acc.devido)}
          </p>
        )}
        {!modoPendencia && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {acc.debitos > 0 ? `${acc.debitos} débito(s) ativo(s)` : "Nenhum débito"}
          </p>
        )}
      </div>
      <div
        className={cn(
          "h-7 w-7 rounded-md flex items-center justify-center shrink-0",
          ok ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
        )}
      >
        {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
      </div>
    </div>
  );
}