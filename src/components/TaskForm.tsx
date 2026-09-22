import React, { useState } from 'react';
import { Task, EisenhowerQuadrant, QUADRANT_LABELS, User, MODULES, Module, TaskTemplate, CustomFieldDefinition } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Sparkles, ClipboardList, Plus, Trash2, Tag, Home, Building2, User as UserIcon } from 'lucide-react';

interface TaskFormProps {
  initialQuadrant?: EisenhowerQuadrant;
  initialData?: Task;
  users?: User[];
  modules?: Module[];
  onSubmit: (data: any) => void;
  onCancel: () => void;
  groups?: { id: string, name: string }[];
  templates?: TaskTemplate[];
  formTitle?: string;
}

const CATEGORIES = [
  { id: 'pessoal', name: 'Pessoal' },
  { id: 'familiar', name: 'Familiar' },
  { id: 'profissional', name: 'Profissional' },
  { id: 'espiritual', name: 'Espiritual' },
];

const PRIORITIES = [
  { id: 'urgent-important', label: 'FAZER AGORA', color: 'text-red-500' },
  { id: 'important-not-urgent', label: 'AGENDAR', color: 'text-blue-500' },
  { id: 'urgent-not-important', label: 'DELEGAR', color: 'text-orange-500' },
  { id: 'not-urgent-not-important', label: 'ELIMINAR', color: 'text-slate-500' },
];

