import React from 'react';
import { Module } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  User, 
  DollarSign, 
  Users, 
  Briefcase, 
  Heart,
  Settings2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModuleManagementProps {
  modules: Module[];
  onToggleModule: (id: string) => void;
}

const ICON_MAP: Record<string, any> = {
  User,
  DollarSign,
  Users,
  Briefcase,
  Heart
};

export const ModuleManagement: React.FC<ModuleManagementProps> = ({ modules, onToggleModule }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {modules.map((module) => {
        const Icon = ICON_MAP[module.icon] || Settings2;
        
        return (
          <Card key={module.id} className={cn(
            "transition-all duration-300",
            !module.active && "opacity-60 grayscale"
          )}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/10",
                  module.color
                )}>
                  <Icon className="w-5 h-5" />
                </div>
                <Switch 
                  checked={module.active} 
                  onCheckedChange={() => onToggleModule(module.id)} 
                />
              </div>
              <CardTitle className="mt-4">{module.name}</CardTitle>
              <CardDescription>
                Gerencie suas tarefas de contexto {module.name.toLowerCase()}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                {module.active ? 'Módulo ativo e visível na matriz.' : 'Módulo desativado.'}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
