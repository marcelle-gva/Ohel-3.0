import React, { useState } from 'react';
import { TaskTemplate, EisenhowerQuadrant, QUADRANT_LABELS, MODULES, CustomFieldDefinition } from '@/types';
import { motion } from 'motion/react';
import { Plus, Trash2, ChevronRight, Settings2, Sparkles, ClipboardList, Tag, Type, Hash, Calendar, CheckSquare, ListFilter, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TemplatesViewProps {
  templates: TaskTemplate[];
  onCreateTemplate: (data: Partial<TaskTemplate>) => void;
  onDeleteTemplate: (id: string) => void;
  onUseTemplate: (template: TaskTemplate) => void;
}

const FIELD_TYPE_ICONS: Record<string, any> = {
  text: Type,
  number: Hash,
  date: Calendar,
  select: ListFilter,
  checkbox: CheckSquare,
};

export const TemplatesView: React.FC<TemplatesViewProps> = ({ 
  templates, 
  onCreateTemplate, 
  onDeleteTemplate, 
  onUseTemplate 
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newQuadrant, setNewQuadrant] = useState<EisenhowerQuadrant>('important-not-urgent');
  const [newModuleId, setNewModuleId] = useState('pessoal');
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);

  // Quick field creator inside description
  const [quickFieldName, setQuickFieldName] = useState('');
  const [quickFieldType, setQuickFieldType] = useState<'text' | 'number' | 'date' | 'select' | 'checkbox'>('text');

  const addCustomField = (customName?: string, customType?: 'text' | 'number' | 'date' | 'select' | 'checkbox') => {
    const label = (customName || '').trim();
    const id = `field_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newField: CustomFieldDefinition = {
      id,
      label: label || `Campo ${customFields.length + 1}`,
      type: customType || 'text',
      placeholder: '',
      required: false,
    };
    setCustomFields(prev => [...prev, newField]);

    if (label) {
      // Auto inject into description if specified
      insertFieldIntoDescription(label);
      setQuickFieldName('');
    }
  };

  const removeCustomField = (id: string) => {
    setCustomFields(prev => prev.filter(f => f.id !== id));
  };

  const updateCustomField = (id: string, updates: Partial<CustomFieldDefinition>) => {
    setCustomFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const insertFieldIntoDescription = (fieldLabel: string) => {
    const tag = `{{${fieldLabel}}}`;
    setNewDesc(prev => (prev ? `${prev} ${tag}` : tag));
    toast.success(`Variável ${tag} inserida na descrição!`);
  };

  const handleCreate = () => {
    if (!newTitle.trim()) {
      toast.error('Informe o título do modelo.');
      return;
    }

    const validFields = customFields.filter(f => f.label.trim());

    onCreateTemplate({
      title: newTitle.trim(),
      description: newDesc.trim(),
      quadrant: newQuadrant,
      moduleId: newModuleId,
      customFields: validFields
    });

    setNewTitle('');
    setNewDesc('');
    setCustomFields([]);
    setIsCreating(false);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-8 rounded-3xl border border-border/50 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <ClipboardList className="w-32 h-32" />
        </div>
        <div className="space-y-2 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-2xl text-primary">
              <Settings2 className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-black tracking-tight">Modelos de Tarefas</h1>
          </div>
          <p className="text-muted-foreground font-medium">
            Padronize tarefas frequentes e crie campos personalizados diretamente na descrição.
          </p>
        </div>
        <Button 
          onClick={() => setIsCreating(true)} 
          className="rounded-2xl h-12 px-6 font-bold gap-2 shadow-lg shadow-primary/20 relative z-10"
        >
          <Plus className="w-5 h-5" /> Novo Modelo
        </Button>
      </div>

      {/* Creation Modal / Inline Card */}
      {isCreating && (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="border-2 border-primary/40 shadow-2xl overflow-hidden rounded-3xl bg-card">
            <CardHeader className="bg-primary/5 pb-4 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold tracking-tight">Criar Novo Modelo</CardTitle>
                  <CardDescription>Configure o padrão e crie seus próprios campos personalizados para a descrição.</CardDescription>
                </div>
                <Badge variant="outline" className="border-primary/30 text-primary uppercase text-[10px] font-black tracking-wider">
                  Personalização
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Título do Modelo</Label>
                  <Input 
                    placeholder="Ex: Reunião de Alinhamento Semanal" 
                    value={newTitle} 
                    onChange={e => setNewTitle(e.target.value)}
                    className="rounded-xl h-11 font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Quadrante Matriz</Label>
                    <Select value={newQuadrant} onValueChange={(val: any) => setNewQuadrant(val)}>
                      <SelectTrigger className="rounded-xl h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="urgent-important">Fazer Agora (Urgente & Importante)</SelectItem>
                        <SelectItem value="important-not-urgent">Agendar (Importante & Não Urgente)</SelectItem>
                        <SelectItem value="urgent-not-important">Delegar (Urgente & Não Importante)</SelectItem>
                        <SelectItem value="not-urgent-not-important">Eliminar (Não Urgente / Não Importante)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pilar / Módulo</Label>
                    <Select value={newModuleId} onValueChange={setNewModuleId}>
                      <SelectTrigger className="rounded-xl h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MODULES.map(m => (
                          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Description with Custom Field Integration */}
              <div className="space-y-3 p-5 rounded-2xl bg-muted/20 border border-border/60">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <Label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <Type className="w-4 h-4 text-primary" />
                      Descrição do Modelo & Campos Personalizados
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Você pode escrever instruções e inserir tags como <span className="font-mono text-primary font-bold">{"{{NomeDoCampo}}"}</span> que serão preenchidas ao usar o modelo.
                    </p>
                  </div>
                </div>

                {/* Quick Add Custom Field inside Description */}
                <div className="flex flex-wrap items-center gap-2 p-3 bg-background rounded-xl border">
                  <span className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-primary" /> Novo Campo:
                  </span>
                  <Input 
                    placeholder="Nome do seu campo (ex: Cliente, Valor, Link)..."
                    value={quickFieldName}
                    onChange={e => setQuickFieldName(e.target.value)}
                    className="h-8 text-xs max-w-xs rounded-lg"
                    onKeyDown={e => {
                      if (e.key === 'Enter' && quickFieldName.trim()) {
                        e.preventDefault();
                        addCustomField(quickFieldName, quickFieldType);
                      }
                    }}
                  />
                  <Select value={quickFieldType} onValueChange={(val: any) => setQuickFieldType(val)}>
                    <SelectTrigger className="h-8 w-32 text-xs rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Texto</SelectItem>
                      <SelectItem value="number">Número</SelectItem>
                      <SelectItem value="date">Data</SelectItem>
                      <SelectItem value="select">Seleção</SelectItem>
                      <SelectItem value="checkbox">Sim / Não</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    type="button" 
                    size="sm" 
                    onClick={() => addCustomField(quickFieldName, quickFieldType)}
                    className="h-8 text-xs font-bold rounded-lg gap-1.5"
                    disabled={!quickFieldName.trim()}
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar e Inserir na Descrição
                  </Button>
                </div>

                {/* Available Custom Field Chips to Insert */}
                {customFields.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] font-semibold text-muted-foreground">Clique para inserir na descrição:</span>
                    {customFields.map(f => (
                      <Button
                        key={f.id}
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => insertFieldIntoDescription(f.label)}
                        className="h-7 text-xs font-medium rounded-lg gap-1 border hover:border-primary/40 hover:bg-primary/5 transition-colors"
                      >
                        <Plus className="w-3 h-3 text-primary" />
                        <span className="font-mono text-[11px]">{"{{" + f.label + "}}"}</span>
                      </Button>
                    ))}
                  </div>
                )}

                {/* Textarea for Description */}
                <Textarea 
                  placeholder="Escreva a descrição padrão da tarefa. Use as variáveis acima para onde os campos dinâmicos devem aparecer..."
                  value={newDesc} 
                  onChange={e => setNewDesc(e.target.value)}
                  className="min-h-[110px] rounded-xl font-sans text-sm resize-y"
                />
              </div>

              {/* Detailed Custom Fields Manager */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <ListFilter className="w-4 h-4 text-primary" />
                    Gerenciar Campos Personalizados ({customFields.length})
                  </Label>
                  <Button 
                    type="button"
                    variant="outline" 
                    size="sm" 
                    onClick={() => addCustomField()}
                    className="h-7 text-xs font-bold gap-1 rounded-lg"
                  >
                    <Plus className="w-3 h-3" /> Adicionar Campo
                  </Button>
                </div>

                {customFields.map((field) => {
                  const Icon = FIELD_TYPE_ICONS[field.type || 'text'] || Type;
                  return (
                    <div key={field.id} className="p-3 bg-muted/20 border rounded-2xl space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                        <div className="sm:col-span-4 space-y-1">
                          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nome do Campo</Label>
                          <div className="relative">
                            <Icon className="w-4 h-4 text-muted-foreground absolute left-2.5 top-2.5" />
                            <Input 
                              placeholder="Nome do Campo" 
                              value={field.label}
                              onChange={(e) => updateCustomField(field.id, { label: e.target.value })}
                              className="h-9 text-xs pl-8 rounded-lg"
                            />
                          </div>
                        </div>

                        <div className="sm:col-span-3 space-y-1">
                          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tipo</Label>
                          <Select 
                            value={field.type || 'text'} 
                            onValueChange={(val: any) => updateCustomField(field.id, { type: val })}
                          >
                            <SelectTrigger className="h-9 text-xs rounded-lg">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text">Texto Curto</SelectItem>
                              <SelectItem value="number">Número / Valor</SelectItem>
                              <SelectItem value="date">Data</SelectItem>
                              <SelectItem value="select">Lista de Seleção</SelectItem>
                              <SelectItem value="checkbox">Sim / Não (Checkbox)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="sm:col-span-4 space-y-1">
                          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Dica / Placeholder</Label>
                          <Input 
                            placeholder={field.type === 'select' ? 'Opção 1, Opção 2, Opção 3' : 'Dica para preenchimento...'} 
                            value={field.placeholder || ''}
                            onChange={(e) => updateCustomField(field.id, { placeholder: e.target.value })}
                            className="h-9 text-xs rounded-lg"
                          />
                        </div>

                        <div className="sm:col-span-1 flex justify-end pt-5">
                          <Button 
                            type="button"
                            variant="ghost" 
                            size="icon" 
                            onClick={() => removeCustomField(field.id)}
                            className="h-9 w-9 text-destructive hover:bg-destructive/10 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {customFields.length === 0 && (
                  <p className="text-xs text-muted-foreground italic p-4 text-center border border-dashed rounded-xl">
                    Nenhum campo personalizado adicionado ainda. Crie campos acima para enriquecer suas tarefas.
                  </p>
                )}
              </div>
            </CardContent>
            <CardFooter className="bg-muted/30 border-t p-4 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsCreating(false)} className="font-bold text-xs">
                Cancelar
              </Button>
              <Button onClick={handleCreate} className="font-bold text-xs px-8 shadow-md">
                Salvar Modelo
              </Button>
            </CardFooter>
          </Card>
        </motion.div>
      )}

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template) => (
          <motion.div 
            key={template.id}
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="group"
          >
            <Card className="rounded-3xl border-border/50 hover:border-primary/50 transition-all hover:shadow-xl hover:shadow-primary/5 h-full flex flex-col relative overflow-hidden bg-card">
              <div className={cn("absolute top-0 left-0 w-1.5 h-full", QUADRANT_LABELS[template.quadrant]?.color.split(' ')[0] || 'bg-primary')} />
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <Badge variant="outline" className="text-[10px] font-black uppercase tracking-wider border-primary/20 text-primary">
                    MODELO OHEL
                  </Badge>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg" onClick={() => onDeleteTemplate(template.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <CardTitle className="text-lg font-bold tracking-tight mt-2">{template.title}</CardTitle>
                {template.description && (
                  <CardDescription className="line-clamp-3 text-xs font-normal text-muted-foreground whitespace-pre-line mt-1">
                    {template.description}
                  </CardDescription>
                )}
                
                {template.customFields && template.customFields.length > 0 && (
                  <div className="mt-3 space-y-1.5 p-3 bg-muted/40 rounded-2xl border border-border/40">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      Campos Personalizados ({template.customFields.length}):
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {template.customFields.map(f => (
                        <span key={f.id} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-background border font-medium">
                          <Tag className="w-2.5 h-2.5 text-primary" />
                          {f.label}
                          {f.type && <span className="text-[9px] text-muted-foreground">({f.type})</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardHeader>

              <CardContent className="flex-1 pt-2">
                <div className="flex flex-wrap gap-2">
                  <span className={cn(
                    "text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border leading-none shadow-sm",
                    QUADRANT_LABELS[template.quadrant]?.color
                  )}>
                    {QUADRANT_LABELS[template.quadrant]?.title || template.quadrant}
                  </span>
                  <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider bg-muted/60 border-none">
                    {MODULES.find(m => m.id === template.moduleId)?.name || template.moduleId}
                  </Badge>
                </div>
              </CardContent>

              <CardFooter className="pt-0 pb-6 pr-6 justify-end">
                <Button 
                  onClick={() => onUseTemplate(template)}
                  className="rounded-2xl gap-2 font-bold uppercase text-[11px] tracking-wider h-10 hover:scale-105 active:scale-95 transition-all shadow-md shadow-primary/10"
                >
                  <Sparkles className="w-3.5 h-3.5 fill-current" /> Usar Modelo
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        ))}

        {templates.length === 0 && !isCreating && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-border/50 rounded-3xl bg-muted/5">
            <Settings2 className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
            <h3 className="text-xl font-bold tracking-tight">Nenhum modelo criado</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto mt-2">
              Os modelos ajudam você a criar tarefas padronizadas com campos personalizados em segundos.
            </p>
            <Button variant="outline" className="mt-6 rounded-xl uppercase text-xs font-bold tracking-wider" onClick={() => setIsCreating(true)}>
              Criar meu primeiro modelo
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
