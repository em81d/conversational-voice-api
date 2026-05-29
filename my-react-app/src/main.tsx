// import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'


const myelement = (
  <div>
    <App />
  </div>

);

createRoot(document.getElementById('root')!).render(
  myelement
)
