import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import WebSocketServer from 'ws';

dotenv.config();

if (!process.env.GEMINI_API_KEY || !process.env.ELEVENLABS_API_KEY || !process.env.HUME_API_KEY) {
  console.error("❌ CRITICAL ERROR: Missing API keys in backend/.env file.");
  process.exit(1);
}

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: { apiVersion: 'v1beta' }
});
const elevenLabs = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });

app.post('/api/chat', async (req, res) => {
  try {
    const { message, provider, voiceId } = req.body;

    if (!message || !provider || !voiceId) {
      return res.status(400).json({ error: 'Missing required fields: message, provider, or voiceId' });
    }

    // ── Step 1: Generate conversational text with the standard chat model ──
    // This is always gemini-2.5-flash regardless of provider — it only does text.
    const textResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: message,
    });
    const aiText = textResponse.text || "I couldn't process an answer.";

    res.setHeader('X-AI-Text', encodeURIComponent(aiText));

    // ── Step 2: Convert that text to speech via the chosen provider ──
    switch (provider) {

      case 'google': {
        // gemini-2.5-flash-preview-tts is a dedicated TTS model — it only accepts
        // plain text and returns audio. It cannot answer questions on its own,
        // which is why we generated the text separately above.
        res.setHeader('Content-Type', 'audio/wav');

        const ttsResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash-preview-tts',
          contents: aiText,
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voiceId }, // e.g. "Puck", "Kore"
              },
            },
          },
        });

        const part = ttsResponse.candidates?.[0]?.content?.parts?.[0];
        if (part && 'inlineData' in part && part.inlineData?.data) {
          res.write(Buffer.from(part.inlineData.data, 'base64'));
        } else {
          throw new Error('Google TTS returned no audio data');
        }
        res.end();
        break;
      }

      case 'elevenlabs': {
        res.setHeader('Content-Type', 'audio/mpeg');

        const elevenStream = await elevenLabs.textToSpeech.stream(voiceId, {
          text: aiText,
          modelId: 'eleven_flash_v2_5',
        });

        for await (const chunk of elevenStream) {
          res.write(chunk);
        }
        res.end();
        break;
      }

      case 'hume':
        throw new Error('Hume voice provider is not yet implemented.');

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

  } catch (error: any) {
    console.error('Backend pipeline error intercepted:', error.message);
    console.error('Full stack:', error.stack);

    if (res.headersSent) {
      console.warn('⚠️ Error occurred mid-stream. Closing connection.');
      res.end();
      return;
    }

    let statusCode = 500;
    let errorMessage = 'Internal server processing failed. Please try again.';

    const errorString = JSON.stringify(error);
    const messageText = error.message || '';

    if (
      error.status === 503 ||
      error.statusCode === 503 ||
      messageText.includes('503') ||
      messageText.includes('high demand') ||
      errorString.includes('503') ||
      errorString.includes('UNAVAILABLE')
    ) {
      statusCode = 503;
      errorMessage = 'The Google Gemini server is experiencing high demand. Please wait a moment and try again.';
    } else if (error.message) {
      errorMessage = error.message;
    }

    res.status(statusCode).json({ error: errorMessage });
  }
});

app.listen(port, () => {
  console.log(`Multi-Provider Studio Live on http://localhost:${port}`);
});