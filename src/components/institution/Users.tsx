import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Institution } from '@/types';

interface InstitutionUsersProps {
  users: User[];
  institution?: Institution;
  isPersonal?: boolean;
}

export const InstitutionUsers: React.FC<InstitutionUsersProps> = ({ users, isPersonal }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black uppercase tracking-tighter italic">
          {isPersonal ? 'Pessoas Conectadas' : 'Membros da Equipe'}
        </h2>
        <Badge variant="outline" className="font-bold uppercase tracking-widest text-[10px]">
          {users.length} {isPersonal ? 'Conectados' : 'Colaboradores'}
        </Badge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map(user => (
          <Card key={user.id} className="overflow-hidden hover:shadow-lg transition-all group border-muted-foreground/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary border border-primary/20">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    user.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{user.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate uppercase tracking-widest">{user.role}</p>
                </div>
                <Badge variant={user.status === 'online' ? 'default' : 'outline'} className="text-[9px]">
                  {user.status === 'online' ? 'Online' : 'Trabalho Offline'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
