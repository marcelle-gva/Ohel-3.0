import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './providers/ThemeProvider';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* reducedMotion="user" makes every Framer Motion animation in the app
        respect the OS-level "reduce motion" accessibility setting
        automatically, with no changes needed in individual components
        (checked 2026-09-19: nothing in the app handled this before). */}
    <MotionConfig reducedMotion="user">
      <ThemeProvider defaultTheme="dark">
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </MotionConfig>
  </StrictMode>,
);
