import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { LibraryItem } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  BookOpen, 
  Search, 
  Plus, 
  Bookmark, 
  GraduationCap, 
  Globe,
  Trash2,
  ExternalLink,
  Loader2,
  X
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface LibraryModuleProps {
  userId: string;
}

export const LibraryModule: React.FC<LibraryModuleProps> = ({ userId }) => {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [localFilter, setLocalFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalType, setModalType] = useState<'COURSE' | 'EXTERNAL'>('COURSE');
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemAuthor, setNewItemAuthor] = useState('');
  const [newItemUrl, setNewItemUrl] = useState('');

  useEffect(() => {
    if (!userId) return;
    const q = query(
      collection(db, 'library_items'),
      where('userId', '==', userId),
      orderBy('status', 'asc')
    );
    return onSnapshot(q, (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as LibraryItem)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'library_items'));
  }, [userId]);

  const searchBooks = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchQuery)}&maxResults=5`);
      const data = await res.json();
      setSearchResults(data.items || []);
    } catch (error) {
      toast.error('Erro ao buscar livros');
    } finally {
      setIsSearching(false);
    }
  };

  const addItem = async (book: any) => {
    try {
      await addDoc(collection(db, 'library_items'), {
        userId,
        title: book.volumeInfo.title,
        author: book.volumeInfo.authors?.[0] || 'Desconhecido',
        coverUrl: book.volumeInfo.imageLinks?.thumbnail || '',
        category: 'BOOK',
        progress: 0,
        status: 'WANT_TO_READ',
        createdAt: serverTimestamp()
      });
      toast.success('Livro adicionado à sua biblioteca!');
      setSearchResults([]);
      setSearchQuery('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'library_items');
    }
  };

  const deleteItem = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'library_items', id));
      toast.success('Item removido com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `library_items/${id}`);
    }
  };

  const handleAddManual = async () => {
    if (!newItemTitle) return;
    try {
      await addDoc(collection(db, 'library_items'), {
        userId,
        title: newItemTitle,
        author: newItemAuthor || (modalType === 'COURSE' ? 'Instituição' : 'Web'),
        category: modalType,
        url: newItemUrl || '',
        progress: 0,
        status: 'WANT_TO_READ',
        createdAt: serverTimestamp()
      });
      toast.success(`${modalType === 'COURSE' ? 'Curso' : 'Conteúdo'} adicionado!`);
      setShowAddModal(false);
      setNewItemTitle('');
      setNewItemAuthor('');
      setNewItemUrl('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'library_items');
    }
  };

  const updateProgress = async (id: string, progress: number) => {
    try {
      await updateDoc(doc(db, 'library_items', id), {
        progress,
        status: progress === 100 ? 'COMPLETED' : 'READING'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `library_items/${id}`);
    }
  };

  const filteredItems = items.filter(item => 
    item.title.toLowerCase().includes(localFilter.toLowerCase()) || 
    item.author.toLowerCase().includes(localFilter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-glow-blue">Biblioteca & Conhecimento</h2>
            <p className="text-muted-foreground">Sua central de aprendizado, livros e cursos.</p>
          </div>
        </div>

        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Filtrar sua coleção..." 
            value={localFilter} 
            onChange={e => setLocalFilter(e.target.value)} 
            className="pl-10 bg-card/50"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-muted/20 border-none">
            <CardHeader>
              <CardTitle className="text-lg">Buscar Conhecimento</CardTitle>
              <CardDescription>Encontre livros via Google Books</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchBooks()}
                  placeholder="Título ou autor..." 
                  className="pl-10"
                />
              </div>
              <Button className="w-full" onClick={searchBooks} disabled={isSearching}>
                {isSearching ? 'Buscando...' : 'Pesquisar'}
              </Button>

              <div className="space-y-2 mt-4">
                {searchResults.map(book => (
                  <div key={book.id} className="p-2 border rounded-lg bg-card flex gap-3 group">
                    <img 
                      src={book.volumeInfo.imageLinks?.smallThumbnail} 
                      className="w-12 h-16 object-cover rounded" 
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">{book.volumeInfo.title}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{book.volumeInfo.authors?.[0]}</p>
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] mt-1" onClick={() => addItem(book)}>
                        <Plus className="w-3 h-3 mr-1" /> Adicionar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4">
            <Button 
              variant="outline" 
              className="h-24 flex-col gap-2 rounded-2xl border-dashed border-2 hover:border-primary/50 hover:bg-primary/5 transition-all"
              onClick={() => {
                setModalType('COURSE');
                setShowAddModal(true);
              }}
            >
              <GraduationCap className="w-6 h-6 text-primary" />
              <span className="text-xs font-bold uppercase tracking-widest">Adicionar Curso</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-24 flex-col gap-2 rounded-2xl border-dashed border-2 hover:border-primary/50 hover:bg-primary/5 transition-all"
              onClick={() => {
                setModalType('EXTERNAL');
                setShowAddModal(true);
              }}
            >
              <Globe className="w-6 h-6 text-primary" />
              <span className="text-xs font-bold uppercase tracking-widest">Conteúdo Externo</span>
            </Button>
          </div>
        </div>

        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {modalType === 'COURSE' ? <GraduationCap className="w-5 h-5 text-primary" /> : <Globe className="w-5 h-5 text-primary" />}
                {modalType === 'COURSE' ? 'Novo Curso' : 'Novo Conteúdo Externo'}
              </DialogTitle>
              <DialogDescription>
                Adicione detalhes para organizar seu aprendizado.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título</Label>
                <Input 
                  id="title" 
                  value={newItemTitle} 
                  onChange={e => setNewItemTitle(e.target.value)}
                  placeholder="Ex: React Masterclass" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="author">{modalType === 'COURSE' ? 'Instrutor/Instituição' : 'Fonte/Autor'}</Label>
                <Input 
                  id="author" 
                  value={newItemAuthor} 
                  onChange={e => setNewItemAuthor(e.target.value)}
                  placeholder="Ex: João Silva" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="url">URL (Opcional)</Label>
                <Input 
                  id="url" 
                  value={newItemUrl} 
                  onChange={e => setNewItemUrl(e.target.value)}
                  placeholder="https://..." 
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowAddModal(false)}>Cancelar</Button>
              <Button onClick={handleAddManual}>Salvar Item</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="lg:col-span-3">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredItems.map(item => (
              <Card key={item.id} className="overflow-hidden group hover:border-primary/50 transition-all">
                <div className="aspect-[3/4] relative overflow-hidden bg-muted">
                  {item.coverUrl ? (
                    <img src={item.coverUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <Bookmark className="w-12 h-12 opacity-20" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="w-full gap-2"
                      onClick={() => {
                        if (item.url) {
                          window.open(item.url, '_blank');
                        } else {
                          toast.info('Não há um link associado a este item.');
                        }
                      }}
                    >
                      <ExternalLink className="w-4 h-4" /> {item.category === 'BOOK' ? 'Detalhes' : 'Acessar'}
                    </Button>
                  </div>
                </div>
                <CardContent className="p-4 space-y-3">
                  <div>
                    <Badge variant="outline" className="text-[10px] mb-1">{item.category}</Badge>
                    <h4 className="font-bold truncate">{item.title}</h4>
                    <p className="text-xs text-muted-foreground truncate">{item.author}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold">
                      <span>Progresso</span>
                      <span>{item.progress}%</span>
                    </div>
                    <Progress value={item.progress} className="h-1.5" />
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <Select value={item.status} onValueChange={v => updateDoc(doc(db, 'library_items', item.id), { status: v })}>
                      <SelectTrigger className="h-7 text-[10px] w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="WANT_TO_READ">Quero Ler</SelectItem>
                        <SelectItem value="READING">Lendo</SelectItem>
                        <SelectItem value="COMPLETED">Concluído</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => deleteItem(item.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
