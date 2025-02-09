import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, MoreVertical, Trash2, Eye, Link2, Pencil, Menu, ChevronLeft, ChevronRight } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from 'leaflet'
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"

// Fix for default marker icons in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

const pinIcon = L.divIcon({
  html: '📍',
  className: 'pin-emoji-marker',
  iconSize: [32, 32],
  iconAnchor: [16, 28],
  popupAnchor: [0, -28]
});

interface Collection {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
}

interface Place {
  id: number;
  name: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  place_type: string | null;
  locationString?: string;
}

interface CollectionPlaceResponse {
  place_id: number;
  collection_id: string;
  place: Place;
}

interface CollectionsListProps {
  collections: Collection[];
  selectedCollections: Collection[];
  newCollectionName: string;
  setNewCollectionName: (name: string) => void;
  onToggleCollection: (collection: Collection) => void;
  onCreateCollection: () => void;
  onDeleteCollection: (id: string) => void;
  onRenameCollection: (collection: Collection) => void;
}

function CollectionsList({
  collections,
  selectedCollections,
  newCollectionName,
  setNewCollectionName,
  onToggleCollection,
  onCreateCollection,
  onDeleteCollection,
  onRenameCollection,
}: CollectionsListProps) {
  const { toast } = useToast()
  
  return (
    <Sidebar className="h-full bg-background border-r w-[280px]">
      <SidebarHeader className="px-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium">Collections</h2>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <div className="space-y-4 px-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full justify-start" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Collection
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Collection</DialogTitle>
              </DialogHeader>
              <div className="flex gap-2">
                <Input
                  placeholder="Collection name"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                />
                <Button onClick={onCreateCollection}>Create</Button>
              </div>
            </DialogContent>
          </Dialog>

          <div className="space-y-1">
            {collections.map((collection) => (
              <div key={collection.id}>
                <div className="flex items-center gap-2">
                  <Button
                    variant={selectedCollections.some(c => c.id === collection.id) ? "default" : "ghost"}
                    className="w-full justify-start h-8 px-2"
                    onClick={() => onToggleCollection(collection)}
                  >
                    <span className="truncate text-sm">{collection.name}</span>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          window.open(`/lists/${collection.id}`, '_blank');
                        }}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Open List
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onRenameCollection(collection)}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          const shareUrl = `${window.location.origin}/lists/${collection.id}`;
                          navigator.clipboard.writeText(shareUrl);
                          toast({
                            title: "Link Copied",
                            description: "Share link has been copied to clipboard",
                          });
                        }}
                      >
                        <Link2 className="mr-2 h-4 w-4" />
                        Copy Share Link
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onDeleteCollection(collection.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Collection
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
            {collections.length === 0 && (
              <p className="text-sm text-muted-foreground px-2">
                No collections yet. Create one to get started!
              </p>
            )}
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
  )
}

