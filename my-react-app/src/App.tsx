import './App.css'
// import React from 'react';
import { AIChat } from './components/AIChat';

function App() {
  return (
    <div style={{ backgroundColor: '#fafafa', minHeight: '100vh', padding: '1rem' }}>
      <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1>Multimodal AI Voice Assistant</h1>
        <p style={{ color: '#666' }}>Testing Phase 1: Gemini Text Engine</p>
      </header>
      
      <main>
        {/* 2. Render the AI Chat component on the page */}
        <AIChat />
      </main>
    </div>
  );
}

export default App;