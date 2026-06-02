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
  const [input,             setInput]            = useState('');
  const [isLoading,         setIsLoading]        = useState(false);
  const [errorMsg,          setErrorMsg]         = useState<string | null>(null);
  const [selectedProvider,  setSelectedProvider] = useState<ProviderType>('google');
  const [selectedVoice,     setSelectedVoice]    = useState<string>('Puck');
  const [waveState,         setWaveStateLocal]   = useState<WaveState>('idle');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const msgEndRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  const setWaveState = useWaveform(canvasRef, selectedProvider);
  const theme = PROVIDER_THEME[selectedProvider];

  useEffect(() => {
    setSelectedVoice(VOICE_REGISTRY[selectedProvider][0].id);
  }, [selectedProvider]);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const currentVoice = VOICE_REGISTRY[selectedProvider].find(v => v.id === selectedVoice);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput('');
    setErrorMsg(null);

    const userMsg: Message  = { id: crypto.randomUUID(), sender: 'user', text, timestamp: new Date() };
    const typingMsg: Message = { id: crypto.randomUUID(), sender: 'ai',  text: '', timestamp: new Date(), isTyping: true };

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

      setMessages(prev => prev.map(m => m.isTyping ? { ...m, text: aiText, isTyping: false } : m));

    } catch (err: any) {
      setMessages(prev => prev.map(m =>
        m.isTyping ? { ...m, text: '[Error: could not connect to backend]', isTyping: false } : m
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

        {/* ── Input ── */}
        <div style={{ padding: '12px 20px', display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            ref={inputRef}
            className="vl-input"
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${theme.label} · ${currentVoice?.name ?? ''}...`}
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '10px 15px',
              borderRadius: 12,
              border: `1.5px solid`,
              borderColor: input.length > 0 ? theme.primary : '#E5E7EB',
              background: '#fff',
              color: '#111827',
              fontSize: 14,
              fontWeight: 400,
              transition: 'border-color 0.18s',
              caretColor: theme.primary,
            }}
          />
          <button
            className="vl-send"
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            aria-label="Send message"
            style={{
              width: 42, height: 42,
              borderRadius: 12,
              border: 'none',
              background: isLoading || !input.trim() ? '#E5E7EB' : theme.primary,
              color: isLoading || !input.trim() ? '#9CA3AF' : '#fff',
              cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 17,
              transition: 'all 0.18s',
              flexShrink: 0,
              boxShadow: !isLoading && input.trim() ? `0 2px 8px ${theme.primary}44` : 'none',
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