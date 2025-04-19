// FILE: account-research-ui/src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css' // Ensure this is the primary CSS import
import App from './App.tsx'

// Ensure the root element exists
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount React app");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)