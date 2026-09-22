import React, { useState, useEffect, useCallback } from 'react';
import { LogisticsAddress, User, OperationType } from '@/types';
import { db, handleFirestoreError } from '@/lib/firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer, Autocomplete } from '@react-google-maps/api';
import { 
  MapPin, 
  Home, 
  Briefcase, 
  Truck, 
  Plus, 
  Search, 
  Navigation,
  Clock,
  Trash2,
  Loader2,
  ArrowRightLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface LogisticsViewProps {
  user: User;
}

const mapContainerStyle = {
  width: '100%',
  height: '100%'
};

const center = {
  lat: -23.5505,
  lng: -46.6333
};

const libraries: ("places")[] = ["places"];

export const LogisticsView: React.FC<LogisticsViewProps> = ({ user }) => {
  const [addresses, setAddresses] = useState<LogisticsAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newType, setNewType] = useState<LogisticsAddress['type']>('OTHER');
  
  // Maps State
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [duration, setDuration] = useState('--');
  const [distance, setDistance] = useState('--');
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

  const [originId, setOriginId] = useState<string | null>(null);
  const [destId, setDestId] = useState<string | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries
  });

  // Automatically set origin/dest if they change
  useEffect(() => {
    if (addresses.length >= 2) {
      if (!originId) setOriginId(addresses[0].id);
      if (!destId) setDestId(addresses[1].id);
    }
  }, [addresses]);

  const onAutocompleteLoad = (autocompleteInstance: google.maps.places.Autocomplete) => {
    setAutocomplete(autocompleteInstance);
  };

  const onPlaceChanged = () => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace();
      if (place.formatted_address) {
        setNewAddress(place.formatted_address);
      }
    }
  };

  useEffect(() => {
    if (loadError) {
      console.error('Erro ao carregar Google Maps:', loadError);
    }
  }, [loadError]);

  useEffect(() => {
    const q = query(collection(db, 'logistics_addresses'), where('userId', '==', user.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAddresses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LogisticsAddress)));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'logistics_addresses'));

    return () => unsubscribe();
  }, [user.id]);

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel || !newAddress) return;
    try {
      const docRef = await addDoc(collection(db, 'logistics_addresses'), {
        userId: user.id,
        label: newLabel,
        address: newAddress,
        type: newType,
        createdAt: serverTimestamp()
      });
      
      // Attempt geocoding
      if (isLoaded && window.google) {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: newAddress }, async (results, status) => {
          if (status === 'OK' && results?.[0]) {
            const loc = results[0].geometry.location;
            try {
              const userDocRef = doc(db, 'logistics_addresses', docRef.id);
              await updateDoc(userDocRef, {
                lat: loc.lat(),
                lng: loc.lng()
              });
              toast.success('Localização confirmada no mapa!');
            } catch (err) {
              console.error('Failed to update coords:', err);
            }
          } else {
            console.warn('Geocoding failed for address:', newAddress, status);
            toast.error('Não foi possível encontrar o endereço no mapa. Digite novamente.');
          }
        });
      }

      setNewLabel('');
      setNewAddress('');
      toast.success('Endereço adicionado!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'logistics_addresses');
    }
  };

  const handleDeleteAddress = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'logistics_addresses', id));
      toast.success('Endereço removido');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `logistics_addresses/${id}`);
    }
  };

  const calculateRoute = async () => {
    const origin = addresses.find(a => a.id === originId);
    const destination = addresses.find(a => a.id === destId);

    if (!origin || !destination) {
      toast.error('Selecione os pontos de origem e destino nos endereços salvos.');
      return;
    }

    if (origin.id === destination.id) {
      toast.error('Origem e destino devem ser diferentes.');
      return;
    }

    if (!isLoaded || !window.google) return;

    try {
      const directionsService = new google.maps.DirectionsService();
      const results = await directionsService.route({
        origin: origin.address,
        destination: destination.address,
        travelMode: google.maps.TravelMode.DRIVING
      });

      setDirections(results);
      if (results.routes[0]?.legs[0]) {
        setDuration(results.routes[0].legs[0].duration?.text || '--');
        setDistance(results.routes[0].legs[0].distance?.text || '--');
        
        if (map && results.routes[0].bounds) {
          map.fitBounds(results.routes[0].bounds);
        }
        
        toast.success('Rota calculada!');
      }
    } catch (error) {
      console.error('Erro ao calcular rota:', error);
      toast.error('Não foi possível calcular a rota. Verifique os endereços.');
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'HOME': return <Home className="w-4 h-4" />;
      case 'WORK': return <Briefcase className="w-4 h-4" />;
      case 'DELIVERY': return <Truck className="w-4 h-4" />;
      default: return <MapPin className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full flex flex-col px-1">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Logística e Trajetos</h2>
          <p className="text-sm text-muted-foreground">Gerencie seus endereços e otimize seus deslocamentos diários.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        <div className="lg:col-span-4 space-y-4">
          <Card className="p-4 bg-card/50 backdrop-blur-sm border-border/50">
            <h3 className="font-bold text-sm mb-4">Adicionar Novo Local</h3>
            <form onSubmit={handleAddAddress} className="space-y-3">
              <Input placeholder="Título (Ex: Escritório)" value={newLabel} onChange={e => setNewLabel(e.target.value)} required />
              
              {isLoaded ? (
                <Autocomplete onLoad={onAutocompleteLoad} onPlaceChanged={onPlaceChanged}>
                  <Input 
                    placeholder="Endereço Completo" 
                    value={newAddress} 
                    onChange={e => setNewAddress(e.target.value)} 
                    required 
                  />
                </Autocomplete>
              ) : (
                <Input placeholder="Endereço Completo" value={newAddress} onChange={e => setNewAddress(e.target.value)} required />
              )}

              <div className="flex gap-2">
                {(['HOME', 'WORK', 'DELIVERY', 'OTHER'] as const).map(type => (
                  <Button 
                    key={type}
                    type="button" 
                    variant={newType === type ? 'default' : 'outline'} 
                    size="icon"
                    className="flex-1 h-9"
                    onClick={() => setNewType(type)}
                  >
                    {getIcon(type)}
                  </Button>
                ))}
              </div>
              <Button type="submit" className="w-full gap-2 mt-2">
                <Plus className="w-4 h-4" /> Salvar Local
              </Button>
            </form>
          </Card>

          <div className="space-y-3 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
            {addresses.map(addr => (
              <Card key={addr.id} className="p-4 border-border/50 hover:border-primary/50 transition-all group relative">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary shrink-0">
                    {getIcon(addr.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm">{addr.label}</h3>
                    <p className="text-[10px] text-muted-foreground line-clamp-1">{addr.address}</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDeleteAddress(addr.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
            {addresses.length === 0 && (
              <div className="py-8 text-center border border-dashed rounded-xl text-muted-foreground text-xs">
                Nenhum endereço salvo.
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-8 bg-card rounded-2xl border border-border/50 overflow-hidden relative min-h-[400px]">
          {loadError ? (
            <div className="absolute inset-0 bg-destructive/5 flex flex-col items-center justify-center text-center p-6">
              <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center text-destructive mb-4">
                <Navigation className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-destructive mb-2">Erro de Configuração do Mapa</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                A API do Google Maps retornou um erro. Certifique-se de que a <strong>Maps JavaScript API</strong> esteja ativada no seu console Google Cloud e que a chave de API esteja correta.
              </p>
            </div>
          ) : isLoaded ? (
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={center}
              zoom={12}
              onLoad={map => setMap(map)}
            >
              {directions && <DirectionsRenderer directions={directions} />}
              {!directions && addresses.map(addr => addr.lat && addr.lng && (
                <Marker key={addr.id} position={{ lat: addr.lat, lng: addr.lng }} label={addr.label} />
              ))}
            </GoogleMap>
          ) : (
            <div className="absolute inset-0 bg-muted/30 flex flex-col items-center justify-center text-muted-foreground">
              <Loader2 className="w-12 h-12 mb-4 animate-spin opacity-20" />
              <p className="text-sm font-medium">Carregando Google Maps...</p>
            </div>
          )}

          <div className="absolute top-4 left-4 right-4 flex flex-col md:flex-row gap-2">
            <div className="flex bg-background/90 backdrop-blur p-1 rounded-xl shadow-lg border border-border/50 flex-1">
              <Select value={originId || ''} onValueChange={setOriginId}>
                <SelectTrigger className="border-none shadow-none h-9 text-xs flex-1">
                  <SelectValue placeholder="Origem" />
                </SelectTrigger>
                <SelectContent>
                  {addresses.map(a => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="w-px bg-border my-1" />
              <div className="flex items-center px-1">
                <ArrowRightLeft className="w-3 h-3 text-muted-foreground" />
              </div>
              <div className="w-px bg-border my-1" />
              <Select value={destId || ''} onValueChange={setDestId}>
                <SelectTrigger className="border-none shadow-none h-9 text-xs flex-1">
                  <SelectValue placeholder="Destino" />
                </SelectTrigger>
                <SelectContent>
                  {addresses.map(a => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button className="shadow-lg gap-2 bg-primary/90 backdrop-blur" onClick={calculateRoute}>
              <Navigation className="w-4 h-4" /> Traçar Rota
            </Button>
          </div>

          <div className="absolute bottom-4 left-4 right-4 grid grid-cols-2 gap-4">
            <Card className="p-4 bg-background/80 backdrop-blur-sm border-border/50 shadow-lg flex items-center gap-3">
              <Clock className="w-5 h-5 text-primary" />
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Tempo Estimado</p>
                <p className="text-lg font-black">{duration}</p>
              </div>
            </Card>
            <Card className="p-4 bg-background/80 backdrop-blur-sm border-border/50 shadow-lg flex items-center gap-3">
              <Navigation className="w-5 h-5 text-primary" />
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Distância Total</p>
                <p className="text-lg font-black">{distance}</p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
