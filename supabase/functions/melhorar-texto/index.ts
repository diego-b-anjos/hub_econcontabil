// Edge function: melhora um texto curto para usar em apresentação executiva.
// Usa Lovable AI Gateway (LOVABLE_API_KEY já provisionado).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { texto, titulo, contexto } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY ausente" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!texto || typeof texto !== "string") {
      return new Response(JSON.stringify({ error: "Campo 'texto' é obrigatório." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const system = [
      "Você é um redator executivo da Econ Escritório Contábil.",
      "Sua tarefa: refinar um texto que será exibido como slide de apresentação institucional.",
      "Diretrizes:",
      "- Tom executivo, claro e profissional, em português do Brasil.",
      "- Preserve o sentido e os números mencionados pelo autor.",
      "- Limite a 120-180 palavras.",
      "- Use parágrafos curtos (2-3 frases) e, se ajudar, no máximo 3 bullets curtos com hífen.",
      "- Não invente dados nem cite fontes externas.",
      "- Devolva APENAS o texto final, sem comentários, sem aspas, sem markdown adicional.",
    ].join("\n");

    const userPrompt = [
      titulo ? `Título do slide: ${titulo}` : "",
      contexto ? `Contexto da apresentação: ${contexto}` : "",
      "Texto original a refinar:",
      texto,
    ].filter(Boolean).join("\n\n");

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (r.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (r.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos da IA esgotados. Recarregue em Settings > Workspace > Usage." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!r.ok) {
      const t = await r.text();
      console.error("AI gateway error:", r.status, t);
      return new Response(JSON.stringify({ error: "Falha no gateway de IA." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await r.json();
    const out = data?.choices?.[0]?.message?.content?.trim() || "";
    return new Response(JSON.stringify({ texto: out }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("melhorar-texto error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
