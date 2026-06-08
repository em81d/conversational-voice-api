import './App.css'
// import React from 'react';
import { AIChat } from './components/AIChat';

function App() {
  return (
    <div style={{ backgroundColor: '#fafafa', minHeight: '100vh', padding: '1rem', boxShadow: '0 0 12px #a56fb0'}}>
      <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1>Conversational Voice Evaluation</h1>
        <p style={{ color: '#666' }}>Hume EVI, Gemini Live, and ElevenLabs conversational</p>
      </header>
      
      <main style={{margin: '20px'}}>
        {/* 2. Render the AI Chat component on the page */}
        <AIChat />
      </main>
    </div>
  );
}

export default App;