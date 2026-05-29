import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';

// 1. Define strict TypeScript interfaces for our messages
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

  // 2. Initialize the Gemini client 
  // (Temporary for prototyping. In production, this will move to your backend)
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || "" });

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessageText = input;
    setInput(''); // Clear input box immediately

    // 3. Append user message to chat history
    const userMessage: Message = {
      id: crypto.randomUUID(),
      sender: 'user',
      text: userMessageText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // 4. Request text generation from Gemini 3.5 Flash
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: userMessageText,
      });

      const aiResponseText = response.text || "I couldn't generate a response.";

      // 5. Append AI response to chat history
      const aiMessage: Message = {
        id: crypto.randomUUID(),
        sender: 'ai',
        text: aiResponseText,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("Gemini API Error:", error);
      // Optional: Add an error message state to display to the user
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <h2>Gemini AI Chat Prototyping</h2>
      
      {/* Chat Window Container */}
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
        {isLoading && <div style={{ color: '#888', fontStyle: 'italic' }}>Gemini is thinking...</div>}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.5rem' }}>
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
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