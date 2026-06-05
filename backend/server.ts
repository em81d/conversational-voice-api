import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import WebSocket, { WebSocketServer } from 'ws';

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
      model: 'gemini-2.0-flash-exp',
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

// NEW CODE:
// 1. Capture the HTTP server instance created by Express
const server = app.listen(port, () => {
  console.log(`Multi-Provider Studio Live on http://localhost:${port}`);
});

// 2. Attach the WebSocket Server to that exact same HTTP server
const wss = new WebSocketServer({ server });

// 3. Set up the connection heartbeat listener
wss.on('connection', async (ws, req) => {
  console.log('🔌 New client handshaking via WebSocket...');

  // 1. Extract routing parameters from URL (e.g., ws://localhost:5000/?provider=google&voiceId=Kore)
  const urlParams = new URL(req.url || '', `http://${req.headers.host}`);
  const provider = urlParams.searchParams.get('provider') || 'google';
  const voiceId = urlParams.searchParams.get('voiceId') || 'Puck';

  // We maintain a reference to our outbound API connection
  let geminiLiveSocket: WebSocket | null = null;
  let isSetupComplete = false;

  if (provider === 'google') {
    try {
      // 1. Link out directly to the Gemini Bidirectional Live Media Stream
      const geminiUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${process.env.GEMINI_API_KEY}`;
      geminiLiveSocket = new WebSocket(geminiUrl);

      geminiLiveSocket.on('open', () => {
        console.log('🚀 Connected to Google Gemini Live API. Sending setup configuration...');
        
        const setupMessage = {
          setup: {
            model: "models/gemini-3.1-flash-live-preview", 
            generation_config: {
              response_modalities: ["audio"], 
              speech_config: {
                voice_config: {
                  prebuilt_voice_config: {
                    voiceName: voiceId 
                  }
                }
              }
            }
          }
        };
        
        geminiLiveSocket?.send(JSON.stringify(setupMessage));
        isSetupComplete = true;
        console.log('✅ Setup block cleared. Stream is primed for recording packets.');
      });

      geminiLiveSocket.on('message', (data) => {
        try {
          const response = JSON.parse(data.toString());

          if (response.serverContent) {
            const modelTurn = response.serverContent.modelTurn;
            
            if (modelTurn && modelTurn.parts) {
              for (const part of modelTurn.parts) {
                
                // Text/Transcription update frames
                if (part.text) {
                  ws.send(JSON.stringify({
                    type: 'text',
                    payload: part.text
                  }));
                }

                // SUCCESS ROUTE: Send raw unencoded audio frames directly downstream
                if (part.inlineData && part.inlineData.mimeType.startsWith('audio/pcm')) {
                  const rawAudioBuffer = Buffer.from(part.inlineData.data, 'base64');
                  ws.send(rawAudioBuffer); // No stringify! This arrives as an ArrayBuffer on frontend
                }
              }
            }

            // Catch user interruption indicators
            if (response.serverContent.interrupted) {
              console.log('⚡ Gemini was interrupted by the user!');
              ws.send(JSON.stringify({ type: 'interrupted' }));
            }
          }

        } catch (err) {
          console.error('Error parsing incoming Gemini payload:', err);
        }
      });

      geminiLiveSocket.on('error', (err) => {
        console.error('Gemini Live Socket Connection Error:', err);
      });

      geminiLiveSocket.on('close', (code: number, reason: Buffer) => {
        console.error(`🚨 GOOGLE DISCONNECTED THE SESSION!`);
        console.error(`   👉 Close Code: ${code}`);
        console.error(`   👉 Close Reason: ${reason.toString() || 'No explicit reason provided'}`);
        
        // This helper translates standard protocol codes to give you an immediate clue
        if (code === 1007) console.error("   💡 Diagnosis: Message payload violated Google's expected schema - check realtimeInput structure, deprecated fields, or mimeType format.");
        if (code === 1011) console.error("   💡 Diagnosis: Internal server error on Google's cluster or API Key limit hit.");
        
        ws.close(); 
      });

    } catch (error) {
      console.error('Failed to orchestrate Gemini live connection:', error);
      ws.close();
    }
  }

  // 5. Route Incoming User Traffic from Frontend
  ws.on('message', (message: WebSocket.RawData) => {
    if (!geminiLiveSocket || geminiLiveSocket.readyState !== WebSocket.OPEN || !isSetupComplete) {
       return;
    }

    try {
      // Determine if it's binary chunk data (audio)
      if (Buffer.isBuffer(message)) {
        const base64Audio = message.toString('base64');
        sendAudioToGemini(base64Audio);
      } else if (message instanceof ArrayBuffer) {
        // Safe conversion of standard web ArrayBuffer to Node Buffer
        const base64Audio = Buffer.from(new Uint8Array(message)).toString('base64');
        sendAudioToGemini(base64Audio);
      } else if (Array.isArray(message)) {
        // Combine array of buffers if fragmented
        const base64Audio = Buffer.concat(message).toString('base64');
        sendAudioToGemini(base64Audio);
      } else {
        try {
          // Cast 'message' to unknown first, then string to make the compiler happy
          const messageStr = (message as unknown as string).toString();
          const parsed = JSON.parse(messageStr);
          
          if (parsed.type === 'text_input') {
            const textPacket = {
              clientContent: {
                turns: [{ role: 'user', parts: [{ text: parsed.payload }] }],
                turnComplete: true
              }
            };
            geminiLiveSocket.send(JSON.stringify(textPacket));
          }
        } catch (parseError) {
          console.error('Failed to parse text frame or received unexpected binary format:', parseError);
        }
      }
    } catch (err) {
      console.error('Error proxying traffic to Gemini:', err);
    }
  });

  //claude updated this while debugging 6/5/26
  function sendAudioToGemini(base64Audio: string) {
    const audioPacket = {
      realtimeInput: {
        audio: {
          data: base64Audio,
          mimeType: "audio/pcm;rate=16000"
        }
      }
    };
    geminiLiveSocket?.send(JSON.stringify(audioPacket));
  }

  // 6. Aggressive Cleanup on Disconnect
  ws.on('close', (code: number, reason: Buffer) => {
    console.log(`❌ Browser Client closed proxy link.`);
    console.log(`   👉 Browser Close Code: ${code}`);
    console.log(`   👉 Browser Close Reason: ${reason.toString() || 'None'}`);
    isSetupComplete = false;
    if (geminiLiveSocket) {
      geminiLiveSocket.close();
      geminiLiveSocket = null;
    }
  });
});