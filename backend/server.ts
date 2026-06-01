import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

dotenv.config();

if (!process.env.GEMINI_API_KEY || !process.env.ELEVENLABS_API_KEY) {
  console.error("❌ CRITICAL ERROR: Missing API keys in backend/.env file.");
  process.exit(1);
}

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const elevenLabs = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });

app.post('/api/chat', async (req, res) => {
  try {
    // 1. Accept the message, chosen provider, and specific voiceId from React
    const { message, provider, voiceId } = req.body;
    
    if (!message || !provider || !voiceId) {
      return res.status(400).json({ error: 'Missing required fields: message, provider, or voiceId' });
    }

    // 2. Generate the master conversation text using Gemini
    const geminiResponse = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: message,
    });

    const aiText = geminiResponse.text || "I couldn't process an answer.";

    // Set shared audio streaming headers
    res.setHeader('X-AI-Text', encodeURIComponent(aiText));

    // 3. Dynamic Audio Routing Engine
    switch (provider) {
      case 'google':
        res.setHeader('Content-Type', 'audio/wav'); // Gemini TTS streams raw PCM audio wrapped in WAV container
        
        // Call Gemini's built-in multi-modal audio generation engine
        const googleAudioResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash', // Use Gemini 2.5 flash which features native audio output capabilities
          contents: aiText,
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voiceId, // e.g., "Puck", "Charon", "Kore"
                },
              },
            },
          },
        });

        // Unpack the base64 audio chunks natively returned by Google GenAI
        const candidate = googleAudioResponse.candidates?.[0];
        const part = candidate?.content?.parts?.[0];
        
        if (part && 'inlineData' in part && part.inlineData?.data) {
          const audioBuffer = Buffer.from(part.inlineData.data, 'base64');
          res.write(audioBuffer);
        } else {
          throw new Error("Failed to extract native audio modality content from Google API response");
        }
        res.end();
        break;

      case 'elevenlabs':
        res.setHeader('Content-Type', 'audio/mpeg');
        
        const elevenStream = await elevenLabs.textToSpeech.stream(voiceId, {
          text: aiText,
          modelId: "eleven_flash_v2_5",
        });

        for await (const chunk of elevenStream) {
          res.write(chunk);
        }
        res.end();
        break;

      case 'hume':
        // Placeholder wrapper for your upcoming Hume EVI implementation structure
        throw new Error("Hume voice provider selected, but backend service connection is still in staging.");

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

  } catch (error: any) {
    console.error("Backend pipeline error:", error);
    if (res.headersSent) {
      console.warn("⚠️ Error occurred mid-stream. Closing connection abruptly.");
      res.end();
      return; 
    }
    res.status(500).json({ error: error.message || 'Internal server processing failed.' });
  }
});

app.listen(port, () => {
  console.log(`Multi-Provider Studio Live on http://localhost:${port}`);
});