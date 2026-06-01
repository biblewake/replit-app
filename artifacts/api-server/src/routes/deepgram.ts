import { Router } from "express";
import multer from "multer";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

interface DeepgramResponse {
  results: {
    channels: Array<{
      alternatives: Array<{ transcript: string }>;
    }>;
  };
}

router.post("/deepgram/transcribe", upload.single("audio"), async (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "No audio file provided" });
    return;
  }

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Deepgram not configured" });
    return;
  }

  try {
    const contentType = file.mimetype || "audio/m4a";
    const dgRes = await fetch(
      "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&language=en-US&punctuate=true",
      {
        method: "POST",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": contentType,
        },
        body: file.buffer,
      }
    );

    if (!dgRes.ok) {
      const errText = await dgRes.text();
      req.log.error({ status: dgRes.status, errText }, "Deepgram API error");
      res.status(500).json({ error: "Transcription failed" });
      return;
    }

    const data = (await dgRes.json()) as DeepgramResponse;
    const transcript =
      data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
    req.log.info({ transcript }, "deepgram transcription complete");
    res.json({ transcript });
  } catch (err) {
    req.log.error(err, "deepgram transcription error");
    res.status(500).json({ error: "Transcription failed" });
  }
});

export default router;
