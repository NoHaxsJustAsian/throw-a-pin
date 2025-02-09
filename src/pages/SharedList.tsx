import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { getLocationDetails } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Copy, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { MapContainer, TileLayer, Polyline, Marker, Popup } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from 'leaflet'
import { cn } from "@/lib/utils"

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

interface PlaceResponse {
  place: {
    id: number;
    name: string | null;
    address: string | null;
    latitude: number;
    longitude: number;
    place_type: string | null;
  };
  place_id: number;
  collection_id: string;
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

interface PlaceWithLoadingName extends Place {
  isLoadingName?: boolean;
}

interface SharedCollection {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
  places: PlaceWithLoadingName[];
}

export default function SharedList() {
  const { id } = useParams<{ id: string }>()
  const [collection, setCollection] = useState<SharedCollection | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  useEffect(() => {
    fetchCollection()
  }, [id])

  const fetchCollection = async () => {
    if (!id) return;

    try {
      // First get the collection details
      const { data: collectionData, error: collectionError } = await supabase
        .from("collections")
        .select("*")
        .eq("id", id)
        .single();

      if (collectionError) throw collectionError;

      if (!collectionData) {
        toast({
          title: "Not Found",
          description: "This collection doesn't exist or has been deleted",
          variant: "destructive",
        });
        return;
      }

      // Then get all places in this collection
      const { data: placesData, error: placesError } = await supabase
        .from("collection_places")
        .select(`
          place:places (
            id,
            name,
            address,
            latitude,
            longitude,
            place_type
          )
        `)
        .eq("collection_id", id);

      if (placesError) throw placesError;

      if (placesData) {
        // Initialize all places with loading state
        const places = placesData.map(item => ({
          ...(item.place as unknown as Place),
          isLoadingName: !(item.place as any).name && !(item.place as any).address,
          locationString: (item.place as any).name || `${(item.place as any).latitude.toFixed(4)}, ${(item.place as any).longitude.toFixed(4)}`
        }));

        // Set collection immediately with loading states
        setCollection({
          ...collectionData,
          places
        });

        // Remove loading state
        setLoading(false);

        // Then fetch location details for each place in parallel
        const locationPromises = places.map(async (place, index) => {
          if (!place.name && !place.address) {
            try {
              const locationInfo = await getLocationDetails(place.latitude, place.longitude);
              
              // Update the database with the new information
              if (locationInfo.address) {
                const { error: updateError } = await supabase
                  .from("places")
                  .update({ 
                    address: locationInfo.address,
                    name: locationInfo.locationString 
                  })
                  .eq("id", place.id);

                if (updateError) {
                  console.error('Error updating place:', updateError);
                }
              }
              
              return { 
                index, 
                locationString: locationInfo.locationString,
                address: locationInfo.address 
              };
            } catch (error) {
              console.error('Error fetching location:', error);
              return { 
                index, 
                locationString: 'Unknown Location',
                address: null 
              };
            }
          }
          return null;
        });

        // Update locations as they come in
        const results = await Promise.all(locationPromises);
        results.forEach(result => {
          if (result) {
            setCollection(prev => {
              if (!prev) return prev;
              const updatedPlaces = [...prev.places];
              updatedPlaces[result.index] = {
                ...updatedPlaces[result.index],
                isLoadingName: false,
                locationString: result.locationString,
                address: result.address
              };
              return {
                ...prev,
                places: updatedPlaces
              };
            });
          }
        });
      }
    } catch (error) {
      console.error('Error fetching collection:', error);
      setLoading(false);
    }
  };

  const cloneCollection = async () => {
    if (!user || !collection) return;

    try {
      // First create a new collection
      const { data: newCollection, error: collectionError } = await supabase
        .from("collections")
        .insert([
          {
            name: `${collection.name} (Copy)`,
            user_id: user.id,
          },
        ])
        .select()
        .single()

      if (collectionError) throw collectionError

      // Then copy all places to the new collection
      if (collection.places.length > 0) {
        const { error: placesError } = await supabase
          .from("collection_places")
          .insert(
            collection.places.map(place => ({
              collection_id: newCollection.id,
              place_id: place.id
            }))
          )

        if (placesError) throw placesError
      }

      toast({
        title: "Success",
        description: "Collection cloned successfully",
      })

      // Navigate to the saved locations page
      navigate("/saved")
    } catch (error) {
      console.error("Error cloning collection:", error)
      toast({
        title: "Error",
        description: "Failed to clone collection",
        variant: "destructive",
      })
    }
  }

  const renderMap = () => {
    if (!collection || collection.places.length === 0) return null;

    const positions = collection.places.map(place => [place.latitude, place.longitude] as [number, number]);
    const bounds = L.latLngBounds(positions);
    
    return (
      <div className="mb-8 h-[400px] border rounded-lg overflow-hidden">
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
          {positions.map((position, index) => (
            <Marker 
              key={index} 
              position={position}
              icon={pinIcon}
            >
              <Popup>
                <div className="p-1">
                  <p className="font-medium">{collection.places[index].locationString || 'Unnamed Location'}</p>
                  {collection.places[index].address && (
                    <p className="text-sm text-muted-foreground mt-1">{collection.places[index].address}</p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
          <Polyline
            positions={positions}
            color="#3b82f6"
            weight={3}
            dashArray="10, 10"
          />
        </MapContainer>
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      <div className="h-[calc(100vh-64px)] mt-16">
        <div className="container mx-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-[60vh]">
              <p className="text-lg">Loading collection...</p>
            </div>
          ) : collection ? (
            <>
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-bold">{collection.name}</h1>
                  <Badge variant="secondary">Shared List</Badge>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-sm">
                    {collection.places.length} {collection.places.length === 1 ? 'place' : 'places'}
                  </Badge>
                  {user && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={cloneCollection}
                      className="gap-2"
                    >
                      <Copy className="h-4 w-4" />
                      Clone Collection
                    </Button>
                  )}
                </div>
              </div>

              {renderMap()}

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
                {collection.places.map((place) => (
                  <Card key={place.id} className="relative group">
                    {place.isLoadingName ? (
                      <div className="flex flex-col items-center justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin mb-2" />
                        <p className="text-sm text-muted-foreground">Loading location...</p>
                      </div>
                    ) : (
                      <>
                        <CardHeader>
                          <div>
                            <Badge variant="secondary" className="w-fit text-xs">
                              {place.place_type || 'Destination'}
                            </Badge>
                            <CardTitle className="line-clamp-2 mt-2">
                              {place.locationString || `${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}`}
                            </CardTitle>
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
                      </>
                    )}
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[60vh]">
              <p className="text-lg">Collection not found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 