import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { LogIn, Loader2 } from 'lucide-react';

export const Login: React.FC = () => {
  const { loginWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    try {
      setLoading(true);
      await loginWithGoogle();
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="max-w-md w-full p-8 bg-card border rounded-2xl shadow-xl space-y-8 text-center">
        <div className="space-y-2">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground font-bold text-3xl mx-auto shadow-lg shadow-primary/20">
            O
          </div>
          <h1 className="text-3xl font-bold tracking-tight">OHEL</h1>
          <p className="text-muted-foreground">Sua rotina, organizada e inteligente.</p>
        </div>
        
        <div className="space-y-4">
          <Button 
            onClick={handleLogin} 
            disabled={loading}
            className="w-full h-12 gap-3 text-lg rounded-xl shadow-md hover:shadow-lg transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Conectando com Google...
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                Entrar com Google
              </>
            )}
          </Button>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
            Acesso seguro via Firebase Auth
          </p>
        </div>

        <div className="pt-8 border-t grid grid-cols-3 gap-4 text-[10px] text-muted-foreground font-medium">
          <div className="space-y-1">
            <div className="text-primary font-bold">Matriz</div>
            Eisenhower
          </div>
          <div className="space-y-1 border-x">
            <div className="text-primary font-bold">Foco</div>
            Pomodoro
          </div>
          <div className="space-y-1">
            <div className="text-primary font-bold">SaaS</div>
            Multiusuário
          </div>
        </div>
      </div>
    </div>
  );
};
