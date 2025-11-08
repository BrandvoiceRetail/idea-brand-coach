import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { BrandProvider } from './contexts/BrandContext'
import { ServiceProvider } from './services/ServiceProvider'

createRoot(document.getElementById("root")!).render(
  <ServiceProvider>
    <BrandProvider>
      <App />
    </BrandProvider>
  </ServiceProvider>
);
