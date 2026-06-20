import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Construction } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Props {
  title: string;
  description: string;
  icon: LucideIcon;
}

export default function ModulePlaceholder({ title, description, icon: Icon }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg bg-brand/15 text-brand flex items-center justify-center">
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-3">
            {title}
            <Badge variant="secondary" className="text-xs">Em breve</Badge>
          </h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-10 flex flex-col items-center justify-center text-center gap-4">
          <Construction className="w-12 h-12 text-brand" />
          <div>
            <div className="font-display font-bold text-lg">Módulo em portabilidade</div>
            <p className="text-sm text-muted-foreground max-w-md mt-1">
              Este módulo será integrado em breve ao hub do escritório, mantendo o mesmo banco
              de dados e autenticação dos demais.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
