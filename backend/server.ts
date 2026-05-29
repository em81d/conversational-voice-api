import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

dotenv.config();

// 1. Validate that the environment variables exist before initializing clients
if (!process.env.GEMINI_API_KEY || !process.env.ELEVENLABS_API_KEY) {
  console.error("❌ CRITICAL ERROR: Missing GEMINI_API_KEY or ELEVENLABS_API_KEY in backend/.env file.");
  process.exit(1); // Shuts down the backend immediately so you know you missed a setup step
}

const app = express();
const port = process.env.PORT || 5000;

// Enable cross-origin calls so your React frontend (port 5173) can query this server safely
app.use(cors());
app.use(express.json());

// Initialize Orchestration Clients
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const elevenLabs = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message payload is required' });
    }

    // 1. Generate text using Gemini
    const geminiResponse = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: message,
    });

    const aiText = geminiResponse.text || "I couldn't process an answer.";

    // 2. Generate matching audio stream via ElevenLabs
    // '21m00Tcm4TlvDq8ikWAM' is Rachel, a standard pre-loaded voice
    const audioStream = await elevenLabs.textToSpeech.stream("21m00Tcm4TlvDq8ikWAM", {
      text: aiText,
      modelId: "eleven_flash_v2_5", // Optimized for real-time speech generation speed
    });

    // 3. Set standard response headers telling the browser binary audio is coming
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('X-AI-Text', encodeURIComponent(aiText)); // Send text in a custom header

    // 4. Pipe the raw audio chunks straight down the HTTP pipeline to React
    for await (const chunk of audioStream) {
      res.write(chunk);
    }
    
    res.end();

  } catch (error) {
    console.error("Backend pipeline error:", error);
    res.status(500).json({ error: 'Internal server processing failed' });
  }
});

app.listen(port, () => {
  console.log(`Server live on http://localhost:${port}`);
});