import React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface NavbarProps {
  coordinates: [number, number] | null
  selectedRestaurant: any
  saveLocation: () => void
  isLoading: boolean
  user: any
}

const MapViewNavbar: React.FC<NavbarProps> = ({ coordinates, selectedRestaurant, saveLocation, isLoading, user }) => {
  return (
    <div className="absolute top-4 left-4 right-4 z-10">
      <Card className="bg-background/80 backdrop-blur-sm shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Current Location</CardTitle>
              <CardDescription>
                {selectedRestaurant ? "Selected Restaurant" : "Randomly generated coordinates"}
              </CardDescription>
            </div>
            {user && (
              <Button variant="outline" onClick={saveLocation} className="h-8 px-3" disabled={isLoading}>
                Save Location
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {coordinates && (
            <p className="text-sm">
              Latitude: {coordinates[0].toFixed(6)}, Longitude: {coordinates[1].toFixed(6)}
            </p>
          )}
          {selectedRestaurant && (
            <div>
              <h3 className="font-semibold">{selectedRestaurant.name}</h3>
              <p className="text-sm text-muted-foreground">{selectedRestaurant.address}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default MapViewNavbar
