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

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    apiVersion: 'v1beta'
  }
});
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
      model: 'gemini-2.5-flash',
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
          model: 'gemini-2.5-flash', // Use Gemini 1.5 flash which features native audio output capabilities
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
    console.error("Backend pipeline error intercepted:", error.message);
    console.error("Full stack:", error.stack);  // ← add this
    
    // 1. If headers were already sent mid-stream, terminate clean
    if (res.headersSent) {
      console.warn("⚠️ Error occurred mid-stream. Closing connection abruptly.");
      res.end();
      return; 
    }

    // Default values if we can't find a specific error code
    let statusCode = 500;
    let errorMessage = 'Internal server processing failed. Please try again.';

    // 2. STAGE 2 DETECTOR: Inspect the raw error object from the @google/genai SDK
    // The SDK often wraps errors inside an 'status' field, a 'status' property, or stringifies it in 'message'
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
      errorMessage = 'The Google Gemini server is experiencing high demand right now. Spikes are temporary—please wait a few seconds and try again!';
    } else if (error.message) {
      // If it's a different known error (like a wrong model name or 400), pass that text along instead
      errorMessage = error.message;
    }

    // 3. Send the accurate status code and human-readable message down to React
    res.status(statusCode).json({ error: errorMessage });
  }
});

app.listen(port, () => {
  console.log(`Multi-Provider Studio Live on http://localhost:${port}`);
});