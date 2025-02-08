"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { supabase, Place } from "@/lib/supabase"

export default function PlacesGrid() {
  const [places, setPlaces] = useState<Place[]>([])
  const [loading, setLoading] = useState(true)

  const TEST_UUID = '9e38267e-69e8-4683-9a26-6fba249a17c8'

  useEffect(() => {
    fetchPlaces()
  }, [])

  async function fetchPlaces() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("places")
        .select("*")
        .eq("user_id", TEST_UUID)
  
      if (error) throw error
  
      if (data) {
        setPlaces(data)
      }
    } catch (error) {
      console.error("Error fetching places:", error)
    } finally {
      setLoading(false)
    }
  }

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

  if (loading) {
    return <div>Loading places...</div>
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {places.map((place) => (
        <Card key={place.id} className="relative group">
          <CardHeader>
            <Badge variant="secondary" className="w-fit text-xs">
              {place.placeType || 'Destination'}
            </Badge>
            <CardTitle>{place.name || 'Unnamed Location'}</CardTitle>
          </CardHeader>
          <CardContent>
            {place.address && (
              <p className="text-sm text-muted-foreground mb-2">
                {place.address}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Coordinates: {place.coordx}, {place.coordy}
            </p>
            {place.openingHours && (
              <p className="text-sm text-muted-foreground mt-2">
                Hours: {place.openingHours}
              </p>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="absolute bottom-2 right-2 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => handleDeletePlace(place.id)}
              aria-label={`Delete ${place.name || 'place'}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
