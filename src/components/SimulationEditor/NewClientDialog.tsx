import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export interface NewClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newClient: { name: string; cnpj: string; activity: string };
  setNewClient: (v: { name: string; cnpj: string; activity: string }) => void;
  lookupNewCNPJ: () => void;
  createClient: () => void;
  creatingClient: boolean;
}

export function NewClientDialog({
  open,
  onOpenChange,
  newClient,
  setNewClient,
  lookupNewCNPJ,
  createClient,
  creatingClient,
}: NewClientDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Novo cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>CNPJ</Label>
            <div className="flex gap-2">
              <Input
                value={newClient.cnpj}
                onChange={(e) => setNewClient({ ...newClient, cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
              />
              <Button type="button" variant="outline" onClick={lookupNewCNPJ}>Buscar</Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Nome / Razão social *</Label>
            <Input value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Atividade</Label>
            <Input value={newClient.activity} onChange={(e) => setNewClient({ ...newClient, activity: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={createClient} disabled={creatingClient}>
            {creatingClient ? "Salvando…" : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
