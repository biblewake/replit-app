import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const FALLBACK_VERSES: Array<{ reference: string; text: string }> = [
  { reference: "Psalm 118:24", text: "This is the day the Lord has made; let us rejoice and be glad in it." },
  { reference: "Isaiah 40:29-31", text: "He gives strength to the weary and increases the power of the weak. Even youths grow tired and weary, and young men stumble and fall; but those who hope in the Lord will renew their strength. They will soar on wings like eagles; they will run and not grow weary, they will walk and not be faint." },
  { reference: "Philippians 4:6-7", text: "Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God. And the peace of God, which transcends all understanding, will guard your hearts and your minds in Christ Jesus." },
  { reference: "Proverbs 3:5-6", text: "Trust in the Lord with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight." },
  { reference: "Joshua 1:9", text: "Have I not commanded you? Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you wherever you go." },
  { reference: "Romans 8:28", text: "And we know that in all things God works for the good of those who love him, who have been called according to his purpose." },
  { reference: "Lamentations 3:22-23", text: "Because of the Lord's great love we are not consumed, for his compassions never fail. They are new every morning; great is your faithfulness." },
  { reference: "Psalm 118:24", text: "This is the day the Lord has made; we will rejoice and be glad in it." },
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname;

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "OpenAI not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (path.endsWith("/by-reference")) {
    return handleByReference(req, apiKey);
  } else if (path.endsWith("/suggest")) {
    return handleSuggest(req, apiKey);
  }

  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

async function handleByReference(req: Request, apiKey: string): Promise<Response> {
  const body = await req.json() as { reference?: string; version?: string };
  const { reference, version = "NIV" } = body;

  if (!reference) {
    return new Response(JSON.stringify({ error: "reference is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const completion = await openaiChat(apiKey, {
      model: "gpt-4o-mini",
      max_tokens: 1024,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a Bible verse lookup assistant. Return ONLY valid JSON with exactly these fields: "reference" (string, canonical form like "John 3:16"), "text" (string, full verse text), "version" (string).`,
        },
        {
          role: "user",
          content: `Look up this Bible reference in the ${version} version: "${reference}". If it spans multiple verses (e.g. "Romans 5:3-4"), include all of them joined into one continuous text. Return JSON: {"reference":"...","text":"...","version":"${version}"}`,
        },
      ],
    });

    const choice = completion.choices[0];
    if (!choice || choice.finish_reason !== "stop") {
      return new Response(JSON.stringify({ error: "Failed to fetch verse" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const parsed = JSON.parse(choice.message?.content ?? "{}");
    return new Response(JSON.stringify(parsed), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (_err) {
    return new Response(JSON.stringify({ error: "Failed to fetch verse" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
}

async function handleSuggest(req: Request, apiKey: string): Promise<Response> {
  const body = await req.json() as { theme?: string; version?: string };
  const { theme, version = "NIV" } = body;

  const themePrompt = theme
    ? `Theme: ${theme}`
    : "Pick a theme for morning reflection: morning, strength, peace, gratitude, courage, or hope.";

  try {
    const completion = await openaiChat(apiKey, {
      model: "gpt-4o-mini",
      max_tokens: 300,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a Bible verse assistant. Return ONLY valid JSON: {"reference":"...","text":"...","version":"..."}. Select 1-3 consecutive verses that form a complete, meaningful thought. Use a range like "Romans 8:28-29" when selecting multiple verses. Keep the total passage under 80 words.`,
        },
        {
          role: "user",
          content: `${themePrompt}\n\nSuggest 1-3 consecutive ${version} Bible verses (as a coherent passage, under 80 words total) for morning reflection. Return JSON only.`,
        },
      ],
    });

    const choice = completion.choices[0];
    const raw = choice?.message?.content ?? "";
    if (choice?.finish_reason === "stop" && raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.reference && parsed.text) {
          return new Response(JSON.stringify({ ...parsed, version: parsed.version ?? version }), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }
      } catch (_) {}
    }

    const fallback = FALLBACK_VERSES[Math.floor(Math.random() * FALLBACK_VERSES.length)];
    return new Response(JSON.stringify({ ...fallback, version }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (_err) {
    const fallback = FALLBACK_VERSES[Math.floor(Math.random() * FALLBACK_VERSES.length)];
    return new Response(JSON.stringify({ ...fallback, version }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
}

async function openaiChat(apiKey: string, body: unknown): Promise<{
  choices: Array<{ finish_reason: string; message: { content: string } }>;
}> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`OpenAI error ${res.status}`);
  }
  return res.json();
}
