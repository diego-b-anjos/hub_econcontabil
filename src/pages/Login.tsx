import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function Login() {
  const { user, loading, signIn, signUp } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) nav("/app");
  }, [user, loading, nav]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Informe um e-mail para entrar.");
      return;
    }
    if (!password.trim()) {
      toast.error("Informe a senha.");
      return;
    }
    setSubmitting(true);
    try {
      if (isSignUp) {
        await signUp(name, email, password);
        toast.success("Conta criada! Verifique seu e-mail para confirmar o cadastro.");
      } else {
        await signIn(email, password);
        nav("/app");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao autenticar.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-dark text-primary-foreground relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-brand/20 blur-3xl" />
        <Logo className="h-12 relative" variant="light" />
        <div className="relative space-y-6 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand/15 text-brand text-xs font-semibold uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
            Econ Escritório Contábil Ltda
          </div>
          <h1 className="text-4xl xl:text-5xl font-display font-bold leading-tight">
            Hub do escritório
            <span className="block text-brand">tudo em um só lugar.</span>
          </h1>
          <p className="text-lg text-primary-foreground/70">
            Plataforma centralizada da Econ Escritório Contábil Ltda, reunindo
            módulos tributários, fiscais e de auditoria em um único sistema —
            comparativos, apurações, SPED, benefícios fiscais e análise da
            Reforma Tributária.
          </p>
          <ul className="space-y-2 text-primary-foreground/80 text-sm">
            <li>✓ Múltiplos módulos integrados em um único sistema</li>
            <li>✓ Cadastro de clientes compartilhado entre módulos</li>
            <li>✓ Relatórios institucionais padronizados em PDF e Excel</li>
            <li>✓ Novos módulos sendo adicionados continuamente</li>
          </ul>
        </div>
        <div className="text-xs text-primary-foreground/40 relative">
          © {new Date().getFullYear()} Econ Escritório Contábil Ltda
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <form onSubmit={handleSubmit} className="w-full max-w-md space-y-6">
          <div className="lg:hidden flex justify-center">
            <Logo className="h-10" />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-display font-bold">
              {isSignUp ? "Criar conta" : "Acessar o hub"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isSignUp
                ? "Preencha os dados abaixo para criar sua conta na plataforma."
                : "Bem-vindo à plataforma da "}
              {!isSignUp && (
                <span className="font-semibold text-foreground">
                  Econ Escritório Contábil Ltda
                </span>
              )}
              {!isSignUp && ". Informe seu e-mail e senha para entrar."}
            </p>
          </div>

          <div className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome completo"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@escritorio.com.br"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={submitting}
            >
              {submitting
                ? isSignUp
                  ? "Criando conta…"
                  : "Entrando…"
                : isSignUp
                ? "Criar conta"
                : "Entrar"}
            </Button>
          </div>

          <div className="text-center space-y-2">
            <button
              type="button"
              onClick={() => setIsSignUp((v) => !v)}
              className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
            >
              {isSignUp ? "Já tenho conta — fazer login" : "Criar conta"}
            </button>
            <div>
              <Link
                to="/"
                className="text-xs text-muted-foreground hover:underline"
              >
                Voltar à página inicial
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
