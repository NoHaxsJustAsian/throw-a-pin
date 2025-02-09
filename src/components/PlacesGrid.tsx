"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { supabase, Place } from "@/lib/supabase"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { MoreVertical } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { getLocationDetails } from "@/lib/utils"
import { Plus } from "lucide-react"
import { cn } from "@/lib/utils"

interface PlacesGridProps {
  selectedCollections: Collection[];
  onAddToCollection: () => void;
  collections: Collection[];
}

export default function PlacesGrid({ 
  selectedCollections, 
  onAddToCollection,
  collections 
}: PlacesGridProps) {
  const [places, setPlaces] = useState<(Place & { locationString?: string })[]>([])
  const [collectionPlaces, setCollectionPlaces] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<null | { id: string }>(null)
  const { toast } = useToast()
  const [placeCollections, setPlaceCollections] = useState<Record<number, string[]>>({})

  useEffect(() => {
    // Get current user
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser(user)
        if (selectedCollections.length > 0) {
          fetchCollectionPlaces(selectedCollections.map(c => c.id))
        } else {
          fetchPlaces(user.id)
        }
      }
    })
  }, [selectedCollections])

  useEffect(() => {
    if (places.length > 0) {
      // Fetch collections for all places at once
      const fetchAllPlaceCollections = async () => {
        try {
          const { data, error } = await supabase
            .from("collection_places")
            .select("place_id, collection_id")
            .in("place_id", places.map(p => p.id))

          if (error) throw error

          if (data) {
            // Group by place_id
            const collectionsMap = data.reduce((acc, item) => {
              if (!acc[item.place_id]) {
                acc[item.place_id] = [];
              }
              acc[item.place_id].push(item.collection_id);
              return acc;
            }, {} as Record<number, string[]>);

            setPlaceCollections(collectionsMap);
          }
        } catch (error) {
          console.error("Error fetching place collections:", error)
        }
      }

      fetchAllPlaceCollections();
    }
  }, [places]);

  async function fetchPlaces(userId: string) {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("places")
        .select("*")
        .eq("user_id", userId);

      if (error) throw error;

      if (data) {
        // Set places immediately with existing data
        setPlaces(data.map(place => ({
          ...place,
          locationString: place.name || place.address || 'Loading location...'
        })));
        setLoading(false);

        // Only fetch location details for places without an address
        data.forEach(async (place, index) => {
          if (!place.name && !place.address) {
            const locationInfo = await getLocationDetails(place.latitude, place.longitude);
            
            // Update both locationString and address in the database
            if (locationInfo.address) {
              const { error: updateError } = await supabase
                .from("places")
                .update({ 
                  address: locationInfo.address,
                  name: locationInfo.locationString 
                })
                .eq("id", place.id);

              if (updateError) {
                console.error("Error updating place:", updateError);
              }
            }

            setPlaces(prev => {
              const updated = [...prev];
              updated[index] = { 
                ...updated[index], 
                locationString: locationInfo.locationString,
                address: locationInfo.address || updated[index].address
              };
              return updated;
            });
          }
        });
      }
    } catch (error) {
      console.error("Error fetching places:", error);
      setLoading(false);
    }
  }

  const fetchCollectionPlaces = async (collectionIds: string[]) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("collection_places")
        .select(`
          place_id,
          collection_id,
          place:places (*)
        `)
        .in("collection_id", collectionIds);

      if (error) throw error;

      if (data) {
        const uniquePlaces = Array.from(
          new Map(data.map(item => [item.place.id, item.place])).values()
        );
        const placeIds = data.map(item => item.place_id);

        // Set places immediately with loading state
        setPlaces(uniquePlaces.map(place => ({
          ...place,
          locationString: place.name || 'Loading location...'
        })));
        setCollectionPlaces(placeIds);
        setLoading(false);

        // Then fetch location details in background
        uniquePlaces.forEach(async (place, index) => {
          if (!place.name) {
            const locationString = await getLocationDetails(place.latitude, place.longitude);
            setPlaces(prev => {
              const updated = [...prev];
              updated[index] = { ...updated[index], locationString };
              return updated;
            });
          }
        });
      }
    } catch (error) {
      console.error("Error fetching collection places:", error);
      setLoading(false);
    }
  };

  const handleDeletePlace = async (id: number) => {
    try {
      const { error } = await supabase
        .from("places")
        .delete()
        .eq("id", id)

      if (error) throw error

      setPlaces(places.filter((place) => place.id !== id))
    } catch (error) {
      console.error("Error deleting place:", error)
    }
  }

  const addToCollection = async (placeId: number, collectionId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("collection_places")
        .insert([
          {
            collection_id: collectionId,
            place_id: placeId,
          },
        ])

      if (error) throw error;

      setPlaceCollections(prev => ({
        ...prev,
        [placeId]: [...(prev[placeId] || []), collectionId]
      }));

      toast({
        title: "Success",
        description: "Added to collection",
      })
    } catch (error) {
      console.error("Error adding to collection:", error)
      toast({
        title: "Error",
        description: "Failed to add to collection",
        variant: "destructive",
      })
    }
  }

  const removeFromCollection = async (placeId: number, collectionId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("collection_places")
        .delete()
        .match({
          collection_id: collectionId,
          place_id: placeId,
        })

      if (error) throw error;

      setPlaceCollections(prev => ({
        ...prev,
        [placeId]: prev[placeId]?.filter(id => id !== collectionId) || []
      }));

      if (selectedCollections.length > 0 && selectedCollections.some(c => c.id === collectionId)) {
        setPlaces(places.filter(place => place.id !== placeId));
      }

      toast({
        title: "Success",
        description: "Removed from collection",
      })
    } catch (error) {
      console.error("Error removing from collection:", error)
      toast({
        title: "Error",
        description: "Failed to remove from collection",
        variant: "destructive",
      })
    }
  }

  const fetchPlaceCollections = async (placeId: number) => {
    try {
      const { data, error } = await supabase
        .from("collection_places")
        .select("collection_id")
        .eq("place_id", placeId)

      if (error) throw error

      if (data) {
        setPlaceCollections(prev => ({
          ...prev,
          [placeId]: data.map(item => item.collection_id)
        }))
      }
    } catch (error) {
      console.error("Error fetching place collections:", error)
    }
  }

  if (loading) {
    return <div>Loading places...</div>
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {places.map((place) => (
        <Card key={place.id} className="relative group">
          <CardHeader className="flex flex-row justify-between items-start">
            <div>
              <Badge variant="secondary" className="w-fit text-xs">
                {place.placeType || 'Destination'}
              </Badge>
              <CardTitle className={cn(
                "line-clamp-2",
                !place.name && !place.locationString && "animate-pulse"
              )}>
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleDeletePlace(place.id)}>
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
            {place.openingHours && (
              <p className="text-sm text-muted-foreground mt-2">
                Hours: {place.openingHours}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}