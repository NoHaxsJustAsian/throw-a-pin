"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"

type Place = {
  id: number
  country: string
  city: string
  longitude: number
  latitude: number
}

type Attraction = {
  id: number
  attractionType: string
  name: string
  address: string
}

const initialAttractions: Attraction[] = [
  { id: 5, attractionType: "Restaurant", name: "Le Meurice", address: "228 Rue de Rivoli, 75001 Paris, France" },
  { id: 6, attractionType: "Park", name: "Jardin du Luxembourg", address: "Boulevard du Montparnasse, 75014 Paris, France" },
  { id: 7, attractionType: "Museum", name: "Louvre", address: "Rue de Rivoli, 75001 Paris, France" }
]

const initialPlaces: Place[] = [
  { id: 1, country: "France", city: "Paris", longitude: 2.3522, latitude: 48.8566 },
  { id: 2, country: "Peru", city: "Machu Picchu", longitude: -72.545, latitude: -13.1631 },
  { id: 3, country: "China", city: "Great Wall", longitude: 114.215, latitude: 40.4319 },
  { id: 4, country: "India", city: "Taj Mahal", longitude: 78.0398, latitude: 27.175 },
]

export default function PlacesGrid() {
  const [places, setPlaces] = useState<Place[]>(initialPlaces)
  const [attractions, setAttractions] = useState<Attraction[]>(initialAttractions)
  
  const handleDeletePlace = (id: number) => {
    setPlaces(places.filter((place) => place.id !== id))
  }

  const handleDeleteAttraction = (id: number) => {
    setAttractions(attractions.filter((attraction) => attraction.id !== id))
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {places.map((place) => (
        <Card key={place.id} className="relative group">
          <CardHeader>
            <Badge variant="secondary" className="w-fit text-xs">Place</Badge>
            <CardTitle>{place.city}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">{place.country}</p>
            <p className="text-sm text-muted-foreground">
              Coordinates: {place.latitude}, {place.longitude}
            </p>
            <Button
              variant="ghost"
              size="icon"
              className="absolute bottom-2 right-2 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => handleDeletePlace(place.id)}
              aria-label={`Delete ${place.city}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ))}

      {attractions.map((attraction) => (
        <Card key={attraction.id} className="relative group">
          <CardHeader>
            <Badge className="w-fit text-xs">{attraction.attractionType}</Badge>
            <CardTitle>{attraction.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{attraction.address}</p>
            <Button
              variant="ghost"
              size="icon"
              className="absolute bottom-2 right-2 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => handleDeleteAttraction(attraction.id)}
              aria-label={`Delete ${attraction.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

