import React, { useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { User, UserGroup, GroupPermission } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Users, Trash2, ShieldCheck, Wallet, Calendar as CalendarIcon, Check as CheckIcon, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const PERMISSION_LABELS: Record<GroupPermission, { label: string; icon: React.ElementType }> = {
  VIEW_CALENDAR: { label: 'Ver calendário da instituição', icon: CalendarIcon },
  VIEW_FINANCE: { label: 'Ver contas/finanças', icon: Wallet },
  MANAGE_FINANCE: { label: 'Gerenciar contas/finanças', icon: Wallet },
  APPROVE_TASKS: { label: 'Aprovar tarefas delegadas', icon: CheckIcon },
  MANAGE_MEMBERS: { label: 'Gerenciar membros', icon: UserCog },
};

interface GroupManagementProps {
  institutionId: string;
  groups: UserGroup[];
  users: User[];
}

/**
 * "Minha esposa mesmo sendo membra da igreja iria visualizar o calendário
 * da igreja se fosse cadastrada em algum grupo importante da igreja teria
 * os devidos acessos tipo tesoureira" (2026-09-17). A group's permissions
 * (read here by canReadPillarDoc/hasHouseholdPermission-style checks
 * elsewhere) are the actual access grant — membership in the group alone
 * grants nothing beyond what's checked here explicitly.
 */
export const GroupManagement: React.FC<GroupManagementProps> = ({ institutionId, groups, users }) => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<UserGroup | null>(null);
  const [name, setName] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<GroupPermission[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditingGroup(null);
    setName('');
    setSelectedPermissions([]);
    setSelectedMembers([]);
    setIsCreateOpen(true);
  };

  const openEdit = (group: UserGroup) => {
    setEditingGroup(group);
    setName(group.name);
    setSelectedPermissions(group.permissions || []);
    setSelectedMembers(group.members || []);
    setIsCreateOpen(true);
  };

  const togglePermission = (perm: GroupPermission) => {
    setSelectedPermissions((prev) => (prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]));
  };

  const toggleMember = (userId: string) => {
    setSelectedMembers((prev) => (prev.includes(userId) ? prev.filter((u) => u !== userId) : [...prev, userId]));
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (editingGroup) {
        await updateDoc(doc(db, 'groups', editingGroup.id), {
          name: name.trim(),
          permissions: selectedPermissions,
          members: selectedMembers,
        });
        toast.success('Grupo atualizado!');
      } else {
        const ref = doc(collection(db, 'groups'));
        await setDoc(ref, {
          id: ref.id,
          name: name.trim(),
          institutionId,
          permissions: selectedPermissions,
          members: selectedMembers,
          createdAt: serverTimestamp(),
        });
        toast.success('Grupo criado!');
      }
      setIsCreateOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar grupo.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (groupId: string) => {
    try {
      await deleteDoc(doc(db, 'groups', groupId));
      toast.success('Grupo removido.');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao remover grupo.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tighter italic">Grupos & Permissões</h2>
          <p className="text-xs text-muted-foreground">Ex: "Tesouraria" com acesso às finanças, sem precisar ser ADMIN.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="w-4 h-4" /> Novo Grupo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingGroup ? 'Editar Grupo' : 'Novo Grupo'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="group-name">Nome do grupo</Label>
                <Input id="group-name" placeholder='Ex: "Tesouraria"' value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Permissões</Label>
                <div className="space-y-1.5" role="group" aria-label="Permissões do grupo">
                  {(Object.keys(PERMISSION_LABELS) as GroupPermission[]).map((perm) => {
                    const { label, icon: Icon } = PERMISSION_LABELS[perm];
                    const checked = selectedPermissions.includes(perm);
                    return (
                      <div
                        key={perm}
                        role="checkbox"
                        aria-checked={checked}
                        tabIndex={0}
                        onClick={() => togglePermission(perm)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            togglePermission(perm);
                          }
                        }}
                        className={cn(
                          'w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                          checked ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                        )}
                      >
                        <Checkbox checked={checked} onCheckedChange={() => togglePermission(perm)} tabIndex={-1} />
                        <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium flex-1">{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Membros do grupo</Label>
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1" role="group" aria-label="Membros do grupo">
                  {users.map((u) => {
                    const checked = selectedMembers.includes(u.id);
                    return (
                      <div
                        key={u.id}
                        role="checkbox"
                        aria-checked={checked}
                        tabIndex={0}
                        onClick={() => toggleMember(u.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleMember(u.id);
                          }
                        }}
                        className={cn(
                          'w-full flex items-center gap-3 p-2 rounded-xl border text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                          checked ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                        )}
                      >
                        <Checkbox checked={checked} onCheckedChange={() => toggleMember(u.id)} tabIndex={-1} />
                        <span className="text-sm flex-1 truncate">{u.name}</span>
                      </div>
                    );
                  })}
                  {users.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhum membro na instituição ainda.</p>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving || !name.trim()}>
                {editingGroup ? 'Salvar' : 'Criar Grupo'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {groups.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-bold">Nenhum grupo criado ainda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groups.map((group) => (
            <Card key={group.id} className="border-muted-foreground/10">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg font-black flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-primary" />
                      {group.name}
                    </CardTitle>
                    <CardDescription>{(group.members || []).length} membro(s)</CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => handleDelete(group.id)} aria-label={`Remover grupo ${group.name}`}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {(group.permissions || []).length > 0 ? (
                    group.permissions!.map((p) => (
                      <Badge key={p} variant="secondary" className="text-[9px] font-bold uppercase tracking-wide">
                        {PERMISSION_LABELS[p]?.label || p}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-[11px] text-muted-foreground">Nenhuma permissão especial.</p>
                  )}
                </div>
                <Button variant="outline" size="sm" className="w-full" onClick={() => openEdit(group)}>
                  Editar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
