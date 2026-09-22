import React, { useEffect, useState } from 'react';
import { 
  StreamVideo, 
  StreamVideoClient, 
  User, 
  Call, 
  StreamCall, 
  SpeakerLayout, 
  CallControls,
  useCallStateHooks
} from '@stream-io/video-react-sdk';
import '@stream-io/video-react-sdk/dist/css/styles.css';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Video, VideoOff, Mic, MicOff, PhoneOff, Hash, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { auth } from '@/lib/firebase';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';

interface VideoCallProps {
  userId: string;
  userName: string;
  institutionId?: string;
  canStartCall?: boolean;
}

export const VideoCall: React.FC<VideoCallProps> = ({ userId, userName, institutionId, canStartCall }) => {
  const { activeContextType, activeContextId, isPlatformAdmin } = useAuth();
  const { hasVideoCalls } = usePlanFeatures();
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const clientRef = React.useRef<StreamVideoClient | null>(null);
  const [call, setCall] = useState<Call | null>(null);
  const [loading, setLoading] = useState(true);
  const [inCall, setInCall] = useState(false);
  const [callCode, setCallCode] = useState('');

  const institutionalRoomId = institutionId ? `room-${institutionId}` : 'ohel-main-room';

  // Video calls are a Plus-only feature scoped to the ACTIVE context
  // (Household or Institution), never to the bare-personal profile — see
  // usePlanFeatures. Skip even trying to fetch a token if this context
  // can't use it; the backend enforces this too, but there's no point
  // spending a round-trip (and showing a confusing error) when we already
  // know the answer client-side.
  const eligibleForVideo = isPlatformAdmin || hasVideoCalls;

  useEffect(() => {
    let active = true;

    const initClient = async () => {
      if (!eligibleForVideo) {
        setLoading(false);
        return;
      }
      try {
        const backendUrl = import.meta.env.PROD 
          ? 'https://ohel-api.onrender.com' 
          : 'http://localhost:3000';

        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) throw new Error('Sessão expirada. Faça login novamente.');

        const response = await fetch(`${backendUrl}/api/stream-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            userId,
            contextType: activeContextType,
            contextId: activeContextId,
          })
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody.error || 'Falha ao obter token de acesso');
        }
        
        const { token, apiKey } = await response.json();

        if (!active) return;

        const user: User = {
          id: userId,
          name: userName,
          image: `https://getstream.io/random_svg/?id=${userId}&name=${userName}`,
        };

        const streamClient = new StreamVideoClient({ apiKey, user, token });
        clientRef.current = streamClient;
        setClient(streamClient);
        setLoading(false);
      } catch (error: any) {
        if (active) {
          console.error('Stream init error:', error);
          toast.error(error.message || 'Erro ao conectar à videochamada. Tente novamente.');
          setLoading(false);
        }
      }
    };

    initClient();

    return () => {
      active = false;
      if (clientRef.current) {
        clientRef.current.disconnectUser();
        clientRef.current = null;
      }
    };
  }, [userId, userName, activeContextType, activeContextId, eligibleForVideo]); 

  const joinCall = async (customRoomId?: string) => {
    if (!client) return;
    
    const finalRoomId = customRoomId || institutionalRoomId;

    if (!finalRoomId) {
      toast.error('Código da chamada inválido');
      return;
    }
    
    try {
      const callInstance = client.call('default', finalRoomId);
      await callInstance.join({ create: canStartCall || !!customRoomId });
      setCall(callInstance);
      setInCall(true);
      toast.success('Conectado à sala de reunião');
    } catch (error: any) {
      console.error('Join call error:', error);
      toast.error('Erro ao entrar na chamada. Verifique se o código está correto.');
    }
  };

  const leaveCall = async () => {
    if (call) {
      await call.leave();
      setCall(null);
    }
    setInCall(false);
  };

  if (!eligibleForVideo) {
    return (
      <div className="p-12 text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
          <Crown className="w-7 h-7" />
        </div>
        <p className="font-black uppercase tracking-widest text-sm">Videochamada é um recurso Plus</p>
        <p className="text-xs text-muted-foreground max-w-xs mx-auto">
          Faça upgrade da Casa/Instituição ativa pra Plus pra liberar chamadas de vídeo pra todos os membros.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium uppercase tracking-widest text-xs">Conectando ao OHEL Video...</p>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive font-bold uppercase underline">Serviço de vídeo não configurado.</p>
        <p className="text-xs mt-2 text-muted-foreground">O administrador precisa configurar as chaves da API do Stream no servidor.</p>
      </div>
    );
  }

  if (inCall && call) {
    return (
      <div className="h-[80vh] w-full rounded-2xl overflow-hidden shadow-2xl border-4 border-slate-900 bg-slate-950">
        <StreamVideo client={client}>
          <StreamCall call={call}>
            <div className="relative h-full flex flex-col">
              <div className="flex-1">
                <SpeakerLayout 
                  VideoPlaceholder={() => null} 
                  PictureInPicturePlaceholder={() => null}
                />
              </div>
              <div className="bg-slate-900/90 p-4 border-t border-slate-800 flex justify-center gap-4">
                <CallControls onLeave={leaveCall} />
              </div>
            </div>
          </StreamCall>
        </StreamVideo>
      </div>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto border-2 shadow-xl overflow-hidden hover:border-primary/30 transition-all duration-500">
      <CardHeader className="bg-muted/50 border-b p-8">
        <div className="flex items-center justify-between">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
            <Video className="w-8 h-8 text-primary" />
          </div>
          <div className="bg-primary/20 px-3 py-1 rounded-full border border-primary/30">
            <span className="text-[10px] font-black uppercase text-primary animate-pulse">NOVO RECURSO</span>
          </div>
        </div>
        <CardTitle className="text-3xl font-black italic tracking-tighter uppercase">Chamada de Vídeo</CardTitle>
        <CardDescription className="text-xs font-bold uppercase tracking-widest opacity-70">
          {canStartCall ? 'Inicie ou entre na sala oficial de sua instituição.' : 'Entre em uma chamada existente usando um código.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-8 md:p-12 text-center space-y-8">
        <div className="space-y-4">
          <h3 className="text-xl font-black italic uppercase tracking-tight">
            {canStartCall ? 'Sala da Instituição' : 'Acesso via Código'}
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto font-medium">
            {canStartCall 
              ? `Como administrador do plano ${institutionId ? 'Institucional' : 'Master'}, você pode iniciar a sala oficial.`
              : 'Para entrar em uma chamada, você deve possuir o código fornecido pelo anfitrião.'}
          </p>
        </div>
        
        <div className="space-y-6">
          {canStartCall && (
            <Button 
              onClick={() => joinCall()} 
              size="lg" 
              className="w-full h-16 px-12 rounded-2xl font-black tracking-widest uppercase text-xs shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
            >
              Iniciar / Entrar na Sala Oficial
              <Video className="ml-2 w-5 h-5" />
            </Button>
          )}

          <div className="relative group text-left">
            <Label className="text-[10px] font-black uppercase tracking-widest mb-2 block opacity-50 ml-1">Entrar via Código</Label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Hash className="h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              </div>
              <Input 
                placeholder="DIGITE O CÓDIGO (EX: ROOM-123)" 
                value={callCode}
                onChange={(e) => setCallCode(e.target.value)}
                className="h-14 pl-12 rounded-2xl border-2 focus-visible:ring-primary/20 font-bold uppercase tracking-widest text-xs"
              />
            </div>
          </div>

          <Button 
            disabled={!callCode}
            onClick={() => joinCall(callCode)} 
            variant={canStartCall ? "outline" : "default"}
            size="lg" 
            className="w-full h-14 px-12 rounded-2xl font-black tracking-widest uppercase text-xs shadow-lg hover:scale-[1.02] active:scale-95 transition-all"
          >
            Entrar com Código
          </Button>
        </div>
        
        <div className="pt-8 border-t border-dashed flex items-center justify-center gap-6 opacity-40">
          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 rounded-full border-2 border-current flex items-center justify-center">
              <Mic className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-black uppercase">Áudio HD</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 rounded-full border-2 border-current flex items-center justify-center">
              <Video className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-black uppercase">Vídeo 4K</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 rounded-full border-2 border-current flex items-center justify-center">
              <PhoneOff className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-black uppercase">Seguro</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
