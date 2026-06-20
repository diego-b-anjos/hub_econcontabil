import { useState } from "react";
import { FileSignature, Pencil, Check, X, AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { Parcelamento } from "@/lib/endividamento/types";
import { fmtBRL, orgaoLabel } from "@/lib/endividamento/format";

interface Props {
  items: Parcelamento[];
  onUpdate?: (id: string, patch: Partial<Parcelamento>) => void;
  onRemove?: (id: string) => void;
  onRemoveAll?: () => void;
}

export function ParcelamentosList({ items, onUpdate, onRemove, onRemoveAll }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Parcelamento>>({});
  const [confirmDel, setConfirmDel] = useState<Parcelamento | null>(null);
  const [confirmDelAll, setConfirmDelAll] = useState(false);

  if (!items.length) return null;

  const start = (p: Parcelamento) => {
    setEditing(p.id);
    setDraft({
      parcelasEmAtraso: p.parcelasEmAtraso,
      valorEmAtraso: p.valorEmAtraso,
      modalidade: p.modalidade,
      situacao: p.situacao,
    });
  };
  const save = (id: string) => {
    onUpdate?.(id, draft);
    setEditing(null);
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 bg-gradient-brand px-5 py-3">
        <div className="flex items-center gap-2">
          <FileSignature className="h-5 w-5" />
          <h3 className="font-bold tracking-wide">Parcelamentos Ativos</h3>
        </div>
        {onRemoveAll && items.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 hover:bg-destructive/20 hover:text-destructive"
            onClick={() => setConfirmDelAll(true)}
            title="Excluir todos os parcelamentos"
          >
            <Trash2 className="h-4 w-4 mr-1" /> Excluir todos
          </Button>
        )}
      </div>
      <div className="divide-y divide-border">
        {items.map((p) => {
          const isEd = editing === p.id;
          const incompleto = p.parcelasEmAtraso == null || p.valorEmAtraso == null;
          return (
            <div key={p.id} className="px-5 py-4 flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-[220px]">
                <p className="font-semibold flex items-center gap-2">
                  {p.identificador}
                  {incompleto && !isEd && (
                    <span title="Faltam informações de atraso — clique em editar para preencher" className="inline-flex items-center gap-1 text-[10px] font-medium text-warning">
                      <AlertTriangle className="h-3 w-3" /> faltam dados
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {orgaoLabel(p.orgao)} {p.modalidade ? `• ${p.modalidade}` : ""}
                </p>
              </div>
              <div className="flex items-end gap-4 text-sm">
                <div className="min-w-[90px]">
                  <p className="text-xs text-muted-foreground">Parc. atraso</p>
                  {isEd ? (
                    <Input
                      type="number"
                      min={0}
                      className="h-7 w-20 px-2 text-right tabular-nums"
                      value={draft.parcelasEmAtraso ?? ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          parcelasEmAtraso: e.target.value === "" ? undefined : Number(e.target.value),
                        })
                      }
                    />
                  ) : (
                    <p className={`font-bold ${p.parcelasEmAtraso ? "text-destructive" : "text-muted-foreground"}`}>
                      {p.parcelasEmAtraso ?? "—"}
                    </p>
                  )}
                </div>
                <div className="min-w-[120px]">
                  <p className="text-xs text-muted-foreground">Valor atraso</p>
                  {isEd ? (
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      className="h-7 w-32 px-2 text-right tabular-nums"
                      value={draft.valorEmAtraso ?? ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          valorEmAtraso: e.target.value === "" ? undefined : Number(e.target.value),
                        })
                      }
                    />
                  ) : (
                    <p className={`font-bold tabular-nums ${p.valorEmAtraso ? "" : "text-muted-foreground"}`}>
                      {p.valorEmAtraso != null ? fmtBRL(p.valorEmAtraso) : "—"}
                    </p>
                  )}
                </div>
                {onUpdate && (
                  <div className="flex items-center">
                    {isEd ? (
                      <>
                        <Button size="icon" variant="ghost" onClick={() => save(p.id)} title="Salvar">
                          <Check className="h-4 w-4 text-emerald-600" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setEditing(null)} title="Cancelar">
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="icon" variant="ghost" onClick={() => start(p)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {onRemove && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setConfirmDel(p)}
                            title="Excluir parcelamento"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir parcelamento?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDel && (
                <>
                  Você está prestes a remover o parcelamento{" "}
                  <span className="font-semibold text-foreground">{confirmDel.identificador}</span>{" "}
                  ({orgaoLabel(confirmDel.orgao)}). Esta ação não pode ser desfeita.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmDel) onRemove?.(confirmDel.id);
                setConfirmDel(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelAll} onOpenChange={setConfirmDelAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir todos os parcelamentos?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a remover{" "}
              <span className="font-semibold text-foreground">{items.length} parcelamento(s)</span>{" "}
              ativos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                onRemoveAll?.();
                setConfirmDelAll(false);
              }}
            >
              Excluir todos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
