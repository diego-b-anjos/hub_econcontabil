import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { User, Mail, Hash, Phone, Save } from "lucide-react";

export default function Perfil() {
  const { user, updateProfile } = useAuth();
  const { toast } = useToast();

  const [form, setForm] = useState({
    name: "",
    email: "",
    crc: "",
    phone: "",
  });

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || "",
        email: user.email || "",
        crc: user.crc || "",
        phone: user.phone || "",
      });
    }
  }, [user]);

  const handleChange = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast({ title: "Nome obrigatório", description: "Informe seu nome completo.", variant: "destructive" });
      return;
    }
    if (!form.email.trim()) {
      toast({ title: "E-mail obrigatório", description: "Informe seu e-mail.", variant: "destructive" });
      return;
    }
    updateProfile({
      name: form.name.trim(),
      email: form.email.trim(),
      crc: form.crc.trim(),
      phone: form.phone.trim(),
    });
    toast({ title: "Perfil atualizado", description: "Suas informações foram salvas com sucesso." });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Perfil do Contador</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Suas informações aparecem nos relatórios e exportações de PDF gerados pelo sistema.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados Pessoais</CardTitle>
          <CardDescription>
            Nome, e-mail e registro profissional exibidos nas apresentações e documentos exportados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name" className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Nome completo
            </Label>
            <Input
              id="name"
              placeholder="Ex.: João da Silva"
              value={form.name}
              onChange={handleChange("name")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> E-mail
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="Ex.: joao@escritorio.com.br"
              value={form.email}
              onChange={handleChange("email")}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="crc" className="flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5" /> CRC (Registro profissional)
            </Label>
            <Input
              id="crc"
              placeholder="Ex.: CRC/SP 123456/O-7"
              value={form.crc}
              onChange={handleChange("crc")}
            />
            <p className="text-xs text-muted-foreground">
              Número do Conselho Regional de Contabilidade. Aparece na assinatura dos relatórios.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" /> Telefone / WhatsApp
            </Label>
            <Input
              id="phone"
              placeholder="Ex.: (11) 9 9999-9999"
              value={form.phone}
              onChange={handleChange("phone")}
            />
          </div>

          <div className="pt-2">
            <Button onClick={handleSave} className="gap-2">
              <Save className="w-4 h-4" /> Salvar alterações
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Escritório</CardTitle>
          <CardDescription>
            Informações fixas do escritório contábil.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex justify-between">
            <span className="font-medium text-foreground">Razão Social</span>
            <span>Econ Escritório Contábil Ltda</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="font-medium text-foreground">Sistema</span>
            <span>ECON Hub do Escritório</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="font-medium text-foreground">Versão</span>
            <span>1.0.0</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
