import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './learn.css';
import LearnApp from './LearnApp.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LearnApp />
  </StrictMode>
);
