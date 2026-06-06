import React, { useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
  isTyping?: boolean;
}

type ProviderType = 'google' | 'elevenlabs' | 'hume';
type VoiceConnectionState = 'idle' | 'connecting' | 'active';

interface VoiceOption {
  id: string;
  name: string;
  desc: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const VOICE_REGISTRY: Record<ProviderType, VoiceOption[]> = {
  google: [
    { id: 'Puck',   name: 'Puck',   desc: 'Energetic ♂' },
    { id: 'Charon', name: 'Charon', desc: 'Deep calm ♂' },
    { id: 'Kore',   name: 'Kore',   desc: 'Balanced ♀'  },
    { id: 'Fenrir', name: 'Fenrir', desc: 'Monster deep ♂' },
  ],
  elevenlabs: [
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah',  desc: 'Reassuring ♀' },
    { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam',   desc: 'Dominant ♂'   },
    { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice',  desc: 'Educator ♀'   },
    { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian',  desc: 'Comforting ♂' },
  ],
  hume: [
    { id: 'hume_default', name: 'EVI', desc: 'Adaptive emotion' },
  ],
};

// Provider accent palette — vivid but harmonious on white
const PROVIDER_THEME: Record<ProviderType, {
  primary: string;
  light: string;
  lighter: string;
  text: string;
  label: string;
  tag: string;
}> = {
  google: {
    primary:  '#4F46E5',   // indigo
    light:    '#EEF2FF',
    lighter:  '#E0E7FF',
    text:     '#3730A3',
    label:    'Google',
    tag:      'Gemini',
  },
  elevenlabs: {
    primary:  '#0D9488',   // teal
    light:    '#F0FDFA',
    lighter:  '#CCFBF1',
    text:     '#0F766E',
    label:    'ElevenLabs',
    tag:      'Studio',
  },
  hume: {
    primary:  '#EA580C',   // orange
    light:    '#FFF7ED',
    lighter:  '#FED7AA',
    text:     '#C2410C',
    label:    'Hume AI',
    tag:      'EVI · Emotion',
  },
};

// ─── Waveform ─────────────────────────────────────────────────────────────────

type WaveState = 'idle' | 'loading' | 'active';

function useWaveform(canvasRef: React.RefObject<HTMLCanvasElement | null>, provider: ProviderType) {
  const stateRef  = useRef<WaveState>('idle');
  const phaseRef  = useRef(0);
  const ampRef    = useRef(0.06);
  const targetRef = useRef(0.06);
  const rafRef    = useRef<number | null>(null);

  const setWaveState = useCallback((s: WaveState) => {
    stateRef.current = s;
    targetRef.current = s === 'active' ? 0.52 : s === 'loading' ? 0.16 : 0.06;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) { rafRef.current = requestAnimationFrame(draw); return; }

      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      ctx.clearRect(0, 0, W, H);

      const active = stateRef.current !== 'idle';
      ampRef.current += (targetRef.current - ampRef.current) * 0.055;
      phaseRef.current += active ? 0.07 : 0.02;

      const bars = 48;
      const barW = 3;
      const gap  = (W - bars * barW) / (bars + 1);
      const midY = H / 2;
      const color = PROVIDER_THEME[provider].primary;

      for (let i = 0; i < bars; i++) {
        const x    = gap + i * (barW + gap);
        const env  = Math.sin((i / (bars - 1)) * Math.PI);
        const wave = active
          ? Math.sin(i * 0.55 + phaseRef.current) * 0.5
            + Math.sin(i * 1.35 + phaseRef.current * 1.4) * 0.3
            + Math.sin(i * 2.2  + phaseRef.current * 0.8) * 0.2
          : Math.sin(i * 0.38 + phaseRef.current) * 0.5;

        const h = Math.max(2, Math.abs(wave) * env * ampRef.current * H);
        const alpha = 0.18 + Math.abs(wave) * 0.7;

        ctx.fillStyle = color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.roundRect(x, midY - h, barW, h * 2, barW / 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [canvasRef, provider]);

  return setWaveState;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const ProviderButton: React.FC<{
  id: ProviderType;
  active: boolean;
  onClick: () => void;
}> = ({ id, active, onClick }) => {
  const t = PROVIDER_THEME[id];
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        flex: 1,
        padding: '10px 6px',
        borderRadius: 12,
        border: active ? `1.5px solid ${t.primary}` : '1.5px solid #E5E7EB',
        background: active ? t.light : '#fff',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        transition: 'all 0.18s',
        boxShadow: active ? `0 0 0 3px ${t.lighter}` : 'none',
      }}
    >
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: active ? t.primary : '#D1D5DB',
        transition: 'background 0.18s',
        boxShadow: active ? `0 0 0 3px ${t.lighter}` : 'none',
      }} />
      <span style={{ fontSize: 12, fontWeight: 700, color: active ? t.text : '#6B7280', letterSpacing: '-0.1px' }}>
        {t.label}
      </span>
      <span style={{ fontSize: 10, fontWeight: 400, color: active ? t.primary : '#9CA3AF' }}>
        {t.tag}
      </span>
    </button>
  );
};

const TypingBubble: React.FC = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 4px' }}>
    {[0, 160, 320].map(d => (
      <span key={d} style={{
        width: 6, height: 6, borderRadius: '50%', background: '#9CA3AF',
        display: 'inline-block',
        animation: 'vl-typing 1.1s ease-in-out infinite',
        animationDelay: `${d}ms`,
      }} />
    ))}
  </div>
);

const ChatMessage: React.FC<{ msg: Message; provider: ProviderType }> = ({ msg, provider }) => {
  const t = PROVIDER_THEME[provider];
  const isUser = msg.sender === 'user';
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexDirection: isUser ? 'row-reverse' : 'row' }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
        background: isUser ? t.lighter : '#F3F4F6',
        color: isUser ? t.text : '#6B7280',
        fontWeight: 700,
      }} aria-hidden>
        <i className={`ti ti-${isUser ? 'user' : 'robot'}`} />
      </div>
      <div style={{
        padding: '9px 13px',
        borderRadius: 14,
        ...(isUser ? { borderBottomRightRadius: 3 } : { borderBottomLeftRadius: 3 }),
        maxWidth: '76%',
        fontSize: 14,
        lineHeight: 1.55,
        background: isUser ? t.light : '#F9FAFB',
        border: isUser ? `1px solid ${t.lighter}` : '1px solid #F3F4F6',
        color: isUser ? t.text : '#111827',
      }}>
        {msg.isTyping ? <TypingBubble /> : msg.text}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const AIChat: React.FC = () => {
  const [messages,          setMessages]        = useState<Message[]>([]);
  const [errorMsg,          setErrorMsg]         = useState<string | null>(null);
  const [selectedProvider,  setSelectedProvider] = useState<ProviderType>('google');
  const [selectedVoice,     setSelectedVoice]    = useState<string>('Puck');
  const [waveState,         setWaveStateLocal]   = useState<WaveState>('idle');
  const [connectionState, setConnectionState] = useState<VoiceConnectionState>('idle');

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const msgEndRef = useRef<HTMLDivElement>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeAudioNodesRef = useRef<AudioBufferSourceNode[]>([]);
  const sampleRateRef = useRef<number>(24000);


  const setWaveState = useWaveform(canvasRef, selectedProvider);
  const theme = PROVIDER_THEME[selectedProvider];

  useEffect(() => {
    if (connectionState === 'idle') {
      setSelectedVoice(VOICE_REGISTRY[selectedProvider][0].id);
    }
  }, [selectedProvider]);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const currentVoice = VOICE_REGISTRY[selectedProvider].find(v => v.id === selectedVoice);

  // Replace your old handleSend/handleKeyDown with this connection loop orchestrator
  const toggleVoiceConnection = async () => {
    if (connectionState === 'active' || connectionState === 'connecting') {
      // Gracefully disconnect if clicked while alive
      disconnectPipeline();
      return;
    }

    setErrorMsg(null);
    setConnectionState('connecting');
    setWaveState('loading');
    setWaveStateLocal('loading');

    try {
      // Establish our raw multiplexed streaming pipeline to the backend
      const wsUrl = `ws://localhost:5000/stream?provider=${selectedProvider}&voiceId=${selectedVoice}`;
      const socket = new WebSocket(wsUrl);

      socket.binaryType = 'arraybuffer';
      wsRef.current = socket;

      socket.onopen = () => {
        console.log('📡 Streaming link established with server proxy.');
        setConnectionState('active');
        setWaveState('active');
        setWaveStateLocal('active');
        
        // Create a system notification thread in the text UI
        const systemNotice: Message = {
          id: crypto.randomUUID(),
          sender: 'ai',
          text: `[Live conversation started with ${selectedProvider}]`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, systemNotice]);
        startRecording(socket);
      };

      socket.onmessage = (event) => {

        //check if the incoming packet is a raw binary frame from the AI 
        if (event.data instanceof ArrayBuffer) {
          //this is a raw audio chunk from the backend
          //we hand it off directly to our playback queue engine
          handleIncomingAudioChunk(event.data);
          return;
        }

        //otherwise, process it  as a JSON control or text transcription frame
        try {
          const data = JSON.parse(event.data);
          
          //CATCH SEAMLESS DOWNSTREAM AUDIO CONFIGURATION RECALIBRATIONS
          if (data.type === 'session_config') {
            console.log('Recalibrating frontend audio timeline rate context to: ${data.sampleRate} Hz');
            sampleRateRef.current = data.sampleRate;
            return;
          }

          // Handle stream fragments sent from our Gemini backend agent
          if (data.type === 'text') {
            // Live appending transcript text strings
            setMessages(prev => {
              const lastMsg = prev[prev.length - 1];
              if (lastMsg && lastMsg.sender === 'ai' && !lastMsg.isTyping) {
                return [...prev.slice(0, -1), { ...lastMsg, text: lastMsg.text + data.payload }];
              } else {
                return [...prev, { id: crypto.randomUUID(), sender: 'ai', text: data.payload, timestamp: new Date() }];
              }
            });
          }
          
          if (data.type === 'interrupted') {
            // Tell our future playback engine to drop current buffer instantly
            console.log('Barge-in caught! Stop playback.');
            handleUserInterruption();
          }
        } catch (err) {
          // If it's a binary audio message packet, we handle it in step 3.4
        }
      };

      socket.onerror = () => {
        throw new Error('WebSocket pipeline error encountered.');
      };

      socket.onclose = (event: CloseEvent) => {
      console.warn('🔒 Server link terminated.');
      console.warn(`   👉 Browser caught Close Code: ${event.code}`);
      console.warn(`   👉 Browser caught Close Reason: ${event.reason || 'None provided'}`);
      console.warn(`   👉 Was Clean Disconnect?: ${event.wasClean}`);
      cleanupUIStates();
    };

    } catch (err: any) {
      setErrorMsg(err.message || 'Could not reach streaming backend server.');
      cleanupUIStates();
    }
  };

  const disconnectPipeline = () => {

    stopRecording();

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    cleanupUIStates();
  };

  const cleanupUIStates = () => {
    setConnectionState('idle');
    setWaveState('idle');
    setWaveStateLocal('idle');
  };

  const startRecording = async (socket: WebSocket) => {
    try {
      // 1. Request microphone permissions from the user
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000, // Request 16kHz natively if supported
          echoCancellation: true,
          noiseSuppression: true,
        }
      });
      streamRef.current = stream;

      // 2. Instantiate our low-level AudioContext 
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;

      // 3. Connect our microphone stream to the Web Audio graph
      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      // 4. Create a processor node with a 4096-byte frame buffer
      // 1 input channel, 1 output channel
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      // 5. Downsample & convert Float32 audio into Int16 Linear PCM
      processor.onaudioprocess = (e) => {
        if (socket.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0); // Left channel float array
        const inputSampleRate = e.inputBuffer.sampleRate;
        
        // Downsample the chunk if the browser context is running higher than 16kHz
        const downsampledBuffer = downsampleBuffer(inputData, inputSampleRate, 16000);
        
        // Convert standard Float32 values (-1.0 to 1.0) into 16-bit integers (-32768 to 32767)
        const pcmBuffer = new Int16Array(downsampledBuffer.length);
        for (let i = 0; i < downsampledBuffer.length; i++) {
          // Clamp bounds securely
          const s = Math.max(-1, Math.min(1, downsampledBuffer[i]));
          pcmBuffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Send the raw binary chunk immediately down our active WebSocket wire
        socket.send(pcmBuffer.buffer);
      };

      // Connect nodes together: Source -> Processor -> Speakers (required to spark clock)
      source.connect(processor);
      processor.connect(audioContext.destination);

    } catch (err) {
      console.error('Failed to initialize microphone streaming node:', err);
      setErrorMsg('Microphone access denied or audio initialization failed.');
      disconnectPipeline();
    }
  };

  const stopRecording = () => {
    // Gracefully close down the web audio pipeline nodes
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioContextRef.current) {
      if (audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    activeAudioNodesRef.current.forEach(node => { try { node.stop(); } catch(e){} });
    activeAudioNodesRef.current = [];
    if (playbackContextRef.current) {
      if (playbackContextRef.current.state !== 'closed') {
        playbackContextRef.current.close();
      }
      playbackContextRef.current = null;
    }
  };

  const handleIncomingAudioChunk = async (arrayBuffer: ArrayBuffer) => {
    try {
      // 1. Lazy-initialize the playback AudioContext if it doesn't exist yet
      if (!playbackContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        playbackContextRef.current = new AudioContextClass();
        // Start scheduling from the exact current time of the audio clock
        nextStartTimeRef.current = playbackContextRef.current.currentTime;
      }

      const ctx = playbackContextRef.current;

      // Resume context safely if the browser paused it due to user interaction rules
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      // 2. Convert raw Int16 binary data back into standard Web Audio Float32 samples
      const int16Array = new Int16Array(arrayBuffer);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      // 3. Create a standard single-channel (Mono) Web Audio AudioBuffer
      // Gemini Live natively outputs audio at a 24000Hz (24kHz) sample rate
      const audioBuffer = ctx.createBuffer(1, float32Array.length, sampleRateRef.current);
      audioBuffer.copyToChannel(float32Array, 0);

      // 4. Create an AudioBufferSourceNode to read this buffer chunk
      const sourceNode = ctx.createBufferSource();
      sourceNode.buffer = audioBuffer;

      setWaveStateLocal('active');

      // 5. Connect the source node directly to your visualizer canvas's AnalyserNode!
      // Your useWaveform hook listens to canvasRef, so we route the sound through it
      sourceNode.connect(ctx.destination);

      // Track this source node in our active references pool so we can kill it if interrupted
      activeAudioNodesRef.current.push(sourceNode);

      // 6. Timeline Scheduling Strategy:
      // If the queue has fallen behind schedule, catch up instantly to minimize latency
      if (nextStartTimeRef.current < ctx.currentTime) {
        nextStartTimeRef.current = ctx.currentTime;
      }

      // Schedule this chunk to play back at the precise microsecond the last chunk finishes
      sourceNode.start(nextStartTimeRef.current);
      
      // Increment the timeline marker by the exact physical duration of this audio frame
      nextStartTimeRef.current += audioBuffer.duration;

      // Clean up the node from our tracking array once it finishes playing normally
      sourceNode.onended = () => {
        activeAudioNodesRef.current = activeAudioNodesRef.current.filter(node => node !== sourceNode);
        if (activeAudioNodesRef.current.length === 0) {
          setWaveStateLocal('idle');
        }
      };

    } catch (err) {
      console.error('Error scheduling real-time audio playback frame:', err);
    }
  };

  const handleUserInterruption = () => {
    console.log('⚡ Handling barge-in: Purging playback queue instantly.');
    
    // 1. Forcibly stop every single audio buffer source node currently playing or queued
    activeAudioNodesRef.current.forEach(node => {
      try {
        node.stop();
      } catch (e) {
        // Node might have already ended naturally
      }
    });
    
    // 2. Reset our tracking arrays and structural timeline clock
    activeAudioNodesRef.current = [];
    if (playbackContextRef.current) {
      nextStartTimeRef.current = playbackContextRef.current.currentTime;
    }
  };

  // Math utility to cleanly compress higher browser frequencies into standard 16kHz
  const downsampleBuffer = (buffer: Float32Array, fromRate: number, toRate: number): Float32Array => {
    if (fromRate === toRate) return buffer;
    if (fromRate < toRate) {
      console.warn("Cannot upsample audio source effectively.");
      return buffer;
    }
    const sampleRateRatio = fromRate / toRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
      let accum = 0;
      let count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }
      result[offsetResult] = count > 0 ? accum / count : 0;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        @keyframes vl-typing  { 0%,80%,100%{transform:scale(0.6);opacity:0.35} 40%{transform:scale(1);opacity:1} }
        @keyframes vl-pulse   { 0%,100%{opacity:1} 50%{opacity:0.25} }
        @keyframes vl-fadein  { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        .vl-root * { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; box-sizing: border-box; }
        .vl-input::placeholder { color: #9CA3AF; }
        .vl-input:focus { outline: none; }
        .vl-msg-anim { animation: vl-fadein 0.18s ease both; }
        .vl-chip:hover { filter: brightness(0.95); }
        .vl-send:hover:not(:disabled) { filter: brightness(1.1); transform: scale(1.05); }
        .vl-send:active:not(:disabled) { transform: scale(0.96); }
        .vl-messages::-webkit-scrollbar { width: 4px; }
        .vl-messages::-webkit-scrollbar-track { background: transparent; }
        .vl-messages::-webkit-scrollbar-thumb { background: #E5E7EB; border-radius: 4px; }
      `}</style>

      <div className="vl-root" style={{
        background: '#fff',
        borderRadius: 20,
        border: '1px solid #E5E7EB',
        boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxWidth: 600,
        margin: '2rem auto',
        minHeight: 580,
      }}>

        {/* ── Header ── */}
        <div style={{
          padding: '18px 20px 14px',
          borderBottom: '1px solid #F3F4F6',
          display: 'flex', alignItems: 'center', gap: 12,
          background: theme.light,
          transition: 'background 0.3s',
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 11, flexShrink: 0,
            background: theme.primary,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 2px 8px ${theme.primary}44`,
            transition: 'background 0.3s, box-shadow 0.3s',
          }}>
            <i className="ti ti-wave-sine" style={{ fontSize: 19, color: '#fff' }} aria-hidden />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827', letterSpacing: '-0.2px' }}>
              Voice Lab
            </p>
            <p style={{ margin: 0, fontSize: 12, color: theme.text, fontWeight: 500, transition: 'color 0.3s' }}>
              {theme.label} · {currentVoice?.name ?? ''}
              {currentVoice && <span style={{ fontWeight: 400, color: '#9CA3AF' }}> — {currentVoice.desc}</span>}
            </p>
          </div>
          {/* Live indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: waveState === 'active'  ? '#10B981'
                        : waveState === 'loading' ? theme.primary
                        : '#D1D5DB',
              boxShadow: waveState === 'active'  ? '0 0 0 3px #D1FAE5'
                        : waveState === 'loading' ? `0 0 0 3px ${theme.lighter}`
                        : 'none',
              transition: 'all 0.3s',
              animation: waveState === 'loading' ? 'vl-pulse 0.9s ease-in-out infinite' : 'none',
            }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF' }}>
              {waveState === 'active' ? 'PLAYING' : waveState === 'loading' ? 'THINKING' : 'READY'}
            </span>
          </div>
        </div>

        {/* ── Provider Selector ── */}
        <div style={{
          display: 'flex', gap: 8, padding: '12px 20px',
          borderBottom: '1px solid #F3F4F6',
          background: '#FAFAFA',
        }} role="group" aria-label="Select voice provider">
          {(['google', 'elevenlabs', 'hume'] as ProviderType[]).map(id => (
            <ProviderButton key={id} id={id} active={selectedProvider === id} onClick={() => setSelectedProvider(id)} />
          ))}
        </div>

        {/* ── Voice Chips ── */}
        <div style={{
          display: 'flex', gap: 6, padding: '10px 20px', flexWrap: 'wrap',
          borderBottom: '1px solid #F3F4F6',
        }} role="group" aria-label="Select voice persona">
          {VOICE_REGISTRY[selectedProvider].map(voice => {
            const active = voice.id === selectedVoice;
            return (
              <button
                key={voice.id}
                className="vl-chip"
                onClick={() => setSelectedVoice(voice.id)}
                title={voice.desc}
                style={{
                  padding: '5px 14px',
                  borderRadius: 99,
                  border: active ? `1.5px solid ${theme.primary}` : '1.5px solid #E5E7EB',
                  background: active ? theme.light : '#fff',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: active ? 700 : 500,
                  color: active ? theme.text : '#6B7280',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {voice.name}
                <span style={{ marginLeft: 5, fontSize: 10, opacity: 0.65, fontWeight: 400 }}>{voice.desc}</span>
              </button>
            );
          })}
        </div>

        {/* ── Messages ── */}
        <div className="vl-messages" style={{
          flex: 1, overflowY: 'auto',
          padding: '16px 20px',
          display: 'flex', flexDirection: 'column', gap: 10,
          minHeight: 200, maxHeight: 260,
        }}>
          {messages.length === 0 ? (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 8, color: '#9CA3AF', fontSize: 13, textAlign: 'center', padding: 20,
            }}>
              <i className="ti ti-messages" style={{ fontSize: 30, color: '#D1D5DB' }} aria-hidden />
              Send a message to test<br />your selected provider and voice
            </div>
          ) : (
            messages.map(msg => (
              <div key={msg.id} className="vl-msg-anim">
                <ChatMessage msg={msg} provider={selectedProvider} />
              </div>
            ))
          )}
          <div ref={msgEndRef} />
        </div>

        {/* ── Waveform ── */}
        <div style={{
          padding: '10px 20px',
          borderTop: '1px solid #F3F4F6',
          borderBottom: '1px solid #F3F4F6',
          background: theme.light,
          display: 'flex', alignItems: 'center', gap: 10, height: 50,
          transition: 'background 0.3s',
        }} aria-hidden>
          <span style={{ fontSize: 10, fontWeight: 700, color: theme.text, letterSpacing: '0.8px', whiteSpace: 'nowrap', opacity: 0.7 }}>
            OUTPUT
          </span>
          <canvas ref={canvasRef} style={{ flex: 1, height: 30 }} />
        </div>

        {/* ── Error ── */}
        {errorMsg && (
          <div style={{
            margin: '8px 20px 0',
            padding: '9px 13px',
            borderRadius: 10,
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            fontSize: 12,
            fontWeight: 500,
            color: '#B91C1C',
          }} role="alert">
            ⚠ {errorMsg}
          </div>
        )}

        {/* ── Audio Control Core Deck ── */}
        <div style={{ 
          padding: '24px 20px', 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center',
          background: '#FAFAFA',
          borderTop: '1px solid #F3F4F6',
          gap: 12
        }}>
          <button
            className="vl-send"
            onClick={toggleVoiceConnection}
            aria-label={connectionState === 'active' ? "Disconnect conversation" : "Start conversation"}
            style={{
              width: 64, height: 64,
              borderRadius: '50%',
              border: 'none',
              background: connectionState === 'active' ? '#EF4444' 
                        : connectionState === 'connecting' ? '#F59E0B' 
                        : theme.primary,
              color: '#fff',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24,
              transition: 'all 0.2s ease',
              boxShadow: `0 4px 14px ${connectionState === 'active' ? '#EF4444' : theme.primary}55`,
            }}
          >
            {connectionState === 'connecting' ? (
              <i className="ti ti-refresh" style={{ animation: 'vl-typing 1s infinite linear' }} />
            ) : connectionState === 'active' ? (
              <i className="ti ti-microphone-off" />
            ) : (
              <i className="ti ti-microphone" />
            )}
          </button>
          
          <span style={{ 
            fontSize: 13, 
            fontWeight: 600, 
            color: connectionState === 'active' ? '#EF4444' : '#6B7280',
            letterSpacing: '-0.1px'
          }}>
            {connectionState === 'active' ? 'Click to Disconnect / Mute' 
             : connectionState === 'connecting' ? 'Establishing Secure Voice Link...' 
             : `Connect Voice Call with ${theme.label}`}
          </span>
        </div>

      </div>
    </>
  );
};

export default AIChat;