function PlacesPageContent() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [selectedCollections, setSelectedCollections] = useState<Collection[]>([])
  const [newCollectionName, setNewCollectionName] = useState("")
  const [places, setPlaces] = useState<Place[]>([])
  const { user } = useAuth()
  const { toast } = useToast()
  const [collectionToRename, setCollectionToRename] = useState<Collection | null>(null)
  const [newName, setNewName] = useState("")
  const [loading, setLoading] = useState(true)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [placeCollections, setPlaceCollections] = useState<Record<number, string[]>>({})

  useEffect(() => {
    if (user) {
      fetchCollections()
    }
  }, [user])

  useEffect(() => {
    if (user) {
      if (selectedCollections.length > 0) {
        fetchCollectionPlaces(selectedCollections.map(c => c.id))
      } else {
        fetchPlaces(user.id)
      }
    }
  }, [selectedCollections, user])

  const fetchCollections = async () => {
    if (!user) return
    
    try {
      const { data, error } = await supabase
        .from("collections")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (error) throw error
      setCollections(data || [])
    } catch (error) {
      console.error("Error fetching collections:", error)
      toast({
        title: "Error",
        description: "Failed to load collections",
        variant: "destructive",
      })
    }
  }

  const fetchPlaces = async (userId: string) => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("places")
        .select("*")
        .eq("user_id", userId)

      if (error) throw error

      if (data) {
        setPlaces(data.map(place => ({
          ...place,
          locationString: place.name || `${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}`
        })))
      }
    } catch (error) {
      console.error("Error fetching places:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCollectionPlaces = async (collectionIds: string[]) => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("collection_places")
        .select(`
          place_id,
          collection_id,
          place:places (
            id,
            name,
            address,
            latitude,
            longitude,
            place_type
          )
        `)
        .in("collection_id", collectionIds)

      if (error) throw error

      if (data) {
        const uniquePlaces = Array.from(
          new Map(data.map(item => {
            const place = item.place as unknown as Place;
            return [place.id, place];
          })).values()
        )
        setPlaces(uniquePlaces.map(place => ({
          ...place,
          locationString: place.name || `${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}`
        })))
      }
    } catch (error) {
      console.error("Error fetching collection places:", error)
    } finally {
      setLoading(false)
    }
  }

  const createCollection = async () => {
    if (!user || !newCollectionName.trim()) return

    try {
      const { data, error } = await supabase
        .from("collections")
        .insert([
          {
            name: newCollectionName.trim(),
            user_id: user.id,
          },
        ])
        .select()
        .single()

      if (error) throw error

      setCollections([data, ...collections])
      setNewCollectionName("")
      toast({
        title: "Success",
        description: "Collection created successfully",
      })
    } catch (error) {
      console.error("Error creating collection:", error)
      toast({
        title: "Error",
        description: "Failed to create collection",
        variant: "destructive",
      })
    }
  }

  const toggleCollection = (collection: Collection) => {
    setSelectedCollections(prev => {
      const isSelected = prev.some(c => c.id === collection.id);
      if (isSelected) {
        return prev.filter(c => c.id !== collection.id);
      } else {
        return [...prev, collection];
      }
    });
  };

  const deleteCollection = async (collectionId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("collections")
        .delete()
        .eq("id", collectionId)

      if (error) throw error;

      setCollections(collections.filter(c => c.id !== collectionId));
      setSelectedCollections(selected => selected.filter(c => c.id !== collectionId));

      toast({
        title: "Success",
        description: "Collection deleted successfully",
      })
    } catch (error) {
      console.error("Error deleting collection:", error)
      toast({
        title: "Error",
        description: "Failed to delete collection",
        variant: "destructive",
      })
    }
  }

  const renameCollection = async () => {
    if (!collectionToRename || !newName.trim()) return;

    try {
      const { error } = await supabase
        .from("collections")
        .update({ name: newName.trim() })
        .eq("id", collectionToRename.id);

      if (error) throw error;

      setCollections(collections.map(c => 
        c.id === collectionToRename.id 
          ? { ...c, name: newName.trim() } 
          : c
      ));

      setCollectionToRename(null);
      setNewName("");
      
      toast({
        title: "Success",
        description: "Collection renamed successfully",
      });
    } catch (error) {
      console.error("Error renaming collection:", error);
      toast({
        title: "Error",
        description: "Failed to rename collection",
        variant: "destructive",
      });
    }
  };

  const addToCollection = async (placeId: number, collectionId: string) => {
    try {
      const { error } = await supabase
        .from("collection_places")
        .insert({
          collection_id: collectionId,
          place_id: placeId
        });

      if (error) throw error;

      setPlaceCollections(prev => ({
        ...prev,
        [placeId]: [...(prev[placeId] || []), collectionId]
      }));

      toast({
        title: "Success",
        description: "Added to collection",
      });
    } catch (error) {
      console.error('Error adding to collection:', error);
      toast({
        title: "Error",
        description: "Failed to add to collection",
        variant: "destructive",
      });
    }
  };

  const removeFromCollection = async (placeId: number, collectionId: string) => {
    try {
      const { error } = await supabase
        .from("collection_places")
        .delete()
        .match({ collection_id: collectionId, place_id: placeId });

      if (error) throw error;

      setPlaceCollections(prev => ({
        ...prev,
        [placeId]: prev[placeId]?.filter(id => id !== collectionId) || []
      }));

      toast({
        title: "Success",
        description: "Removed from collection",
      });
    } catch (error) {
      console.error('Error removing from collection:', error);
      toast({
        title: "Error",
        description: "Failed to remove from collection",
        variant: "destructive",
      });
    }
  };

  // Add this effect to fetch initial place collections
  useEffect(() => {
    const fetchPlaceCollections = async () => {
      if (!places.length) return;
      
      try {
        const { data, error } = await supabase
          .from("collection_places")
          .select("place_id, collection_id")
          .in("place_id", places.map(p => p.id));

        if (error) throw error;

        const collectionsMap: Record<number, string[]> = {};
        data.forEach(({ place_id, collection_id }) => {
          if (!collectionsMap[place_id]) {
            collectionsMap[place_id] = [];
          }
          collectionsMap[place_id].push(collection_id);
        });

        setPlaceCollections(collectionsMap);
      } catch (error) {
        console.error('Error fetching place collections:', error);
      }
    };

    fetchPlaceCollections();
  }, [places]);

  const renderMap = () => {
    if (!places || places.length === 0) return null;

    const positions = places.map(place => [place.latitude, place.longitude] as [number, number]);
    const bounds = L.latLngBounds(positions);

  return (
      <div className="h-[500px] w-full border rounded-lg overflow-hidden">
        <MapContainer
          bounds={bounds}
          className="h-full w-full"
          zoomControl={true}
          dragging={true}
          scrollWheelZoom={true}
          doubleClickZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {places.map((place, index) => (
            <Marker 
              key={index} 
              position={[place.latitude, place.longitude]}
              icon={pinIcon}
            >
              <Popup>
                <div className="p-1">
                  <p className="font-medium">{place.locationString || 'Unnamed Location'}</p>
                  {place.address && (
                    <p className="text-sm text-muted-foreground mt-1">{place.address}</p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      <div className="flex h-[calc(100vh-64px)] mt-16">
        <div className={`flex ${isSidebarOpen ? 'w-[280px]' : 'w-[32px]'} border-r bg-background transition-all duration-300 relative`}>
          <div className={`${isSidebarOpen ? 'opacity-100 w-[280px]' : 'opacity-0 w-0'} overflow-hidden transition-all duration-300`}>
            <div className="w-[280px]">
              <div className="px-4 py-2">
                <h2 className="text-sm font-medium">Collections</h2>
              </div>
              <div className="space-y-4 px-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full justify-start" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      New Collection
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Collection</DialogTitle>
                    </DialogHeader>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Collection name"
                        value={newCollectionName}
                        onChange={(e) => setNewCollectionName(e.target.value)}
                      />
                      <Button onClick={createCollection}>Create</Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <div className="space-y-1">
                  {collections.map((collection) => (
                    <div key={collection.id}>
                      <div className="flex items-center gap-2">
                        <Button
                          variant={selectedCollections.some(c => c.id === collection.id) ? "default" : "ghost"}
                          className="w-full justify-start h-8 px-2"
                          onClick={() => toggleCollection(collection)}
                        >
                          <span className="truncate text-sm">{collection.name}</span>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                window.open(`/lists/${collection.id}`, '_blank');
                              }}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              Open List
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setCollectionToRename(collection);
                                setNewName(collection.name);
                              }}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                const shareUrl = `${window.location.origin}/lists/${collection.id}`;
                                navigator.clipboard.writeText(shareUrl);
                                toast({
                                  title: "Link Copied",
                                  description: "Share link has been copied to clipboard",
                                });
                              }}
                            >
                              <Link2 className="mr-2 h-4 w-4" />
                              Copy Share Link
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => deleteCollection(collection.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Collection
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                  {collections.length === 0 && (
                    <p className="text-sm text-muted-foreground px-2">
                      No collections yet. Create one to get started!
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="absolute -right-3 top-3 h-6 w-6 rounded-full border bg-background shadow-sm"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>

        <div className="flex-1 pl-8">
          <div className="container mx-auto p-4">
            <div className="mb-4">
              <h1 className="text-2xl font-bold">
                {selectedCollections.length > 0 
                  ? selectedCollections.map(c => c.name).join(", ")
                  : "All Saved Locations"}
              </h1>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary" className="text-sm">
                  {places.length} {places.length === 1 ? 'place' : 'places'}
                </Badge>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-[60vh]">
                <p className="text-lg">Loading places...</p>
              </div>
            ) : (
              <>
                {renderMap()}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
                  {places.map((place) => (
                    <Card key={place.id} className="relative group">
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <Badge variant="secondary" className="w-fit text-xs">
                              {place.place_type || 'Destination'}
                            </Badge>
                            <CardTitle className="line-clamp-2 mt-2">
                              {place.locationString || place.name || 'Loading location...'}
                            </CardTitle>
                          </div>
                          <div className="flex gap-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className={placeCollections[place.id]?.length ? "text-primary" : ""}
                                >
                                  <Plus className="h-4 w-4" />
                                  {placeCollections[place.id]?.length > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full w-4 h-4 text-xs flex items-center justify-center">
                                      {placeCollections[place.id].length}
                                    </span>
                                  )}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent 
                                className="w-56" 
                                align="end"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <DropdownMenuLabel>Add to Collection</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {collections.map((collection) => (
                                  <DropdownMenuCheckboxItem
                                    key={collection.id}
                                    checked={placeCollections[place.id]?.includes(collection.id)}
                                    onSelect={(e) => e.preventDefault()}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        addToCollection(place.id, collection.id)
                                      } else {
                                        removeFromCollection(place.id, collection.id)
                                      }
                                    }}
                                    className="flex items-center gap-2"
                                  >
                                    <span className="flex-1">{collection.name}</span>
                                    {placeCollections[place.id]?.includes(collection.id) && (
                                      <Badge variant="secondary" className="ml-2 text-xs">Added</Badge>
                                    )}
                                  </DropdownMenuCheckboxItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={async () => {
                                try {
                                  const { error } = await supabase
                                    .from("places")
                                    .delete()
                                    .eq("id", place.id);

                                  if (error) throw error;

                                  setPlaces(places.filter(p => p.id !== place.id));
                                  toast({
                                    title: "Success",
                                    description: "Place deleted successfully",
                                  });
                                } catch (error) {
                                  console.error('Error deleting place:', error);
                                  toast({
                                    title: "Error",
                                    description: "Failed to delete place",
                                    variant: "destructive",
                                  });
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {place.address && (
                          <p className="text-sm text-muted-foreground mb-2">
                            {place.address}
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground">
                          Coordinates: {place.latitude}, {place.longitude}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <Dialog open={!!collectionToRename} onOpenChange={() => setCollectionToRename(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename Collection</DialogTitle>
            </DialogHeader>
            <div className="flex gap-2">
              <Input
                placeholder="Collection name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Button onClick={renameCollection}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

export default function PlacesPage() {
  return (
    <SidebarProvider>
      <PlacesPageContent />
    </SidebarProvider>
  )
}