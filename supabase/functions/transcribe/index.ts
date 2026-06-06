import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DeepgramResponse {
  results: {
    channels: Array<{
      alternatives: Array<{ transcript: string }>;
    }>;
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("DEEPGRAM_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Deepgram not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (_err) {
    return new Response(JSON.stringify({ error: "Invalid multipart/form-data" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const audioFile = formData.get("audio");
  if (!audioFile || !(audioFile instanceof File)) {
    return new Response(JSON.stringify({ error: "No audio file provided" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const audioBytes = await audioFile.arrayBuffer();
    const contentType = audioFile.type || "audio/m4a";

    const dgRes = await fetch(
      "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&language=en-US&punctuate=true",
      {
        method: "POST",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": contentType,
        },
        body: audioBytes,
      }
    );

    if (!dgRes.ok) {
      return new Response(JSON.stringify({ error: "Transcription failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = (await dgRes.json()) as DeepgramResponse;
    const transcript =
      data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";

    return new Response(JSON.stringify({ transcript }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (_err) {
    return new Response(JSON.stringify({ error: "Transcription failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
