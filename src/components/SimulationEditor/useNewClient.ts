import { useState } from "react";
import { toast } from "sonner";
import { apiClients } from "@/lib/api";
import { lookupCnpj, formatCNPJ, onlyDigitsCnpj } from "@/lib/cnpj";
import type { ClientOption } from "./ParametrosTab";

export function useNewClient(opts: {
  setClients: (updater: (prev: ClientOption[]) => ClientOption[]) => void;
  setClientId: (id: string) => void;
}) {
  const { setClients, setClientId } = opts;
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", cnpj: "", activity: "" });
  const [creatingClient, setCreatingClient] = useState(false);
  const [lastLookup, setLastLookup] = useState<Awaited<ReturnType<typeof lookupCnpj>> | null>(null);

  const lookupNewCNPJ = async () => {
    const digits = onlyDigitsCnpj(newClient.cnpj);
    if (digits.length !== 14) return toast.error("Informe um CNPJ válido (14 dígitos)");
    try {
      const d = await lookupCnpj(digits);
      setLastLookup(d);
      setNewClient((p) => ({
        ...p,
        cnpj: formatCNPJ(digits),
        name: p.name || d.razaoSocial || d.nomeFantasia || "",
        activity: p.activity || d.cnaePrincipalDescricao || "",
      }));
      toast.success("Dados do CNPJ preenchidos");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao consultar CNPJ");
    }
  };

  const createClient = async () => {
    if (!newClient.name.trim()) return toast.error("Informe o nome do cliente");
    setCreatingClient(true);
    try {
      const d = lastLookup;
      const enderecoFormatado = d?.enderecoFormatado || null;
      const data = await apiClients.create({
        name: newClient.name,
        nomeFantasia: d?.nomeFantasia || null,
        cnpj: newClient.cnpj || null,
        inscricaoEstadual: d?.inscricaoEstadual || null,
        inscricaoMunicipal: null,
        taxRegime: d?.taxRegime || null,
        naturezaJuridica: d?.naturezaJuridica || null,
        porte: d?.porte || null,
        dataAbertura: d?.dataAbertura || null,
        situacaoCadastral: d?.situacaoCadastral || null,
        capitalSocial: d?.capitalSocial || null,
        activity: newClient.activity || d?.cnaePrincipalDescricao || null,
        cnaePrincipalCodigo: d?.cnaePrincipalCodigo || null,
        cnaePrincipalDescricao: d?.cnaePrincipalDescricao || null,
        cnaesSecundarios: d?.cnaesSecundarios?.length ? d.cnaesSecundarios : null,
        cep: d?.cep || null,
        logradouro: d?.logradouro || null,
        numero: d?.numero || null,
        complemento: d?.complemento || null,
        bairro: d?.bairro || null,
        municipio: d?.municipio || null,
        uf: d?.uf || null,
        address: enderecoFormatado,
        telefone: d?.telefone || null,
        telefoneSecundario: d?.telefoneSecundario || null,
        email: d?.email || null,
        notes: null,
      });
      setCreatingClient(false);
      setClients((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setClientId(data.id);
      setNewClient({ name: "", cnpj: "", activity: "" });
      setLastLookup(null);
      setNewClientOpen(false);
      toast.success("Cliente cadastrado com dados completos");
    } catch (e) {
      setCreatingClient(false);
      toast.error(e instanceof Error ? e.message : "Erro ao cadastrar cliente");
    }
  };

  return { newClientOpen, setNewClientOpen, newClient, setNewClient, creatingClient, lookupNewCNPJ, createClient };
}
