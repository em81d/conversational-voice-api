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
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', desc: 'Standard F' },
    { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam',   desc: 'Natural M'  },
    { id: 'hpp4J3VqNfWAUOO0d1Us', name: 'Bella',  desc: 'Warm F'     },
    { id: 'nzFihrBIvB34imQBuxub ', name: 'Josh',  desc: 'Teacher for Kids'   },
  ],
  hume: [
    { id: 'hume_default', name: 'EVI', desc: 'Adaptive emotion' },
  ],
};

const PROVIDER_COLORS: Record<ProviderType, string> = {
  google:     '#6c63ff',
  elevenlabs: '#3ecfb2',
  hume:       '#ff9f5a',
};

// ─── Waveform Canvas ──────────────────────────────────────────────────────────

type WaveState = 'idle' | 'loading' | 'active';

function useWaveform(canvasRef: React.RefObject<HTMLCanvasElement | null>, provider: ProviderType) {
  const stateRef    = useRef<WaveState>('idle');
  const phaseRef    = useRef(0);
  const ampRef      = useRef(0.08);
  const targetRef   = useRef(0.08);
  const rafRef      = useRef<number | null>(null);

  const setWaveState = useCallback((s: WaveState) => {
    stateRef.current = s;
    targetRef.current = s === 'active' ? 0.55 : s === 'loading' ? 0.18 : 0.04;
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
      ampRef.current += (targetRef.current - ampRef.current) * 0.06;
      phaseRef.current += active ? 0.065 : 0.018;

      const bars = 52;
      const barW = 2.5;
      const gap  = (W - bars * barW) / (bars + 1);
      const midY = H / 2;
      const color = PROVIDER_COLORS[provider];

      for (let i = 0; i < bars; i++) {
        const x   = gap + i * (barW + gap);
        const env = Math.sin((i / (bars - 1)) * Math.PI);
        const noise = active
          ? Math.sin(i * 0.6 + phaseRef.current) * 0.5
            + Math.sin(i * 1.4 + phaseRef.current * 1.3) * 0.3
            + Math.sin(i * 2.3 + phaseRef.current * 0.7) * 0.2
          : Math.sin(i * 0.4 + phaseRef.current) * 0.5;

        const h = Math.max(1.5, Math.abs(noise) * env * ampRef.current * H);

        ctx.fillStyle = color;
        ctx.globalAlpha = 0.15 + Math.abs(noise) * 0.65;
        ctx.beginPath();
        const r = Math.min(barW / 2, h / 2);
        ctx.roundRect(x, midY - h, barW, h * 2, r);
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

interface ProviderButtonProps {
  provider: ProviderType;
  label: string;
  tag: string;
  active: boolean;
  onClick: () => void;
}

const ProviderButton: React.FC<ProviderButtonProps> = ({ provider, label, tag, active, onClick }) => (
  <button
    onClick={onClick}
    aria-pressed={active}
    style={{
      flex: 1,
      padding: '10px 8px',
      borderRadius: 10,
      border: active
        ? `0.5px solid ${PROVIDER_COLORS[provider]}66`
        : '0.5px solid rgba(255,255,255,0.1)',
      background: active
        ? `${PROVIDER_COLORS[provider]}25`
        : 'rgba(255,255,255,0.03)',
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 5,
      color: active ? '#f5f3ed' : 'rgba(232,230,223,0.5)',
      transition: 'all 0.2s',
    }}
  >
    <div style={{
      width: 8, height: 8, borderRadius: '50%',
      background: active ? PROVIDER_COLORS[provider] : 'rgba(255,255,255,0.2)',
      transition: 'background 0.2s',
      ...(active ? { boxShadow: `0 0 6px ${PROVIDER_COLORS[provider]}` } : {}),
    }} />
    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.3px' }}>{label}</span>
    <span style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", fontWeight: 300, opacity: 0.6 }}>{tag}</span>
  </button>
);

interface TypingBubbleProps {}

const TypingBubble: React.FC<TypingBubbleProps> = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '6px 8px' }}>
    {[0, 200, 400].map(delay => (
      <span key={delay} style={{
        width: 5, height: 5, borderRadius: '50%',
        background: 'rgba(232,230,223,0.35)',
        display: 'inline-block',
        animation: 'vl-typing 1.2s ease-in-out infinite',
        animationDelay: `${delay}ms`,
      }} />
    ))}
  </div>
);

interface ChatMessageProps {
  msg: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ msg }) => (
  <div style={{
    display: 'flex',
    gap: 10,
    alignItems: 'flex-end',
    flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row',
  }}>
    {/* Avatar */}
    <div style={{
      width: 28, height: 28, borderRadius: 8,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, flexShrink: 0,
      background: msg.sender === 'user'
        ? 'rgba(108,99,255,0.25)'
        : 'rgba(255,255,255,0.07)',
      color: msg.sender === 'user'
        ? '#a8a3ff'
        : 'rgba(232,230,223,0.6)',
    }} aria-hidden>
      <i className={`ti ti-${msg.sender === 'user' ? 'user' : 'robot'}`} />
    </div>

    {/* Bubble */}
    <div style={{
      padding: '9px 14px',
      borderRadius: 14,
      ...(msg.sender === 'user'
        ? { borderBottomRightRadius: 4 }
        : { borderBottomLeftRadius: 4 }),
      maxWidth: '78%',
      fontSize: 14,
      lineHeight: 1.5,
      background: msg.sender === 'user'
        ? 'rgba(108,99,255,0.22)'
        : 'rgba(255,255,255,0.05)',
      border: msg.sender === 'user'
        ? '0.5px solid rgba(108,99,255,0.35)'
        : '0.5px solid rgba(255,255,255,0.09)',
      color: msg.sender === 'user' ? '#dddaf8' : '#e8e6df',
    }}>
      {msg.isTyping ? <TypingBubble /> : msg.text}
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const AIChat: React.FC = () => {
  const [messages,         setMessages]         = useState<Message[]>([]);
  const [input,            setInput]             = useState('');
  const [isLoading,        setIsLoading]         = useState(false);
  const [errorMsg,         setErrorMsg]          = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider]  = useState<ProviderType>('google');
  const [selectedVoice,    setSelectedVoice]     = useState<string>('Puck');
  const [waveState,        setWaveStateLocal]    = useState<WaveState>('idle');

  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const msgEndRef    = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);

  const setWaveState = useWaveform(canvasRef, selectedProvider);

  // Reset voice when provider changes
  useEffect(() => {
    setSelectedVoice(VOICE_REGISTRY[selectedProvider][0].id);
  }, [selectedProvider]);

  // Scroll to bottom on new messages
  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const currentVoiceName = VOICE_REGISTRY[selectedProvider]
    .find(v => v.id === selectedVoice)?.name.toLowerCase() ?? '';

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput('');
    setErrorMsg(null);

    const userMsg: Message = {
      id: crypto.randomUUID(),
      sender: 'user',
      text,
      timestamp: new Date(),
    };

    const typingMsg: Message = {
      id: crypto.randomUUID(),
      sender: 'ai',
      text: '',
      timestamp: new Date(),
      isTyping: true,
    };

    setMessages(prev => [...prev, userMsg, typingMsg]);
    setIsLoading(true);

    setWaveState('loading');
    setWaveStateLocal('loading');

    try {
      const response = await fetch('http://localhost:5000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, provider: selectedProvider, voiceId: selectedVoice }),
      });

      if (!response.ok) {
        let errText = `Server error ${response.status}`;
        try { const d = await response.json(); errText = d.error || errText; } catch {}
        throw new Error(errText);
      }

      const aiTextEncoded = response.headers.get('X-AI-Text');
      const aiText = aiTextEncoded ? decodeURIComponent(aiTextEncoded) : 'Audio generated.';

      const blob     = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio    = new Audio(audioUrl);

      setWaveState('active');
      setWaveStateLocal('active');
      audio.play();

      audio.onended = () => {
        setWaveState('idle');
        setWaveStateLocal('idle');
        URL.revokeObjectURL(audioUrl);
      };

      // Replace typing bubble with real response
      setMessages(prev => prev.map(m =>
        m.isTyping
          ? { ...m, text: aiText, isTyping: false }
          : m
      ));

    } catch (err: any) {
      setMessages(prev => prev.map(m =>
        m.isTyping
          ? { ...m, text: '[Error: could not connect to backend]', isTyping: false }
          : m
      ));
      setErrorMsg(err.message || 'Pipeline failure — is the backend running?');
      setWaveState('idle');
      setWaveStateLocal('idle');
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const statusDotStyle: React.CSSProperties = {
    width: 6, height: 6, borderRadius: '50%', flexShrink: 0, transition: 'background 0.3s',
    ...(waveState === 'active'
      ? { background: '#3ecfb2', boxShadow: '0 0 6px #3ecfb2' }
      : waveState === 'loading'
      ? { background: '#6c63ff', animation: 'vl-pulse 1s ease-in-out infinite' }
      : { background: 'rgba(255,255,255,0.15)' }),
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&family=Syne:wght@400;500;600;700;800&display=swap');
        @keyframes vl-typing {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40%            { transform: scale(1);   opacity: 1;   }
        }
        @keyframes vl-pulse {
          0%, 100% { opacity: 1;   }
          50%      { opacity: 0.3; }
        }
        .vl-input::placeholder { color: rgba(232,230,223,0.25); }
        .vl-input:focus { outline: none; border-color: rgba(108,99,255,0.45) !important; background: rgba(255,255,255,0.07) !important; }
        .vl-messages::-webkit-scrollbar       { width: 3px; }
        .vl-messages::-webkit-scrollbar-track { background: transparent; }
        .vl-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        .vl-voice-chip:hover { color: rgba(232,230,223,0.85) !important; background: rgba(255,255,255,0.05) !important; }
        .vl-send-btn:hover:not(:disabled) { background: #7d75ff !important; transform: scale(1.04); }
        .vl-send-btn:active:not(:disabled) { transform: scale(0.96); }
      `}</style>

      <div style={{
        fontFamily: "'Syne', sans-serif",
        background: '#0d0e12',
        borderRadius: 16,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        color: '#e8e6df',
        maxWidth: 600,
        margin: '2rem auto',
        minHeight: 600,
      }}>

        {/* ── Header ── */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '0.5px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'flex-start', gap: 16,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #6c63ff 0%, #3ecfb2 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, marginTop: 2,
          }} aria-hidden>
            <i className="ti ti-wave-sine" style={{ fontSize: 18, color: 'white' }} />
          </div>
          <div>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#f5f3ed', margin: '0 0 2px', letterSpacing: '-0.3px' }}>
              Voice Lab
            </p>
            <p style={{ fontSize: 12, color: 'rgba(232,230,223,0.45)', margin: 0, fontFamily: "'DM Mono', monospace", fontWeight: 300, letterSpacing: '0.5px' }}>
              // provider: {selectedProvider} · voice: {currentVoiceName}
            </p>
          </div>
        </div>

        {/* ── Provider Tabs ── */}
        <div style={{
          display: 'flex', gap: 8, padding: '16px 24px',
          borderBottom: '0.5px solid rgba(255,255,255,0.08)',
        }} role="group" aria-label="Select voice provider">
          <ProviderButton provider="google"     label="Google"     tag="gemini"       active={selectedProvider === 'google'}     onClick={() => setSelectedProvider('google')} />
          <ProviderButton provider="elevenlabs" label="ElevenLabs" tag="studio"       active={selectedProvider === 'elevenlabs'} onClick={() => setSelectedProvider('elevenlabs')} />
          <ProviderButton provider="hume"       label="Hume AI"    tag="evi · emotion" active={selectedProvider === 'hume'}      onClick={() => setSelectedProvider('hume')} />
        </div>

        {/* ── Voice Chips ── */}
        <div style={{
          padding: '12px 24px',
          borderBottom: '0.5px solid rgba(255,255,255,0.08)',
          display: 'flex', gap: 8, flexWrap: 'wrap',
        }} role="group" aria-label="Select voice persona">
          {VOICE_REGISTRY[selectedProvider].map(voice => (
            <button
              key={voice.id}
              className="vl-voice-chip"
              onClick={() => setSelectedVoice(voice.id)}
              title={voice.desc}
              style={{
                padding: '5px 12px',
                borderRadius: 20,
                border: selectedVoice === voice.id
                  ? '0.5px solid rgba(255,255,255,0.25)'
                  : '0.5px solid rgba(255,255,255,0.1)',
                background: selectedVoice === voice.id
                  ? 'rgba(255,255,255,0.1)'
                  : 'transparent',
                cursor: 'pointer',
                fontSize: 12,
                fontFamily: "'DM Mono', monospace",
                fontWeight: 400,
                color: selectedVoice === voice.id
                  ? '#f5f3ed'
                  : 'rgba(232,230,223,0.5)',
                transition: 'all 0.18s',
                whiteSpace: 'nowrap',
              }}
            >
              {voice.name}
            </button>
          ))}
        </div>

        {/* ── Message List ── */}
        <div
          className="vl-messages"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            minHeight: 220,
            maxHeight: 260,
          }}
        >
          {messages.length === 0 ? (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              color: 'rgba(232,230,223,0.25)',
              fontSize: 13, textAlign: 'center', gap: 10, padding: 20,
            }}>
              <i className="ti ti-messages" style={{ fontSize: 28, opacity: 0.4 }} aria-hidden />
              <span>Send a message to test your selected<br />provider and voice persona</span>
            </div>
          ) : (
            messages.map(msg => <ChatMessage key={msg.id} msg={msg} />)
          )}
          <div ref={msgEndRef} />
        </div>

        {/* ── Waveform ── */}
        <div style={{
          padding: '12px 24px',
          borderTop: '0.5px solid rgba(255,255,255,0.08)',
          borderBottom: '0.5px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', gap: 12, height: 52,
        }} aria-hidden>
          <span style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", fontWeight: 300, color: 'rgba(232,230,223,0.3)', whiteSpace: 'nowrap', letterSpacing: '0.5px' }}>
            OUTPUT
          </span>
          <canvas ref={canvasRef} style={{ flex: 1, height: 32 }} />
          <div style={statusDotStyle} />
        </div>

        {/* ── Error Banner ── */}
        {errorMsg && (
          <div style={{
            margin: '0 24px 12px',
            padding: '10px 14px',
            borderRadius: 10,
            background: 'rgba(226,75,74,0.12)',
            border: '0.5px solid rgba(226,75,74,0.3)',
            fontSize: 13,
            color: '#f09595',
            fontFamily: "'DM Mono', monospace",
          }} role="alert">
            ⚠ {errorMsg}
          </div>
        )}

        {/* ── Input Row ── */}
        <div style={{ padding: '14px 24px', display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            ref={inputRef}
            className="vl-input"
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Testing ${selectedProvider} · ${currentVoiceName} voice...`}
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: 12,
              border: '0.5px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)',
              color: '#e8e6df',
              fontFamily: "'Syne', sans-serif",
              fontSize: 14,
              caretColor: '#6c63ff',
              transition: 'border-color 0.2s, background 0.2s',
            }}
          />
          <button
            className="vl-send-btn"
            onClick={handleSend}
            disabled={isLoading}
            aria-label="Send message"
            style={{
              width: 40, height: 40,
              borderRadius: 11,
              border: 'none',
              background: isLoading ? 'rgba(108,99,255,0.3)' : '#6c63ff',
              color: 'white',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16,
              transition: 'all 0.18s',
              flexShrink: 0,
            }}
          >
            <i className="ti ti-arrow-up" aria-hidden />
          </button>
        </div>

      </div>
    </>
  );
};

export default AIChat;