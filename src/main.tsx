import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { BrandProvider } from './contexts/BrandContext'

createRoot(document.getElementById("root")!).render(
  <BrandProvider>
    <App />
  </BrandProvider>
);
