"use client"

import type React from "react"
import { useState, useEffect } from "react"
import type { LatLngTuple } from "leaflet"
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import * as turf from "@turf/turf"
import landGeoJSON from "@/data/land.json"
import type { FeatureCollection } from "geojson"
import { useAuth } from "@/hooks/useAuth"
import { supabase } from "@/lib/supabase"
import { useLocation } from "react-router-dom"
import { useToast } from "@/hooks/use-toast"
import { Country, State, City } from "country-state-city"
import { searchNearby, getPlaceAddress } from "@/lib/overpass"
import L from "leaflet"
import { useTheme } from "next-themes"
import Navbar from "./Navbar"
import Settings from "./Settings"

const landGeoJSONTyped = landGeoJSON as FeatureCollection

// Create custom icons
const regularPin = L.divIcon({
  html: "📍",
  className: "custom-pin",
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30],
})

const foodPin = L.divIcon({
  html: "📍",
  className: "custom-pin food-pin",
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30],
})

// Add styles to head
const style = document.createElement("style")
style.textContent = `
  .custom-pin {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 30px;
    contain: paint;
  }
  .food-pin {
    filter: hue-rotate(220deg);
  }
`
document.head.appendChild(style)

const RecenterMap: React.FC<{
  coordinates: LatLngTuple | null
  selectedCity: string | null
  selectedState: string | null
  selectedCountry: string | null
  isRestaurant: boolean
  onMapMoved?: (bounds: { north: number; south: number; east: number; west: number }) => void
}> = ({ coordinates, selectedCity, selectedState, selectedCountry, isRestaurant, onMapMoved }) => {
  const map = useMap()

  useEffect(() => {
    if (coordinates) {
      let zoomLevel = 4

      if (isRestaurant) {
        zoomLevel = 16 // Closer zoom for restaurants
      } else if (selectedCity) {
        zoomLevel = 13
      } else if (selectedState) {
        zoomLevel = 8
      } else if (selectedCountry) {
        zoomLevel = 6
      }

      map.flyTo(coordinates, zoomLevel, {
        animate: true,
        duration: 1.5,
      })
    }
  }, [coordinates, map, selectedCity, selectedState, selectedCountry, isRestaurant])

  // Add event listener for map movements
  useEffect(() => {
    const handleMapMove = () => {
      const bounds = map.getBounds()
      onMapMoved?.({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      })
    }

    map.on("moveend", handleMapMove)
    return () => {
      map.off("moveend", handleMapMove)
    }
  }, [map, onMapMoved])

  return null
}

const CoordinateOverlay = ({ coordinates }: { coordinates: LatLngTuple | null }) => {
  if (!coordinates) return null

  return (
    <div className="absolute top-4 left-4 z-[1000] bg-background/80 text-foreground rounded-lg p-4 backdrop-blur-sm">
      <h3 className="text-sm font-medium mb-1">Current Location</h3>
      <p className="text-xs text-muted-foreground mb-2">Randomly generated coordinates</p>
      <div className="font-mono text-sm">
        <p>Latitude: {coordinates[0].toFixed(1)}</p>
        <p>Longitude: {coordinates[1].toFixed(1)}</p>
      </div>
    </div>
  )
}

