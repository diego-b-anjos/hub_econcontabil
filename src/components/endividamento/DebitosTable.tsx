import { useMemo, useState } from "react";
import { Trash2, Pencil, Check, X, Trash, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Debito, StatusParc } from "@/lib/endividamento/types";
import { fmtBRL, orgaoLabel } from "@/lib/endividamento/format";

const STATUS_OPCOES: { value: StatusParc; label: string; tone: "destructive" | "success" | "warning" | "muted" }[] = [
  { value: "devedor", label: "Devedor", tone: "destructive" },
  { value: "em-dia", label: "Parcelamento em Dia", tone: "success" },
  { value: "em-atraso", label: "Parcelamento em Atraso", tone: "warning" },
  { value: "rescisao", label: "Parcelamento em Rescisão", tone: "destructive" },
  { value: "divida-ativa", label: "Em Dívida Ativa", tone: "destructive" },
];

const inferStatus = (d: Debito): StatusParc => {
  if (d.statusParc) return d.statusParc;
  if (!d.parcelado) return "devedor";
  const s = (d.situacao || "").toUpperCase();
  if (/RESCIS/.test(s)) return "rescisao";
  if (/ATRASO/.test(s)) return "em-atraso";
  if (/D[IÍ]VIDA ATIVA|INSCRITO/.test(s)) return "divida-ativa";
  return "em-dia";
};

