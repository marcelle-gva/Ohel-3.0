import React, { useState, useEffect } from 'react';
import { Institution, User, Task, EisenhowerQuadrant, OperationType } from '@/types';
import { db, handleFirestoreError } from '@/lib/firebase';
import { collection, query, onSnapshot, orderBy, updateDoc, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { 
  Building2, 
  UserPlus, 
  Users, 
  Key, 
  Plus,
  ArrowRight,
  ShieldCheck,
  Lock,
  Tag
} from 'lucide-react';

interface MemberTracking {
  userId: string;
  name: string;
  inviteCode: string;
  joinedAt: any;
}

interface InstitutionPanelProps {
  user: User; // Current user
  institution?: Institution;
  users: User[];
  onJoin: (code: string) => void;
  onDelegateTask: (userId: string, taskData: any) => void;
  hideMembers?: boolean;
  isPersonal?: boolean;
}

export const InstitutionPanel: React.FC<InstitutionPanelProps> = ({ 
  user: currentUser,
  institution, 
  users, 
  onJoin,
  onDelegateTask,
  hideMembers = false,
  isPersonal = false
}) => {
  const [inviteCode, setInviteCode] = useState('');
  const [delegateUserId, setDelegateUserId] = useState('');
  const [delegateTitle, setDelegateTitle] = useState('');
  const [delegateQuadrant, setDelegateQuadrant] = useState<EisenhowerQuadrant>('important-not-urgent');
  const [memberLog, setMemberLog] = useState<MemberTracking[]>([]);
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  const isManager = currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER' || isPersonal;

  useEffect(() => {
    if (institution?.id && isManager) {
      const q = query(
        collection(db, 'institutions', institution.id, 'members'),
        orderBy('joinedAt', 'desc')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setMemberLog(snapshot.docs.map(doc => doc.data() as MemberTracking));
      }, (error) => handleFirestoreError(error, OperationType.LIST, `institutions/${institution.id}/members`));
      return () => unsubscribe();
    }
  }, [institution?.id, isManager]);

  const handleDelegate = () => {
    if (!delegateUserId || !delegateTitle) return;
    onDelegateTask(delegateUserId, {
      title: delegateTitle,
      description: isPersonal ? 'Tarefa delegada pessoalmente.' : 'Tarefa delegada institucionalmente.',
      quadrant: delegateQuadrant,
      deadlineAt: Date.now() + 24 * 60 * 60 * 1000 // Default 24h deadline for delegated tasks
    });
    setDelegateTitle('');
  };

  if (!isManager && institution) {
    return (
      <div className="max-w-2xl mx-auto mt-12 text-center space-y-6">
        <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto text-amber-500">
          <Lock className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-black uppercase tracking-tighter italic">Acesso Restrito</h2>
          <p className="text-muted-foreground font-medium uppercase text-xs tracking-widest">Este painel é exclusivo para o administrador.</p>
        </div>
        <Card className="p-8 border-2 border-dashed rounded-[40px]">
          <p className="text-sm text-muted-foreground font-medium">
            Sua participação em <strong>{institution.name}</strong> está ativa, mas você não possui permissões administrativas para gerenciar o grupo.
          </p>
        </Card>
      </div>
    );
  }

  if (!institution) {
    return (
      <div className="max-w-md mx-auto mt-12">
        <Card className="border-2 border-dashed bg-muted/5 rounded-[40px] p-4 text-center">
          <CardHeader className="text-center pb-2">
            <div className="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-4 text-primary">
              <Building2 className="w-8 h-8" />
            </div>
            <CardTitle className="text-2xl font-black italic uppercase tracking-tighter">
              {isPersonal ? 'Ativar Gestão Pessoal' : 'Entrar em uma Instituição'}
            </CardTitle>
            <CardDescription className="font-medium text-xs uppercase tracking-widest">
              {isPersonal 
                ? 'Comece a convidar pessoas e delegar tarefas no seu círculo pessoal.' 
                : 'Insira o código de convite para colaborar com sua equipe.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="space-y-2 text-left">
              <Label htmlFor="code" className="text-[10px] font-black uppercase tracking-widest ml-1">Código de Convite</Label>
              <Input 
                id="code" 
                placeholder="EX: OHEL-2026" 
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="h-12 text-lg tracking-widest font-mono font-bold rounded-2xl"
              />
            </div>
            <Button className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs gap-2" onClick={() => onJoin(inviteCode)}>
              Validar Código
              <ArrowRight className="w-4 h-4" />
            </Button>
            {isPersonal && (
              <div className="pt-4 border-t border-dashed">
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-4">Ou crie seu próprio grupo:</p>
                <Button variant="outline" className="w-full h-12 rounded-2xl font-black uppercase tracking-widest text-[10px]" onClick={() => toast.info('Clique em "Convidar Pessoas" no seu Dashboard para gerar seu código!')}>
                  Gerar Meu Próprio Código
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 rounded-[40px] border-muted-foreground/10 overflow-hidden shadow-xl shadow-primary/5 relative">
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" aria-hidden />
          <CardHeader className="pb-4 relative">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-3xl font-black tracking-tighter uppercase italic">{institution.name}</CardTitle>
                <CardDescription className="font-bold uppercase tracking-widest text-[10px]">
                  {isPersonal ? 'Painel de Gestão Pessoal e Familiar' : 'Gestão institucional e delegação de tarefas.'}
                </CardDescription>
              </div>
              <Badge variant="secondary" className="px-3 py-1 font-black tracking-widest text-[9px] uppercase italic">
                Plano {institution.planType}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="flex items-center gap-4 p-5 bg-primary/5 rounded-[30px] border border-primary/10">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm">
                <Key className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Código de Convite Ativo</p>
                <p className="text-2xl font-mono font-black tracking-tighter italic text-primary">{institution.inviteCode || 'NENHUM'}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="rounded-xl font-bold uppercase tracking-widest text-[10px]" size="sm" onClick={() => {
                  navigator.clipboard.writeText(institution.inviteCode);
                  toast.success('Código copiado!');
                }}>Copiar</Button>
                {isManager && (
                  <div className="flex flex-col gap-1">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className={cn(
                        "rounded-xl transition-all font-black text-[9px] uppercase tracking-widest",
                        showConfirmReset ? "bg-destructive text-white hover:bg-destructive/90" : "text-destructive hover:bg-destructive/10"
                      )}
                      onClick={() => {
                        if (showConfirmReset) {
                          updateDoc(doc(db, 'institutions', institution.id), { inviteCode: '' });
                          toast.success('Código removido!');
                          setShowConfirmReset(false);
                        } else {
                          setShowConfirmReset(true);
                        }
                      }}
                    >
                      {showConfirmReset ? 'Confirmar?' : 'Remover'}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {isManager && !isPersonal && (
              <div className="mt-6 flex items-center justify-between p-4 rounded-2xl border border-border/50 bg-muted/20">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest">Exigir aprovação de tarefas delegadas</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Quando ativo, uma tarefa que um membro atribui a outro fica pendente até um gerente aceitar.
                  </p>
                </div>
                <Button
                  variant={institution.taskApprovalRequired ? 'default' : 'outline'}
                  size="sm"
                  className="rounded-xl font-black text-[9px] uppercase tracking-widest shrink-0"
                  onClick={() => {
                    updateDoc(doc(db, 'institutions', institution.id), {
                      taskApprovalRequired: !institution.taskApprovalRequired,
                    });
                    toast.success(institution.taskApprovalRequired ? 'Aprovação desativada.' : 'Aprovação ativada.');
                  }}
                >
                  {institution.taskApprovalRequired ? 'Ativada' : 'Desativada'}
                </Button>
              </div>
            )}

            {isManager && !isPersonal && (
              <div className="mt-3 flex items-center justify-between p-4 rounded-2xl border border-border/50 bg-muted/20">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest">Ranking da Equipe</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Membros competem por pontos ao completar tarefas — separado do ranking de qualquer Casa.
                  </p>
                </div>
                <Button
                  variant={institution.rankingEnabled ? 'default' : 'outline'}
                  size="sm"
                  className="rounded-xl font-black text-[9px] uppercase tracking-widest shrink-0"
                  onClick={() => {
                    updateDoc(doc(db, 'institutions', institution.id), {
                      rankingEnabled: !institution.rankingEnabled,
                    });
                    toast.success(institution.rankingEnabled ? 'Ranking desativado.' : 'Ranking ativado.');
                  }}
                >
                  {institution.rankingEnabled ? 'Ativado' : 'Desativado'}
                </Button>
              </div>
            )}
            {memberLog.length > 0 && (
              <div className="mt-8 space-y-4">
                <h4 className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
                  <Tag className="w-4 h-4 text-primary" />
                  {isPersonal ? 'Histórico de Convidados' : 'Log de Convites Usados'}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {memberLog.map((log, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-muted/50 text-[10px] border group hover:border-primary/30 transition-all">
                      <span className="font-bold uppercase tracking-tight">{log.name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[9px] font-mono border-muted-foreground/30">{log.inviteCode}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {!hideMembers && (
          <Card className="rounded-[40px] border-muted-foreground/10 overflow-hidden shadow-xl shadow-primary/5">
            <CardHeader>
              <CardTitle className="text-xl font-black uppercase tracking-tighter italic flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                {isPersonal ? 'Pessoas' : 'Membros'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {users.map(u => (
                  <div key={u.id} className="flex items-center justify-between group p-2 hover:bg-muted/50 rounded-2xl transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-black text-primary border border-primary/10 transition-colors group-hover:bg-primary group-hover:text-white">
                        {u.photoURL ? (
                          <img src={u.photoURL} alt={u.name} className="w-full h-full rounded-xl object-cover" />
                        ) : (
                          u.name.charAt(0)
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold truncate max-w-[100px]">{u.name}</p>
                        <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">{u.role}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full h-12 rounded-2xl border-dashed gap-2 font-black uppercase tracking-widest text-[10px]" onClick={() => toast.info('Gere seu código de convite no Dashboard para trazer mais pessoas!')}>
                <UserPlus className="w-4 h-4" />
                {isPersonal ? 'Adicionar Pessoa' : 'Convidar Membro'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="rounded-[40px] border-muted-foreground/10 overflow-hidden shadow-xl shadow-primary/5">
        <CardHeader>
          <CardTitle className="text-2xl font-black uppercase tracking-tighter italic">
            {isPersonal ? 'Delegar Tarefa Pessoal' : 'Delegar Tarefa Institucional'}
          </CardTitle>
          <CardDescription className="font-medium">Atribua responsabilidades diretamente aos membros conectadas.</CardDescription>
        </CardHeader>
        <CardContent className="pb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Pessoa</Label>
              <select 
                className="w-full h-12 px-4 bg-muted/50 border rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 appearance-none"
                value={delegateUserId}
                onChange={(e) => setDelegateUserId(e.target.value)}
              >
                <option value="">Selecionar...</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Assunto</Label>
              <Input 
                placeholder="Ex: Resolver pendência familiar" 
                value={delegateTitle}
                onChange={(e) => setDelegateTitle(e.target.value)}
                className="h-12 rounded-2xl font-bold bg-muted/50"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Prioridade</Label>
              <select 
                className="w-full h-12 px-4 bg-muted/50 border rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 appearance-none"
                value={delegateQuadrant}
                onChange={(e) => setDelegateQuadrant(e.target.value as EisenhowerQuadrant)}
                aria-label="Prioridade da tarefa delegada"
              >
                <option value="urgent-important">URGENTE (Fazer Agora)</option>
                <option value="important-not-urgent">IMPORTANTE (Agendar)</option>
                <option value="urgent-not-important">DELEGAR (Rotina/Outros)</option>
                <option value="not-urgent-not-important">ELIMINAR (Baixa Prioridade)</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button className="w-full h-12 rounded-2xl gap-2 font-black uppercase tracking-widest text-xs" onClick={handleDelegate}>
                <ShieldCheck className="w-4 h-4" />
                Delegar Agora
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