export default function MainComponent() {
  const location = useLocation()
  const { user } = useAuth()
  const { toast } = useToast()
  const { theme } = useTheme()
  const [coordinates, setCoordinates] = useState<LatLngTuple | null>(null)
  const [isLandOnly, setIsLandOnly] = useState(true)
  const [precision, setPrecision] = useState(1)
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)
  const [selectedState, setSelectedState] = useState<string | null>(null)
  const [selectedCity, setSelectedCity] = useState<string | null>(null)
  const [findRestaurant, setFindRestaurant] = useState(false)
  const [restaurantRadius, setRestaurantRadius] = useState(2000)
  const [selectedRestaurant, setSelectedRestaurant] = useState<any>(null)
  const [mapBounds, setMapBounds] = useState<{ north: number; south: number; east: number; west: number } | null>(null)
  const [enablePOI, setEnablePOI] = useState(false)
  const [poiType, setPoiType] = useState<"food" | "entertainment" | "shopping" | "tourism" | null>(null)
  const [poiRadius, setPoiRadius] = useState(2000)
  const [lastLocations, setLastLocations] = useState<
    Array<{
      coordinates: LatLngTuple
      restaurant: any | null
      timestamp: number
    }>
  >([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [searchPrecision, setSearchPrecision] = useState<"high" | "medium" | "low">("medium")

  useEffect(() => {
    // Check if we have coordinates from navigation state
    const state = location.state as { lat?: number; lng?: number } | null
    if (state?.lat && state?.lng) {
      setCoordinates([state.lat, state.lng])
    } else {
      throwNewPin()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]) // Added location.state to dependencies

  const saveLocation = async () => {
    if (!user || !coordinates) return

    try {
      const { error } = await supabase.from("locations").insert([
        {
          user_id: user.id,
          latitude: coordinates[0],
          longitude: coordinates[1],
          created_at: new Date().toISOString(),
        },
      ])

      if (error) throw error
      toast({
        title: "Success",
        description: "Location saved successfully!",
        duration: 3000,
      })
    } catch (error) {
      console.error("Error saving location:", error)
      toast({
        title: "Error",
        description: "Failed to save location",
        variant: "destructive",
        duration: 3000,
      })
    }
  }

  const saveToHistory = async (lat: number, lng: number) => {
    if (!user) return

    try {
      const { error } = await supabase.from("history").insert([
        {
          user_id: user.id,
          latitude: lat,
          longitude: lng,
          created_at: new Date().toISOString(),
          is_saved: false,
        },
      ])

      if (error) throw error
    } catch (error) {
      console.error("Error saving to history:", error)
    }
  }

  const getBoundingBox = () => {
    if (selectedCity && selectedState && selectedCountry) {
      const cities = City.getCitiesOfState(selectedCountry, selectedState)
      const city = cities.find((c) => c.name === selectedCity)
      if (city && city.latitude && city.longitude) {
        // Approximate city bounds (±0.1 degrees from center)
        const lat = Number.parseFloat(city.latitude)
        const lng = Number.parseFloat(city.longitude)
        return {
          minLat: lat - 0.1,
          maxLat: lat + 0.1,
          minLng: lng - 0.1,
          maxLng: lng + 0.1,
        }
      }
    }

    if (selectedState && selectedCountry) {
      const state = State.getStateByCodeAndCountry(selectedState, selectedCountry)
      if (state && state.latitude && state.longitude) {
        // Use state's latitude/longitude as center and create a larger box
        const lat = Number.parseFloat(state.latitude)
        const lng = Number.parseFloat(state.longitude)
        return {
          minLat: lat - 2,
          maxLat: lat + 2,
          minLng: lng - 2,
          maxLng: lng + 2,
        }
      }
    }

    if (selectedCountry) {
      const country = Country.getCountryByCode(selectedCountry)
      if (country && country.latitude && country.longitude) {
        // Use country's latitude/longitude as center and create a large box
        const lat = Number.parseFloat(country.latitude)
        const lng = Number.parseFloat(country.longitude)
        return {
          minLat: lat - 5,
          maxLat: lat + 5,
          minLng: lng - 5,
          maxLng: lng + 5,
        }
      }
    }

    return null
  }

  const getSearchConfig = () => {
    switch (searchPrecision) {
      case "high":
        return { maxResults: 10, radiusMultiplier: 0.5 } // 1km radius, fewer results
      case "low":
        return { maxResults: 500, radiusMultiplier: 2.5 } // 5km radius, all possible results
      default: // medium
        return { maxResults: 30, radiusMultiplier: 1.5 } // 3km radius, moderate results
    }
  }

  const throwNewPin = async () => {
    // Save current location before generating new one
    if (coordinates) {
      setLastLocations((prev) => {
        const newLocations = [
          {
            coordinates,
            restaurant: selectedRestaurant,
            timestamp: Date.now(),
          },
          ...prev,
        ].slice(0, 5) // Keep last 5 locations
        return newLocations
      })
    }

    const generateRandomCityCoordinates = (): LatLngTuple => {
      if (selectedCity && selectedState && selectedCountry) {
        const cities = City.getCitiesOfState(selectedCountry, selectedState)
        const city = cities.find((c) => c.name === selectedCity)
        if (city && city.latitude && city.longitude) {
          return [Number.parseFloat(city.latitude), Number.parseFloat(city.longitude)]
        }
      }

      if (selectedState && selectedCountry) {
        const cities = City.getCitiesOfState(selectedCountry, selectedState)
        if (cities.length > 0) {
          const randomCity = cities[Math.floor(Math.random() * cities.length)]
          if (randomCity.latitude && randomCity.longitude) {
            return [Number.parseFloat(randomCity.latitude), Number.parseFloat(randomCity.longitude)]
          }
        }
      }

      if (selectedCountry) {
        const states = State.getStatesOfCountry(selectedCountry)
        const allCities: any[] = []
        states.forEach((state) => {
          const cities = City.getCitiesOfState(selectedCountry, state.isoCode)
          allCities.push(...cities)
        })
        if (allCities.length > 0) {
          const randomCity = allCities[Math.floor(Math.random() * allCities.length)]
          if (randomCity.latitude && randomCity.longitude) {
            return [Number.parseFloat(randomCity.latitude), Number.parseFloat(randomCity.longitude)]
          }
        }
      }

      // If no location restrictions or couldn't find a city, use a list of major cities
      const majorCities = [
        { lat: 40.7128, lng: -74.006 }, // New York
        { lat: 51.5074, lng: -0.1278 }, // London
        { lat: 35.6762, lng: 139.6503 }, // Tokyo
        { lat: 48.8566, lng: 2.3522 }, // Paris
        { lat: -33.8688, lng: 151.2093 }, // Sydney
        { lat: 55.7558, lng: 37.6173 }, // Moscow
        { lat: 22.3193, lng: 114.1694 }, // Hong Kong
        { lat: 1.3521, lng: 103.8198 }, // Singapore
        { lat: -23.5505, lng: -46.6333 }, // São Paulo
        { lat: 19.4326, lng: -99.1332 }, // Mexico City
        { lat: 37.7749, lng: -122.4194 }, // San Francisco
        { lat: 41.9028, lng: 12.4964 }, // Rome
        { lat: -34.6037, lng: -58.3816 }, // Buenos Aires
        { lat: 31.2304, lng: 121.4737 }, // Shanghai
        { lat: 25.2048, lng: 55.2708 }, // Dubai
      ]

      const randomCity = majorCities[Math.floor(Math.random() * majorCities.length)]
      return [randomCity.lat, randomCity.lng]
    }

    const generateRegularPin = (): LatLngTuple => {
      const bounds = getBoundingBox()
      let lat: number
      let lng: number

      if (bounds) {
        lat = bounds.minLat + Math.random() * (bounds.maxLat - bounds.minLat)
        lng = bounds.minLng + Math.random() * (bounds.maxLng - bounds.minLng)
      } else {
        lat = Math.random() * 180 - 90
        lng = Math.random() * 360 - 180
      }

      lat = Number.parseFloat(lat.toFixed(precision))
      lng = Number.parseFloat(lng.toFixed(precision))

      if (isLandOnly) {
        const onLand = checkIfOnLand(lat, lng)
        if (onLand) {
          return [lat, lng]
        } else {
          return generateRegularPin()
        }
      } else {
        return [lat, lng]
      }
    }

    const searchForRestaurant = async (coordinates: LatLngTuple): Promise<boolean> => {
      try {
        setIsLoading(true)
        const restaurantTags = [
          "restaurant",
          "fast_food",
          "cafe",
          "pub",
          "bar",
          "food_court",
          "biergarten",
          "ice_cream",
          "food",
          "deli",
        ]

        const { maxResults, radiusMultiplier } = getSearchConfig()
        const searchRadius = 2000 * radiusMultiplier

        const restaurants = await searchNearby(coordinates[0], coordinates[1], searchRadius, restaurantTags, maxResults)

        if (restaurants && restaurants.length > 0) {
          const randomIndex = Math.floor(Math.random() * restaurants.length)
          const restaurant = restaurants[randomIndex]
          setSelectedRestaurant(restaurant)
          setCoordinates([restaurant.latitude, restaurant.longitude])

          toast({
            title: "Found a place to eat!",
            description: `${restaurant.name} (${restaurant.type || "Food"})`,
            duration: 3000,
          })
          return true
        }
        return false
      } catch (error) {
        console.error("Error finding restaurant:", error)
        return false
      } finally {
        setIsLoading(false)
      }
    }

    try {
      if (findRestaurant) {
        // Keep trying different cities until we find a restaurant
        const maxAttempts = 5
        let attempt = 1
        let found = false

        while (attempt <= maxAttempts && !found) {
          const cityCoords = generateRandomCityCoordinates()
          setCoordinates(cityCoords) // Show the search location on the map
          found = await searchForRestaurant(cityCoords)

          if (!found) {
            console.log(`No restaurants found in attempt ${attempt}, trying another city...`)
            attempt++
          }
        }

        if (!found) {
          toast({
            title: "No restaurants found",
            description: "Couldn't find any restaurants. Please try again.",
            variant: "destructive",
            duration: 3000,
          })
          return
        }
      } else {
        // Regular pin throw
        setSelectedRestaurant(null)
        const newCoordinates = generateRegularPin()
        setCoordinates(newCoordinates)
      }

      // Save to history if we have coordinates
      if (coordinates) {
        saveToHistory(coordinates[0], coordinates[1])
      }
    } catch (error) {
      console.error("Error generating new pin:", error)
      toast({
        title: "Error",
        description: "Failed to generate location. Please try again.",
        variant: "destructive",
        duration: 3000,
      })
    }
  }

  const checkIfOnLand = (lat: number, lng: number): boolean => {
    const point = turf.point([lng, lat])
    const isInside = landGeoJSONTyped.features.some((feature: any) => turf.booleanPointInPolygon(point, feature))
    console.log(`Coordinate (${lat}, ${lng}) is on land: ${isInside}`)
    return isInside
  }

  const findRestaurantInArea = async () => {
    if (!mapBounds) {
      toast({
        title: "Error",
        description: "Please wait for the map to load completely.",
        variant: "destructive",
        duration: 3000,
      })
      return
    }

    // Save current location before searching
    if (coordinates) {
      setLastLocations((prev) => {
        const newLocations = [
          {
            coordinates,
            restaurant: selectedRestaurant,
            timestamp: Date.now(),
          },
          ...prev,
        ].slice(0, 5)
        return newLocations
      })
    }

    try {
      setIsLoading(true)
      const centerLat = (mapBounds.north + mapBounds.south) / 2
      const centerLng = (mapBounds.east + mapBounds.west) / 2

      const latDistance = (mapBounds.north - mapBounds.south) * 111000
      const lngDistance = (mapBounds.east - mapBounds.west) * 111000 * Math.cos((centerLat * Math.PI) / 180)
      const baseRadius = Math.min(Math.max(Math.max(latDistance, lngDistance) / 2, 1000), 50000)

      const { maxResults, radiusMultiplier } = getSearchConfig()
      const radius = baseRadius * radiusMultiplier

      console.log(`Searching for restaurants at ${centerLat}, ${centerLng} with radius ${radius}m`)

      const restaurantTags = [
        "restaurant",
        "fast_food",
        "cafe",
        "pub",
        "bar",
        "food_court",
        "biergarten",
        "ice_cream",
        "food",
        "deli",
      ]

      const restaurants = await searchNearby(centerLat, centerLng, radius, restaurantTags, maxResults)

      if (restaurants.length === 0) {
        toast({
          title: "No restaurants found",
          description: "Try adjusting the search area or precision.",
          duration: 3000,
        })
        return
      }

      // Select a random restaurant
      const randomIndex = Math.floor(Math.random() * restaurants.length)
      const selectedPlace = restaurants[randomIndex]

      // Fetch the address for the selected restaurant
      const address = await getPlaceAddress(selectedPlace)
      setSelectedRestaurant({ ...selectedPlace, address })
      setCoordinates([selectedPlace.latitude, selectedPlace.longitude])

      toast({
        title: "Found a restaurant!",
        description: selectedPlace.name,
        duration: 3000,
      })
    } catch (error) {
      console.error("Error finding restaurant:", error)
      toast({
        title: "Error",
        description: "Failed to find restaurants. Please try again.",
        variant: "destructive",
        duration: 3000,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const findRestaurantsNearMe = async () => {
    try {
      setIsLoading(true)
      // Save current location before searching
      if (coordinates) {
        setLastLocations((prev) => {
          const newLocations = [
            {
              coordinates,
              restaurant: selectedRestaurant,
              timestamp: Date.now(),
            },
            ...prev,
          ].slice(0, 5)
          return newLocations
        })
      }

      // Get user's current location
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject)
      })

      const { latitude, longitude } = position.coords
      console.log(`Current location: ${latitude}, ${longitude}`)

      // Always use 5km radius for GF HUNGRY button, regardless of precision setting
      const searchRadius = 5000

      // Search for restaurants within 5km
      const restaurantTags = [
        "restaurant",
        "fast_food",
        "cafe",
        "pub",
        "bar",
        "food_court",
        "biergarten",
        "ice_cream",
        "food",
        "deli",
      ]

      const restaurants = await searchNearby(
        latitude,
        longitude,
        searchRadius,
        restaurantTags,
        500, // Get all possible results
      )

      if (restaurants.length === 0) {
        toast({
          title: "No restaurants found",
          description: "No restaurants found in your area.",
          duration: 3000,
        })
        return
      }

      // Select a random restaurant
      const randomIndex = Math.floor(Math.random() * restaurants.length)
      const selectedPlace = restaurants[randomIndex]

      // Fetch the address for the selected restaurant
      const address = await getPlaceAddress(selectedPlace)
      setSelectedRestaurant({ ...selectedPlace, address })
      setCoordinates([selectedPlace.latitude, selectedPlace.longitude])

      toast({
        title: "Found a restaurant!",
        description: selectedPlace.name,
        duration: 3000,
      })
    } catch (error) {
      console.error("Error finding restaurant:", error)
      toast({
        title: "Error",
        description: "Failed to find restaurants. Please try again.",
        variant: "destructive",
        duration: 3000,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const checkIfOpen = (hours: string | undefined) => {
    if (!hours) return false

    const now = new Date()
    const day = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][now.getDay()]
    const time = now.getHours() * 100 + now.getMinutes()

    const todayHours = hours.split("\n").find((line) => line.startsWith(day))
    if (!todayHours) return false

    const timeRanges = todayHours.split(": ")[1]
    if (!timeRanges) return false

    return timeRanges.split(" and ").some((range) => {
      const [start, end] = range.split("-").map((t) => {
        const [hours, minutes = "00"] = t.trim().split(":")
        return Number.parseInt(hours) * 100 + Number.parseInt(minutes)
      })
      return time >= start && time <= end
    })
  }

  return (
    <div className="relative h-screen w-screen">
      {/* Map Container as background */}
      <div className="absolute inset-0 z-0">
        <MapContainer
          center={[0, 0]}
          zoom={2}
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
        >
          <ZoomControl position="topright" />
          <TileLayer
            url={
              theme === "dark"
                ? "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
                : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            }
            attribution={
              theme === "dark"
                ? '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors'
                : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            }
            maxZoom={20}
            maxNativeZoom={18}
            tileSize={256}
            detectRetina={true}
            updateWhenIdle={false}
            updateWhenZooming={false}
            keepBuffer={5}
          />
          {coordinates && (
            <Marker position={coordinates} icon={selectedRestaurant ? foodPin : regularPin}>
              <Popup>
                {/* ... Popup content ... */}
              </Popup>
            </Marker>
          )}
          <RecenterMap
            coordinates={coordinates}
            selectedCity={selectedCity}
            selectedState={selectedState}
            selectedCountry={selectedCountry}
            isRestaurant={!!selectedRestaurant}
            onMapMoved={setMapBounds}
          />
        </MapContainer>
      </div>

      {/* Navbar over the map */}
      <div className="absolute top-0 left-0 z-10 w-full">
        <Navbar
          coordinates={coordinates}
          selectedRestaurant={selectedRestaurant}
          saveLocation={saveLocation}
          isLoading={isLoading}
          user={user}
        />
      </div>

      {/* Settings over the map */}
      <div className="absolute bottom-0 right-0 z-10">
        <Settings
          isLandOnly={isLandOnly}
          setIsLandOnly={setIsLandOnly}
          precision={precision}
          setPrecision={setPrecision}
          throwNewPin={throwNewPin}
          selectedCountry={selectedCountry}
          setSelectedCountry={setSelectedCountry}
          selectedState={selectedState}
          setSelectedState={setSelectedState}
          selectedCity={selectedCity}
          setSelectedCity={setSelectedCity}
          enablePOI={enablePOI}
          setEnablePOI={setEnablePOI}
          poiType={poiType}
          setPoiType={setPoiType}
          poiRadius={poiRadius}
          setPoiRadius={setPoiRadius}
          isLoading={isLoading}
          findRestaurantInArea={findRestaurantInArea}
          findRestaurant={findRestaurant}
          setFindRestaurant={setFindRestaurant}
          findRestaurantsNearMe={findRestaurantsNearMe}
          searchPrecision={searchPrecision}
          setSearchPrecision={setSearchPrecision}
        />
      </div>
    </div>
  )
}