// Vercel Serverless Function: FLUX Kontext proxy for hair color generation
// Endpoint: POST /api/generate
//   Body: { image_url: string (data URL or http URL), color_name: string }
//   Response: { image_url: string, seconds: number }

import { fal } from "@fal-ai/client";

// Auth via env var - set FAL_KEY in Vercel project settings
fal.config({ credentials: process.env.FAL_KEY });

// Color presets mapped to natural language prompts for FLUX Kontext
// Keep prompts focused on hair only - "keep everything else the same" is critical
const COLOR_PROMPTS = {
  "Ash Brown":    "Change only the hair color to a natural ash brown with cool undertones. Preserve the exact same hairstyle, face, skin, background, clothing, and lighting. Do not change anything except hair color.",
  "Pink Beige":   "Change only the hair color to a soft pink beige pastel tone. Preserve the exact same hairstyle, face, skin, background, clothing, and lighting. Do not change anything except hair color.",
  "Olive Beige":  "Change only the hair color to a muted olive beige with greenish-gold undertones. Preserve the exact same hairstyle, face, skin, background, clothing, and lighting. Do not change anything except hair color.",
  "Lavender":     "Change only the hair color to a soft lavender purple. Preserve the exact same hairstyle, face, skin, background, clothing, and lighting. Do not change anything except hair color.",
  "Dark Cherry":  "Change only the hair color to a rich dark cherry red with burgundy tones. Preserve the exact same hairstyle, face, skin, background, clothing, and lighting. Do not change anything except hair color.",
  "Honey Blonde": "Change only the hair color to a warm honey blonde with golden highlights. Preserve the exact same hairstyle, face, skin, background, clothing, and lighting. Do not change anything except hair color.",
  "Blue Black":   "Change only the hair color to a deep blue-black with subtle cool blue undertones. Preserve the exact same hairstyle, face, skin, background, clothing, and lighting. Do not change anything except hair color.",
  "Copper":       "Change only the hair color to a vibrant copper orange with warm reddish tones. Preserve the exact same hairstyle, face, skin, background, clothing, and lighting. Do not change anything except hair color.",
};

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const start = Date.now();

  try {
    const { image_url, color_name, custom_prompt } = req.body || {};

    if (!image_url) {
      return res.status(400).json({ error: "image_url is required" });
    }

    const prompt = custom_prompt
      || COLOR_PROMPTS[color_name]
      || `Change only the hair color to ${color_name}. Preserve the exact same hairstyle, face, skin, background, clothing, and lighting.`;

    // Upload data URL to fal storage first if it's a data URL (fal accepts them directly too,
    // but explicit upload is more reliable for large images)
    let finalImageUrl = image_url;
    if (image_url.startsWith("data:")) {
      // fal.subscribe accepts data URLs directly in recent SDK versions; let it handle the upload.
      finalImageUrl = image_url;
    }

    const result = await fal.subscribe("fal-ai/flux-pro/kontext", {
      input: {
        prompt,
        image_url: finalImageUrl,
        guidance_scale: 3.5,
        num_inference_steps: 28,
        output_format: "jpeg",
        safety_tolerance: "2",
      },
      logs: false,
    });

    const imageUrl = result?.data?.images?.[0]?.url;
    if (!imageUrl) {
      throw new Error("No image in fal.ai response");
    }

    return res.status(200).json({
      image_url: imageUrl,
      seconds: (Date.now() - start) / 1000,
      prompt_used: prompt,
    });
  } catch (err) {
    console.error("FLUX Kontext error:", err);
    return res.status(500).json({
      error: err?.message || String(err),
      seconds: (Date.now() - start) / 1000,
    });
  }
}

// Vercel-specific config: allow large body (base64 images can be >1MB)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};
