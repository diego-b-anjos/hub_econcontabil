export const fmtBRL = (n: number) =>
  (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const orgaoLabel = (o: string) => {
  switch (o) {
    case "RFB": return "Receita Federal";
    case "PGFN": return "PGFN";
    case "Estadual": return "Fazenda Estadual";
    case "Municipal": return "Prefeitura Municipal";
    default: return o;
  }
};
