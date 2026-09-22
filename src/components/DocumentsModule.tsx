import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, FileUp, Camera, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';

interface DocumentsModuleProps {
  userId: string;
}

export const DocumentsModule: React.FC<DocumentsModuleProps> = ({ userId }) => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const q = query(
      collection(db, 'personal_documents'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setDocuments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'personal_documents'));

    return () => unsub();
  }, [userId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1 * 1024 * 1024) { // Firestore limit check roughly
      toast.error('O arquivo é muito grande (Máximo 1MB).');
      return;
    }

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        await addDoc(collection(db, 'personal_documents'), {
          userId,
          name: file.name,
          url: base64,
          type: file.type,
          createdAt: serverTimestamp()
        });
        toast.success('Documento digitalizado com sucesso!');
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao subir documento');
      setUploading(false);
    }
  };

  const handleDeleteDoc = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'personal_documents', id));
      toast.success('Documento removido!');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `personal_documents/${id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500 border border-blue-500/20">
          <FileText className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-3xl font-black italic tracking-tighter uppercase text-primary leading-none">Documentos da Casa</h2>
          <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground opacity-70">Arquivo Digital Familiar</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 rounded-[2rem] border-2 border-blue-500/10 bg-blue-500/5">
          <CardHeader>
            <CardTitle className="text-xl font-bold uppercase tracking-tight flex items-center gap-2">
              <Camera className="w-5 h-5 text-blue-500" />
              Digitalizar
            </CardTitle>
            <CardDescription className="text-xs uppercase font-bold tracking-widest opacity-60">Integração CamScanner</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-8 border-2 border-dashed border-blue-500/20 rounded-2xl flex flex-col items-center justify-center text-center space-y-4 bg-background/50 group relative">
              <input 
                id="doc-upload" 
                type="file" 
                className="hidden" 
                onChange={handleFileUpload} 
                accept=".pdf,.jpg,.jpeg,.png"
              />
              <FileUp className="w-10 h-10 text-muted-foreground transition-transform group-hover:-translate-y-1" />
              <div>
                <p className="font-bold text-sm uppercase tracking-tight">Arraste ou clique para enviar</p>
                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest opacity-60">PDF, JPG ou PNG (Max 1MB)</p>
              </div>
              <Button asChild className="rounded-xl font-black uppercase tracking-widest text-[10px] h-10 px-6 cursor-pointer">
                <label htmlFor="doc-upload">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Selecionar Arquivo
                </label>
              </Button>
            </div>
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <p className="text-[10px] text-amber-700 font-bold uppercase tracking-tight leading-snug">
                DICA: Use o CamScanner para digitalizações profissionais e anexe o arquivo aqui para manter a organização.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 rounded-[2rem] border-2 border-muted overflow-hidden">
          <CardHeader className="border-b bg-muted/5">
            <CardTitle className="text-xl font-bold uppercase tracking-tight">Meus Documentos</CardTitle>
            <CardDescription className="text-xs uppercase font-bold tracking-widest opacity-60">Acesso rápido aos arquivos importantes</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {documents.map(doc => (
                <div key={doc.id} className="p-4 border rounded-2xl flex items-center justify-between hover:bg-muted/10 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-black uppercase tracking-tight text-sm truncate max-w-[200px]">{doc.name}</p>
                      <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-60">
                        {doc.createdAt?.seconds ? new Date(doc.createdAt.seconds * 1000).toLocaleDateString() : 'Recentemente'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="font-black uppercase tracking-widest text-[9px]"
                      onClick={() => window.open(doc.url, '_blank')}
                    >
                      Ver Arquivo
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDeleteDoc(doc.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              
              {documents.length === 0 && (
                <div className="py-12 text-center opacity-30 border-2 border-dashed rounded-3xl mt-4">
                  <p className="text-[10px] font-black uppercase tracking-widest">Nenhum documento digitalizado ainda.</p>
                </div>
              )}

              {documents.length > 0 && (
                <div className="py-4 text-center opacity-30">
                  <p className="text-[11px] font-black uppercase tracking-widest">Fim dos documentos recentes</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