const toneClass = (tone: "destructive" | "success" | "warning" | "muted") => {
  switch (tone) {
    case "success": return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "warning": return "bg-amber-100 text-amber-900 border-amber-200";
    case "destructive": return "bg-destructive/15 text-destructive border-destructive/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
};

interface Props {
  debitos: Debito[];
  onRemove?: (id: string) => void;
  onUpdate?: (id: string, patch: Partial<Debito>) => void;
  onRemoveMany?: (ids: string[]) => void;
  onUpdateMany?: (ids: string[], patch: Partial<Debito>) => void;
}

export function DebitosTable({ debitos, onRemove, onUpdate, onRemoveMany, onUpdateMany }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Debito>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [filtroOrgao, setFiltroOrgao] = useState<string>("__all__");
  const [filtroStatus, setFiltroStatus] = useState<string>("__all__");

  // Confirmação modal para ações em massa
  const [bulkAction, setBulkAction] = useState<
    | { kind: "delete-group"; orgao: string; ids: string[] }
    | { kind: "delete-selected"; orgao: string; ids: string[] }
    | { kind: "reclassify-selected"; orgao: string; ids: string[]; status: StatusParc; label: string }
    | null
  >(null);

  const filtrosAtivos =
    !!search || filtroOrgao !== "__all__" || filtroStatus !== "__all__";

  const sumTotal = (ids: string[]) => {
    const set = new Set(ids);
    return debitos.filter((d) => set.has(d.id)).reduce((s, d) => s + d.total, 0);
  };

  const orgaosDisponiveis = useMemo(
    () => Array.from(new Set(debitos.map((d) => d.orgao))).sort(),
    [debitos],
  );
  const debitosFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    return debitos.filter((d) => {
      if (filtroOrgao !== "__all__" && d.orgao !== filtroOrgao) return false;
      if (filtroStatus !== "__all__" && inferStatus(d) !== filtroStatus) return false;
      if (q) {
        const hay = `${d.receita} ${d.competencia} ${d.vencimento || ""} ${d.observacao || ""} ${d.situacao || ""} ${orgaoLabel(d.orgao)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [debitos, search, filtroOrgao, filtroStatus]);

  const toggleSel = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const toggleAllOrgao = (ids: string[], allChecked: boolean) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (allChecked) ids.forEach((i) => n.delete(i));
      else ids.forEach((i) => n.add(i));
      return n;
    });

  const startEdit = (d: Debito) => {
    setEditing(d.id);
    setDraft({
      receita: d.receita,
      competencia: d.competencia,
      vencimento: d.vencimento,
      valorOriginal: d.valorOriginal,
      multa: d.multa,
      juros: d.juros,
      total: d.total,
      situacao: d.situacao,
      parcelado: d.parcelado,
    });
  };
  const saveEdit = (id: string) => {
    // Garante consistência: total = principal + multa + juros sempre que salvar.
    const total =
      Number(draft.valorOriginal || 0) +
      Number(draft.multa || 0) +
      Number(draft.juros || 0);
    onUpdate?.(id, { ...draft, total });
    setEditing(null);
  };

  const grouped: Record<string, Debito[]> = {};
  debitosFiltrados.forEach((d) => (grouped[d.orgao] = grouped[d.orgao] || []).push(d));

  if (!debitos.length) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
        Nenhum débito carregado ainda. Faça upload de um Relatório de Situação Fiscal.
      </div>
    );
  }

  const numInput = (key: keyof Debito) => (
    <Input
      type="number"
      step="0.01"
      value={Number(draft[key] ?? 0)}
      onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })}
      className="h-7 text-right tabular-nums px-1"
    />
  );
  const txtInput = (key: keyof Debito) => (
    <Input
      value={String(draft[key] ?? "")}
      onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
      className="h-7 px-1"
    />
  );

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="rounded-xl border border-border bg-card p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por tributo, competência, observação..."
            className="h-9 pl-8"
          />
        </div>
        <Select value={filtroOrgao} onValueChange={setFiltroOrgao}>
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue placeholder="Órgão" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os órgãos</SelectItem>
            {orgaosDisponiveis.map((o) => (
              <SelectItem key={o} value={o}>{orgaoLabel(o)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="h-9 w-[220px]">
            <SelectValue placeholder="Situação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as situações</SelectItem>
            {STATUS_OPCOES.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(search || filtroOrgao !== "__all__" || filtroStatus !== "__all__") && (
          <Button
            size="sm"
            variant="ghost"
            className="h-9"
            onClick={() => { setSearch(""); setFiltroOrgao("__all__"); setFiltroStatus("__all__"); }}
          >
            Limpar filtros
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {debitosFiltrados.length} de {debitos.length} débito(s)
        </span>
      </div>

      {!debitosFiltrados.length && (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhum débito corresponde aos filtros aplicados.
        </div>
      )}

      {Object.entries(grouped).map(([orgao, list]) => {
        const sub = list.reduce((s, d) => s + d.total, 0);
        const ids = list.map((d) => d.id);
        const selectedHere = ids.filter((i) => selected.has(i));
        const allChecked = ids.length > 0 && selectedHere.length === ids.length;
        const someChecked = selectedHere.length > 0 && !allChecked;
        return (
          <div key={orgao} className="rounded-xl border border-border bg-card overflow-hidden shadow-card">
            <div className="flex items-center justify-between bg-secondary px-5 py-3">
              <h3 className="font-bold text-secondary-foreground tracking-wide">{orgaoLabel(orgao)}</h3>
              <div className="flex items-center gap-3">
                <span className="text-secondary-foreground font-semibold tabular-nums">{fmtBRL(sub)}</span>
                {onRemoveMany && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-secondary-foreground hover:bg-destructive/20 hover:text-destructive"
                    onClick={() => setBulkAction({ kind: "delete-group", orgao, ids })}
                    title="Excluir todos os débitos deste órgão"
                  >
                    <Trash className="h-4 w-4 mr-1" /> Excluir grupo
                  </Button>
                )}
              </div>
            </div>
            {selectedHere.length > 0 && onUpdateMany && (
              <div className="flex flex-wrap items-center gap-3 bg-primary/10 border-b border-primary/30 px-5 py-2 text-xs">
                <span className="font-semibold text-foreground">
                  {selectedHere.length} selecionado(s) — alterar situação para:
                </span>
                <Select
                  onValueChange={(v: StatusParc) => {
                    const opt = STATUS_OPCOES.find((o) => o.value === v)!;
                    setBulkAction({
                      kind: "reclassify-selected",
                      orgao,
                      ids: selectedHere,
                      status: v,
                      label: opt.label,
                    });
                  }}
                >
                  <SelectTrigger className="h-7 w-[220px] text-xs bg-background">
                    <SelectValue placeholder="Escolha a situação..." />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPCOES.map((o) => (
                      <SelectItem key={o.value} value={o.value} className="text-xs">
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {onRemoveMany && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-destructive hover:bg-destructive/15"
                    onClick={() =>
                      setBulkAction({ kind: "delete-selected", orgao, ids: selectedHere })
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir selecionados
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-muted-foreground"
                  onClick={() =>
                    setSelected((prev) => {
                      const n = new Set(prev);
                      selectedHere.forEach((i) => n.delete(i));
                      return n;
                    })
                  }
                >
                  Limpar seleção
                </Button>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                  <tr>
                    {(onUpdateMany || onRemoveMany) && (
                      <th className="px-3 py-2 w-8">
                        <Checkbox
                          checked={allChecked ? true : someChecked ? "indeterminate" : false}
                          onCheckedChange={() => toggleAllOrgao(ids, allChecked)}
                          aria-label="Selecionar todos do órgão"
                        />
                      </th>
                    )}
                    <th className="text-left px-4 py-2 font-semibold">Tributo / Receita</th>
                    <th className="text-left px-4 py-2 font-semibold">Comp.</th>
                    <th className="text-left px-4 py-2 font-semibold">Vcto.</th>
                    <th className="text-right px-4 py-2 font-semibold">Original</th>
                    <th className="text-right px-4 py-2 font-semibold">Multa</th>
                    <th className="text-right px-4 py-2 font-semibold">Juros</th>
                    <th className="text-right px-4 py-2 font-semibold">Total</th>
                    <th className="text-center px-4 py-2 font-semibold">Situação</th>
                    {(onRemove || onUpdate) && <th />}
                  </tr>
                </thead>
                <tbody>
                  {list.map((d) => {
                    const isEd = editing === d.id;
                    return (
                      <tr key={d.id} className="border-t border-border hover:bg-muted/30">
                        {(onUpdateMany || onRemoveMany) && (
                          <td className="px-3 py-2 w-8">
                            <Checkbox
                              checked={selected.has(d.id)}
                              onCheckedChange={() => toggleSel(d.id)}
                              aria-label="Selecionar débito"
                            />
                          </td>
                        )}
                        <td className="px-4 py-2 font-medium">{isEd ? txtInput("receita") : d.receita}</td>
                        <td className="px-4 py-2 tabular-nums">{isEd ? txtInput("competencia") : d.competencia}</td>
                        <td className="px-4 py-2 tabular-nums">{isEd ? txtInput("vencimento") : (d.vencimento || "-")}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{isEd ? numInput("valorOriginal") : fmtBRL(d.valorOriginal)}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-warning">
                          {isEd
                            ? numInput("multa")
                            : d.valorJaAtualizado && !d.multa
                              ? <span title="Valor já atualizado pelo órgão com multa e juros embutidos no Total." className="text-muted-foreground italic">incluso</span>
                              : fmtBRL(d.multa)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-warning">
                          {isEd
                            ? numInput("juros")
                            : d.valorJaAtualizado && !d.juros
                              ? <span title="Valor já atualizado pelo órgão com multa e juros embutidos no Total." className="text-muted-foreground italic">incluso</span>
                              : fmtBRL(d.juros)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums font-bold">
                          {isEd
                            ? fmtBRL(
                                Number(draft.valorOriginal || 0) +
                                  Number(draft.multa || 0) +
                                  Number(draft.juros || 0),
                              )
                            : fmtBRL(d.total)}
                        </td>
                <td className="px-4 py-2 text-center">
                          {(() => {
                            const status = inferStatus(d);
                            const opt = STATUS_OPCOES.find((o) => o.value === status)!;
                            return (
                              <div className="flex flex-col items-center gap-1">
                                <Select
                                  value={status}
                                  onValueChange={(v: StatusParc) => {
                                    const parcelado = v !== "devedor";
                                    const labelMap: Record<StatusParc, string> = {
                                      "devedor": "DEVEDOR",
                                      "em-dia": "PARCELAMENTO EM DIA",
                                      "em-atraso": "PARCELAMENTO EM ATRASO",
                                      "rescisao": "PARCELAMENTO EM RESCISÃO",
                                      "divida-ativa": "EM DÍVIDA ATIVA",
                                    };
                                    onUpdate?.(d.id, {
                                      statusParc: v,
                                      parcelado,
                                      situacao: labelMap[v],
                                    });
                                  }}
                                >
                                  <SelectTrigger className={`h-7 w-[200px] text-[11px] font-semibold border ${toneClass(opt.tone)}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {STATUS_OPCOES.map((o) => (
                                      <SelectItem key={o.value} value={o.value} className="text-xs">
                                        {o.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {d.observacao && (
                                  <span className="text-[10px] text-muted-foreground max-w-[200px] truncate" title={d.observacao}>
                                    {d.observacao}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        {(onRemove || onUpdate) && (
                          <td className="px-2 whitespace-nowrap">
                            {isEd ? (
                              <>
                                <Button size="icon" variant="ghost" onClick={() => saveEdit(d.id)} title="Salvar">
                                  <Check className="h-4 w-4 text-emerald-600" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => setEditing(null)} title="Cancelar">
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <>
                                {onUpdate && (
                                  <Button size="icon" variant="ghost" onClick={() => startEdit(d)} title="Editar">
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                )}
                                {onRemove && (
                                  <Button size="icon" variant="ghost" onClick={() => onRemove(d.id)} title="Remover">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                )}
                              </>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* Confirmação de ações em massa */}
      <AlertDialog open={!!bulkAction} onOpenChange={(o) => !o && setBulkAction(null)}>
        <AlertDialogContent>
          {bulkAction && (() => {
            const total = sumTotal(bulkAction.ids);
            const orgaoNome = orgaoLabel(bulkAction.orgao);
            const titulo =
              bulkAction.kind === "delete-group"
                ? `Excluir TODOS os débitos de ${orgaoNome}?`
                : bulkAction.kind === "delete-selected"
                ? `Excluir débitos selecionados?`
                : `Reclassificar débitos selecionados?`;
            const acao =
              bulkAction.kind === "reclassify-selected"
                ? `Alterar a situação para `
                : `Remover `;
            const isDelete = bulkAction.kind !== "reclassify-selected";
            return (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>{titulo}</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-2">
                      <p>
                        {acao}
                        <span className="font-semibold text-foreground">
                          {bulkAction.ids.length} débito(s)
                        </span>
                        {bulkAction.kind === "reclassify-selected" && (
                          <>
                            {" "}para{" "}
                            <span className="font-semibold text-foreground">
                              "{bulkAction.label}"
                            </span>
                          </>
                        )}{" "}
                        do órgão <span className="font-semibold text-foreground">{orgaoNome}</span>,
                        somando{" "}
                        <span className="font-semibold text-foreground tabular-nums">
                          {fmtBRL(total)}
                        </span>
                        .
                      </p>
                      {filtrosAtivos && (
                        <p className="text-xs rounded-md border border-primary/30 bg-primary/10 px-2 py-1.5 text-foreground">
                          ⓘ Filtros ativos no momento — apenas débitos visíveis estão sendo
                          considerados ({debitosFiltrados.length} de {debitos.length} no total).
                        </p>
                      )}
                      {isDelete && (
                        <p className="text-xs text-destructive">
                          Esta ação não pode ser desfeita.
                        </p>
                      )}
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className={
                      isDelete
                        ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        : ""
                    }
                    onClick={() => {
                      const action = bulkAction;
                      if (action.kind === "delete-group" || action.kind === "delete-selected") {
                        onRemoveMany?.(action.ids);
                      } else {
                        const labelMap: Record<StatusParc, string> = {
                          "devedor": "DEVEDOR",
                          "em-dia": "PARCELAMENTO EM DIA",
                          "em-atraso": "PARCELAMENTO EM ATRASO",
                          "rescisao": "PARCELAMENTO EM RESCISÃO",
                          "divida-ativa": "EM DÍVIDA ATIVA",
                        };
                        onUpdateMany?.(action.ids, {
                          statusParc: action.status,
                          parcelado:
                            action.status !== "devedor" && action.status !== "divida-ativa",
                          situacao: labelMap[action.status],
                        });
                      }
                      setSelected((prev) => {
                        const n = new Set(prev);
                        action.ids.forEach((i) => n.delete(i));
                        return n;
                      });
                      setBulkAction(null);
                    }}
                  >
                    {isDelete ? "Excluir" : "Confirmar alteração"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
