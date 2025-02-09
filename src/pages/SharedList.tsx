import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Place } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { getLocationDetails } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Copy } from "lucide-react"
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

interface PlaceWithLoadingName extends Place {
  isLoadingName?: boolean;
  locationString?: string;
}

interface SharedCollection {
  id: string
  name: string
  user_id: string
  created_at: string
  places: PlaceWithLoadingName[]
}

export default function SharedList() {
  const { id } = useParams<{ id: string }>()
  const [collection, setCollection] = useState<SharedCollection | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const { user } = useAuth()
  const navigate = useNavigate()

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
          ...item.place,
          isLoadingName: true,
          locationString: item.place.name || 'Loading location...'
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
          if (!place.name) {
            try {
              const locationString = await getLocationDetails(place.latitude, place.longitude);
              return { index, locationString };
            } catch (error) {
              console.error('Error fetching location:', error);
              return { index, locationString: 'Unknown Location' };
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
                locationString: result.locationString
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

  if (loading) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <p className="text-lg">Loading collection...</p>
      </div>
    )
  }

  if (!collection) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <p className="text-lg">Collection not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-16 container mx-auto p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 p-6 bg-card border rounded-lg shadow-sm">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold mb-3">{collection.name}</h1>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-sm">
                  {collection.places.length} {collection.places.length === 1 ? 'place' : 'places'}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  • Shared List
                </span>
              </div>
            </div>
            {user && user.id !== collection.user_id && (
              <Button onClick={cloneCollection} className="gap-2" size="lg">
                <Copy className="h-5 w-5" />
                Clone List
              </Button>
            )}
          </div>
        </div>

        {collection.places.length > 0 && renderMap()}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {collection.places.map((place) => (
            <Card 
              key={place.id} 
              className="relative group border hover:border-primary/20 transition-colors"
            >
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary" className="text-xs">
                    {place.place_type || 'Destination'}
                  </Badge>
                </div>
                <CardTitle className={cn(
                  "line-clamp-2",
                  place.isLoadingName && "animate-pulse"
                )}>
                  {place.locationString || 'Unnamed Location'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {place.address && (
                  <p className="text-sm text-muted-foreground">
                    {place.address}
                  </p>
                )}
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground/50"></span>
                  {place.latitude.toFixed(6)}, {place.longitude.toFixed(6)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {collection.places.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">This collection is empty</p>
          </div>
        )}
      </div>
    </div>
  )
} 