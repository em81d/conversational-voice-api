import React, { useState } from 'react';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

export const AIChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessageText = input;
    setInput('');

    const userMessage: Message = {
      id: crypto.randomUUID(),
      sender: 'user',
      text: userMessageText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Fetch response stream binary file from your secure local backend proxy
      const response = await fetch('http://localhost:5000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessageText }),
      });

      if (!response.ok) throw new Error('Network failure down the pipeline');

      // Unpack text from custom response header setup
      const aiTextEncoded = response.headers.get('X-AI-Text');
      const aiResponseText = aiTextEncoded ? decodeURIComponent(aiTextEncoded) : "Response audio generated.";

      // Read audio binary stream into an executable browser element URL
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      // Instantly trigger verbal voice playback inside the user's browser
      const audio = new Audio(audioUrl);
      audio.play();

      const aiMessage: Message = {
        id: crypto.randomUUID(),
        sender: 'ai',
        text: aiResponseText,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("Connection or system pipeline break:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <h2>Secure Voice/Text Pipeline Studio</h2>
      
      <div style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '1rem', height: '400px', overflowY: 'auto', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            style={{
              alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              backgroundColor: msg.sender === 'user' ? '#007bff' : '#f1f1f1',
              color: msg.sender === 'user' ? '#fff' : '#000',
              padding: '0.5rem 1rem',
              borderRadius: '12px',
              maxWidth: '75%'
            }}
          >
            {msg.text}
          </div>
        ))}
        {isLoading && <div style={{ color: '#888', fontStyle: 'italic' }}>AI is thinking & speaking...</div>}
      </div>

      <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.5rem' }}>
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Send a secure message to test voices..."
          disabled={isLoading}
          style={{ flexGrow: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <button type="submit" disabled={isLoading} style={{ padding: '0.5rem 1rem', borderRadius: '4px', border: 'none', backgroundColor: '#007bff', color: 'white', cursor: 'pointer' }}>
          Send
        </button>
      </form>
    </div>
  );
};