export const TaskForm: React.FC<TaskFormProps> = ({ initialQuadrant, initialData, users = [], groups = [], templates = [], formTitle, onSubmit, onCancel }) => {
  const { user, memberships } = useAuth();
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [quadrant, setQuadrant] = useState<EisenhowerQuadrant>(initialData?.quadrant || initialQuadrant || 'important-not-urgent');
  const [moduleId, setModuleId] = useState<string>(initialData?.moduleId || 'pessoal');
  const [assignedTo, setAssignedTo] = useState<string>(initialData?.assignedTo?.[0] || '');
  // Which Casa/Instituição this task belongs to — needed so the app knows
  // whose permission/approval rules apply the moment someone else is
  // assigned (2026-09-17 decision: household never requires approval,
  // institution can if the owner turned that on).
  const [contextKey, setContextKey] = useState<string>(() => {
    if (initialData?.contextType && initialData?.contextType !== 'PERSONAL' && initialData?.contextId) {
      return `${initialData.contextType}:${initialData.contextId}`;
    }
    return 'PERSONAL';
  });
  const [deadline, setDeadline] = useState(initialData?.deadlineAt ? new Date(initialData.deadlineAt).toISOString().split('T')[0] : '');
  const [scheduledDate, setScheduledDate] = useState(initialData?.scheduledDate || '');
  const [isRecurring, setIsRecurring] = useState(initialData?.isRecurring || false);
  const [recurringFrequency, setRecurringFrequency] = useState<'daily' | 'weekly' | 'monthly'>(initialData?.recurringFrequency || 'weekly');
  const [visibility, setVisibility] = useState<'PRIVATE' | 'PUBLIC' | 'SPECIFIC'>(initialData?.visibility || 'PUBLIC');
  const [visibleItems, setVisibleItems] = useState<string[]>(initialData?.visibleToUsers || initialData?.visibleToGroups || []);

  // Custom fields from template or created on the fly
  const [taskCustomFields, setTaskCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>(initialData?.customFields || {});
  const [newCustomFieldName, setNewCustomFieldName] = useState('');

  // New fields for financial intelligence
  const [isFinanceLinked, setIsFinanceLinked] = useState(!!initialData?.financeInfo);
  const [financeType, setFinanceType] = useState<'INCOME' | 'EXPENSE'>(initialData?.financeInfo?.type || 'EXPENSE');
  const [financePillar, setFinancePillar] = useState<'profissional' | 'casa'>(initialData?.financeInfo?.pillar || 'casa');
  const [financeAmount, setFinanceAmount] = useState(initialData?.financeInfo?.amount?.toString() || '');

  const handleTitleChange = (val: string) => {
    setTitle(val);
    const keywords = ['pagamento', 'financeiro', 'pago', 'receber', 'custo', 'gasto', 'compra'];
    if (keywords.some(k => val.toLowerCase().includes(k))) {
      setIsFinanceLinked(true);
    }
  };

  const handleApplyTemplate = (tplId: string) => {
    const tpl = templates.find(t => t.id === tplId);
    if (tpl) {
      setTitle(tpl.title);
      setQuadrant(tpl.quadrant);
      if (tpl.moduleId) setModuleId(tpl.moduleId);
      if (tpl.description) setDescription(tpl.description);
      if (tpl.customFields && tpl.customFields.length > 0) {
        setTaskCustomFields(tpl.customFields);
        const defaults: Record<string, string> = {};
        tpl.customFields.forEach(f => {
          defaults[f.label] = f.defaultValue || '';
        });
        setCustomFieldValues(prev => ({ ...prev, ...defaults }));
      }
    }
  };

  const handleAddQuickCustomField = () => {
    if (!newCustomFieldName.trim()) return;
    const label = newCustomFieldName.trim();
    const id = `cf_${Date.now()}`;
    const newField: CustomFieldDefinition = { id, label, type: 'text' };
    setTaskCustomFields(prev => [...prev, newField]);
    setNewCustomFieldName('');
    // Also append variable tag to description if not already present
    if (!description.includes(`{{${label}}}`)) {
      setDescription(prev => (prev ? `${prev}\n{{${label}}}` : `{{${label}}}`));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    const isDelegating = quadrant === 'urgent-not-important';
    const isGroup = assignedTo.startsWith('group:');
    const targetId = isGroup ? assignedTo.replace('group:', '') : assignedTo;

    // Resolve custom fields in description
    let resolvedDesc = description;
    Object.entries(customFieldValues).forEach(([key, val]) => {
      if (val) {
        resolvedDesc = resolvedDesc.replace(new RegExp(`{{${key}}}`, 'g'), val);
      }
    });

    const hasAssignee = targetId && targetId !== '';
    const isAssigningSomeoneElse = hasAssignee && !isGroup && targetId !== user?.uid;
    const isAssigningGroup = hasAssignee && isGroup; // groups only exist inside an institution, so always "someone else"

    const [selectedContextType, selectedContextId] = contextKey === 'PERSONAL'
      ? ['PERSONAL', null]
      : contextKey.split(':');
    const activeMembership = memberships.find(
      (m) => m.contextType === selectedContextType && m.contextId === selectedContextId
    );
    // Household never requires approval (product decision 2026-09-17);
    // institution does only if its owner turned taskApprovalRequired on.
    const requiresApproval = selectedContextType === 'INSTITUTION' && !!activeMembership?.taskApprovalRequired;
    const isDelegatingToOther = isAssigningSomeoneElse || isAssigningGroup;

    const payload = { 
      title, 
      description: resolvedDesc || null, 
      quadrant,
      moduleId,
      contextType: selectedContextType,
      contextId: selectedContextId,
      assignedTo: (hasAssignee && !isGroup) ? [targetId] : null,
      assignedToGroups: (hasAssignee && isGroup) ? [targetId] : null,
      // Only set when actually handing this off to someone/some group else —
      // this is what the Firestore rules check to authorize delegation.
      assignedBy: isDelegatingToOther ? (user?.uid || null) : null,
      status: (isDelegatingToOther && requiresApproval) ? 'PENDING_APPROVAL' : (initialData?.status || undefined),
      deadlineAt: deadline ? new Date(deadline).getTime() : null,
      scheduledDate: scheduledDate || null,
      isRecurring,
      recurringFrequency: isRecurring ? recurringFrequency : null,
      visibility,
      visibleToUsers: visibility === 'SPECIFIC' ? visibleItems.filter(i => !i.startsWith('group:')) : null,
      visibleToGroups: visibility === 'SPECIFIC' ? visibleItems.filter(i => i.startsWith('group:')).map(i => i.replace('group:', '')) : null,
      financeInfo: isFinanceLinked ? { type: financeType, pillar: financePillar, amount: parseFloat(financeAmount) || 0 } : null,
      customFields: Object.keys(customFieldValues).length > 0 ? customFieldValues : null,
    };

    console.log("Submetendo formulário de tarefa. Payload:", payload);
    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-2">
      <DialogHeader className="flex flex-row items-center justify-between space-y-0">
        <DialogTitle className="text-xl font-bold">
          {formTitle || (initialData ? 'Editar Tarefa' : 'Nova Tarefa')}
        </DialogTitle>
        {!initialData && templates.length > 0 && (
          <Select onValueChange={handleApplyTemplate}>
            <SelectTrigger className="w-[180px] h-9 text-[10px] font-black uppercase tracking-widest bg-primary/5 border-primary/20">
               <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-primary fill-current" />
                  <span>Usar Modelo</span>
               </div>
            </SelectTrigger>
            <SelectContent>
              {templates.map(tpl => (
                <SelectItem key={tpl.id} value={tpl.id}>{tpl.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </DialogHeader>
      
      <div className="grid grid-cols-1 gap-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">O que você vai realizar?</Label>
          <Input
            id="title"
            placeholder="Título da tarefa..."
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            autoFocus
            className="h-10"
          />
        </div>

        {isFinanceLinked && (
          <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-xl space-y-3 animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-green-600 uppercase">Inteligência Financeira</Label>
              <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setIsFinanceLinked(false)}>Ignorar</Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px]">Tipo</Label>
                <div className="flex gap-1">
                  <Button 
                    type="button" 
                    size="sm" 
                    variant={financeType === 'INCOME' ? 'default' : 'outline'} 
                    className="flex-1 h-8 text-[10px]"
                    onClick={() => setFinanceType('INCOME')}
                  >Entrada</Button>
                  <Button 
                    type="button" 
                    size="sm" 
                    variant={financeType === 'EXPENSE' ? 'default' : 'outline'} 
                    className="flex-1 h-8 text-[10px]"
                    onClick={() => setFinanceType('EXPENSE')}
                  >Saída</Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Pilar</Label>
                <div className="flex gap-1">
                  <Button 
                    type="button" 
                    size="sm" 
                    variant={financePillar === 'profissional' ? 'default' : 'outline'} 
                    className="flex-1 h-8 text-[10px]"
                    onClick={() => setFinancePillar('profissional')}
                  >Profissional</Button>
                  <Button 
                    type="button" 
                    size="sm" 
                    variant={financePillar === 'casa' ? 'default' : 'outline'} 
                    className="flex-1 h-8 text-[10px]"
                    onClick={() => setFinancePillar('casa')}
                  >Da Casa</Button>
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Valor Sugerido para o Lançamento</Label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs text-muted-foreground font-bold">R$</span>
                <Input 
                  type="number" 
                  className="pl-8 h-8 text-sm" 
                  value={financeAmount} 
                  onChange={e => setFinanceAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="description" className="text-xs font-semibold">Descrição (Detalhes importantes)</Label>
            <div className="flex items-center gap-2">
              <Input 
                placeholder="Novo campo personalizado..."
                value={newCustomFieldName}
                onChange={e => setNewCustomFieldName(e.target.value)}
                className="h-7 text-xs w-48 rounded-lg"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddQuickCustomField();
                  }
                }}
              />
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={handleAddQuickCustomField}
                disabled={!newCustomFieldName.trim()}
                className="h-7 text-xs font-semibold px-2 rounded-lg gap-1"
              >
                <Plus className="w-3 h-3" /> Campo
              </Button>
            </div>
          </div>
          <Textarea
            id="description"
            placeholder="Observações, passos ou instruções adicionais..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-[85px] rounded-xl text-sm"
          />
        </div>

        {/* Dynamic Custom Fields from Template or Created on Task */}
        {taskCustomFields.length > 0 && (
          <div className="p-4 bg-muted/20 border rounded-2xl space-y-3">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-primary" />
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Campos Personalizados ({taskCustomFields.length})
              </Label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {taskCustomFields.map((field) => (
                <div key={field.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] font-semibold text-foreground">{field.label}</Label>
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="icon" 
                      className="h-5 w-5 text-muted-foreground hover:text-destructive"
                      onClick={() => setTaskCustomFields(prev => prev.filter(f => f.id !== field.id))}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  {field.type === 'checkbox' ? (
                    <div className="flex items-center gap-2 h-9">
                      <input 
                        type="checkbox"
                        checked={customFieldValues[field.label] === 'Sim'}
                        onChange={e => setCustomFieldValues(prev => ({ ...prev, [field.label]: e.target.checked ? 'Sim' : 'Não' }))}
                        className="w-4 h-4 rounded border-gray-300 text-primary"
                      />
                      <span className="text-xs text-muted-foreground">Marcar como realizado / ativo</span>
                    </div>
                  ) : (
                    <Input 
                      type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                      placeholder={field.placeholder || `Preencher ${field.label}...`}
                      value={customFieldValues[field.label] || ''}
                      onChange={e => setCustomFieldValues(prev => ({ ...prev, [field.label]: e.target.value }))}
                      className="h-9 text-xs rounded-lg"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 p-3 bg-muted/30 rounded-xl border border-border/50">
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              id="isRecurring"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
            />
            <Label htmlFor="isRecurring" className="cursor-pointer text-sm font-semibold">Tarefa Recorrente</Label>
          </div>

          {isRecurring && (
            <div className="space-y-2 animate-in fade-in slide-in-from-left-1">
              <Select value={recurringFrequency} onValueChange={(v) => setRecurringFrequency(v as any)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Frequência" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Diária</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="category">Categoria / Pilar</Label>
            <Select value={moduleId} onValueChange={setModuleId}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deadline">Prazo final</Label>
            <Input 
              id="deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="h-10"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="context">Onde essa tarefa vive?</Label>
          <Select value={contextKey} onValueChange={setContextKey}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PERSONAL">
                <span className="flex items-center gap-2"><UserIcon className="w-3.5 h-3.5" /> Só minha (Pessoal)</span>
              </SelectItem>
              {memberships.filter(m => m.contextType === 'HOUSEHOLD').map((m) => (
                <SelectItem key={`HOUSEHOLD:${m.contextId}`} value={`HOUSEHOLD:${m.contextId}`}>
                  <span className="flex items-center gap-2"><Home className="w-3.5 h-3.5 text-purple-600" /> {m.name}</span>
                </SelectItem>
              ))}
              {memberships.filter(m => m.contextType === 'INSTITUTION').map((m) => (
                <SelectItem key={`INSTITUTION:${m.contextId}`} value={`INSTITUTION:${m.contextId}`}>
                  <span className="flex items-center gap-2"><Building2 className="w-3.5 h-3.5 text-amber-600" /> {m.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {contextKey !== 'PERSONAL' && assignedTo && assignedTo !== user?.uid && (
            <p className="text-[11px] text-muted-foreground">
              {contextKey.startsWith('INSTITUTION') && memberships.find(m => `${m.contextType}:${m.contextId}` === contextKey)?.taskApprovalRequired
                ? 'Essa instituição exige aprovação — a tarefa fica pendente até um gerente aceitar.'
                : 'Vai aparecer direto na agenda da pessoa/grupo escolhido.'}
            </p>
          )}
        </div>

        <div className="space-y-3 p-4 bg-muted/20 border rounded-xl">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Sparkles className="w-3 h-3" /> Visibilidade e Privacidade
          </Label>
          <Select value={visibility} onValueChange={(v: any) => setVisibility(v)}>
            <SelectTrigger className="h-10 bg-background">
              <SelectValue placeholder="Quem pode ver?" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PRIVATE">Somente eu (Privado)</SelectItem>
              <SelectItem value="PUBLIC">Todos da Instituição (Público)</SelectItem>
              <SelectItem value="SPECIFIC">Usuários/Grupos específicos</SelectItem>
            </SelectContent>
          </Select>

          {visibility === 'SPECIFIC' && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
              <Label className="text-[10px]">Selecione quem visualizará:</Label>
              <Select 
                onValueChange={(val) => {
                  if (val && !visibleItems.includes(val)) {
                    setVisibleItems([...visibleItems, val]);
                  }
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Adicionar pessoa ou grupo" />
                </SelectTrigger>
                <SelectContent>
                  <optgroup label="Usuários">
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </optgroup>
                  {groups.length > 0 && (
                    <optgroup label="Grupos">
                      {groups.map(g => (
                        <SelectItem key={g.id} value={`group:${g.id}`}>{g.name}</SelectItem>
                      ))}
                    </optgroup>
                  )}
                </SelectContent>
              </Select>

              {visibleItems.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {visibleItems.map(item => {
                    const isGroup = item.startsWith('group:');
                    const id = isGroup ? item.replace('group:', '') : item;
                    const name = isGroup 
                      ? groups.find(g => g.id === id)?.name 
                      : users.find(u => u.id === id)?.name;

                    return (
                      <div key={item} className="flex items-center gap-1.5 px-2 py-1 bg-primary/10 border border-primary/20 rounded-md text-[10px] font-medium text-primary">
                        {name || 'Carregando...'}
                        <button 
                          type="button"
                          onClick={() => setVisibleItems(visibleItems.filter(i => i !== item))}
                          className="hover:text-red-500 transition-colors"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Prioridade (Matriz de Eisenhower)</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PRIORITIES.map(p => (
              <Button
                key={p.id}
                type="button"
                variant={quadrant === p.id ? 'default' : 'outline'}
                className={cn(
                  "h-12 text-[10px] font-black tracking-widest uppercase",
                  quadrant === p.id && "shadow-lg scale-105"
                )}
                onClick={() => setQuadrant(p.id as any)}
                aria-label={`Prioridade: ${p.label}`}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>

        {quadrant === 'important-not-urgent' && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
            <Label htmlFor="scheduledDate">Data do Agendamento</Label>
            <Input 
              id="scheduledDate"
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              placeholder="Quando esta tarefa será realizada?"
              className="h-10"
            />
          </div>
        )}

        {(quadrant === 'urgent-not-important' || users.length > 0) && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="delegate">
                {quadrant === 'urgent-not-important' ? 'Delegar para (Obrigatório):' : 'Atribuir a responsável (Opcional):'}
              </Label>
              {assignedTo && (
                <button
                  type="button"
                  onClick={() => setAssignedTo('')}
                  className="text-[10px] text-muted-foreground hover:text-destructive underline"
                >
                  Limpar seleção
                </button>
              )}
            </div>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger id="delegate" className="h-10" aria-label="Responsável da tarefa">
                <SelectValue placeholder="Selecione um membro ou grupo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhum / Não atribuído</SelectItem>
                <optgroup label="Usuários">
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </optgroup>
                {groups.length > 0 && (
                  <optgroup label="Grupos">
                    {groups.map(g => (
                      <SelectItem key={g.id} value={`group:${g.id}`}>{g.name}</SelectItem>
                    ))}
                  </optgroup>
                )}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <DialogFooter className="mt-6 gap-2 border-t pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!title.trim() || (quadrant === 'urgent-not-important' && assignedTo === '')} className="px-8 font-black tracking-widest uppercase">
          {initialQuadrant ? 'Salvar' : 'Criar Tarefa'}
        </Button>
      </DialogFooter>
    </form>
  );
};
