import React, { useState, useEffect } from "react";
import { LatLngTuple } from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl } from "react-leaflet";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import "leaflet/dist/leaflet.css";
import * as turf from "@turf/turf";
import landGeoJSON from "@/data/land.json";
import { FeatureCollection } from "geojson";
import Settings from "@/components/Settings";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Country, State, City } from 'country-state-city';
import { searchNearby, getPlaceAddress } from "@/lib/overpass";
import L from 'leaflet';
import { cn } from "@/lib/utils";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

const landGeoJSONTyped = landGeoJSON as FeatureCollection;

// Create custom icons
const regularPin = L.divIcon({
  html: '📍',
  className: 'custom-pin',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30],
});

const foodPin = L.divIcon({
  html: '📍',
  className: 'custom-pin food-pin',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30],
});

// Add styles to head
const style = document.createElement('style');
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
  .map-blur {
    filter: blur(4px);
    transition: filter 0.3s ease-out;
  }
  .map-spin {
    animation: spinMap 2s ease-in-out;
    transform-origin: center center;
  }
  @keyframes spinMap {
    0% {
      transform: perspective(1000px) rotateY(0deg);
    }
    100% {
      transform: perspective(1000px) rotateY(360deg);
    }
  }
  .throwing-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(4px);
    z-index: 1000;
    opacity: 0;
    transition: opacity 0.3s ease-out;
  }
  .throwing-overlay.visible {
    opacity: 1;
  }
`;
document.head.appendChild(style);

const RecenterMap: React.FC<{
  coordinates: LatLngTuple | null;
  selectedCity: string | null;
  selectedState: string | null;
  selectedCountry: string | null;
  isRestaurant: boolean;
  onMapMoved?: (bounds: { north: number; south: number; east: number; west: number }) => void;
}> = ({
  coordinates,
  selectedCity,
  selectedState,
  selectedCountry,
  isRestaurant,
  onMapMoved,
}) => {
  const map = useMap();

  useEffect(() => {
    if (coordinates) {
      let zoomLevel = 4;
      
      if (isRestaurant) {
        zoomLevel = 16; // Closer zoom for restaurants
      } else if (selectedCity) {
        zoomLevel = 13;
      } else if (selectedState) {
        zoomLevel = 8;
      } else if (selectedCountry) {
        zoomLevel = 6;
      }

      map.flyTo(coordinates, zoomLevel, {
        animate: true,
        duration: 1.5,
      });
    }
  }, [coordinates, map, selectedCity, selectedState, selectedCountry, isRestaurant]);

  // Add event listener for map movements
  useEffect(() => {
    const handleMapMove = () => {
      const bounds = map.getBounds();
      onMapMoved?.({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      });
    };

    map.on('moveend', handleMapMove);
    return () => {
      map.off('moveend', handleMapMove);
    };
  }, [map, onMapMoved]);

  return null;
};

const CoordinateOverlay = ({ coordinates }: { coordinates: LatLngTuple | null }) => {
  if (!coordinates) return null;
  
  return (
    <div className="absolute top-4 left-4 z-[1000] bg-background/80 text-foreground rounded-lg p-4 backdrop-blur-sm">
      <h3 className="text-sm font-medium mb-1">Current Location</h3>
      <p className="text-xs text-muted-foreground mb-2">Randomly generated coordinates</p>
      <div className="font-mono text-sm">
        <p>Latitude: {coordinates[0].toFixed(1)}</p>
        <p>Longitude: {coordinates[1].toFixed(1)}</p>
      </div>
    </div>
  );
};

export default function MainComponent() {
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { theme } = useTheme();
  const [coordinates, setCoordinates] = useState<LatLngTuple | null>(null);
  const [isLandOnly, setIsLandOnly] = useState(true);
  const [precision, setPrecision] = useState(1);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [findRestaurant, setFindRestaurant] = useState(false);
  const [restaurantRadius, setRestaurantRadius] = useState(2000);
  const [selectedRestaurant, setSelectedRestaurant] = useState<any>(null);
  const [mapBounds, setMapBounds] = useState<{ north: number; south: number; east: number; west: number } | null>(null);
  const [enablePOI, setEnablePOI] = useState(false);
  const [poiType, setPoiType] = useState<'food' | 'entertainment' | 'shopping' | 'tourism' | null>(null);
  const [poiRadius, setPoiRadius] = useState(2000);
  const [lastLocations, setLastLocations] = useState<Array<{
    coordinates: LatLngTuple;
    restaurant: any | null;
    timestamp: number;
  }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [searchPrecision, setSearchPrecision] = useState<'high' | 'medium' | 'low'>('medium');
  const [isThrowing, setIsThrowing] = useState(false);
  const [showPin, setShowPin] = useState(true);
  const [isNonAntarctic, setIsNonAntarctic] = useState(true);

  useEffect(() => {
    // Check if we have coordinates from navigation state
    const state = location.state as { lat?: number; lng?: number } | null;
    if (state?.lat && state?.lng) {
      setCoordinates([state.lat, state.lng]);
    } else {
      throwNewPin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveLocation = async () => {
    if (!user || !coordinates) return;

    try {
      const { error } = await supabase.from("locations").insert([
        {
          user_id: user.id,
          latitude: coordinates[0],
          longitude: coordinates[1],
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;
      toast({
        title: "Success",
        description: "Location saved successfully!",
        duration: 3000,
      });
    } catch (error) {
      console.error("Error saving location:", error);
      toast({
        title: "Error",
        description: "Failed to save location",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  const saveToHistory = async (lat: number, lng: number) => {
    if (!user) return;

    try {
      const { error } = await supabase.from("history").insert([
        {
          user_id: user.id,
          latitude: lat,
          longitude: lng,
          created_at: new Date().toISOString(),
          is_saved: false,
        },
      ]);

      if (error) throw error;
    } catch (error) {
      console.error("Error saving to history:", error);
    }
  };

  const getBoundingBox = () => {
    if (selectedCity && selectedState && selectedCountry) {
      const cities = City.getCitiesOfState(selectedCountry, selectedState);
      const city = cities.find(c => c.name === selectedCity);
      if (city && city.latitude && city.longitude) {
        // Approximate city bounds (±0.1 degrees from center)
        const lat = parseFloat(city.latitude);
        const lng = parseFloat(city.longitude);
        return {
          minLat: lat - 0.1,
          maxLat: lat + 0.1,
          minLng: lng - 0.1,
          maxLng: lng + 0.1,
        };
      }
    }

    if (selectedState && selectedCountry) {
      const state = State.getStateByCodeAndCountry(selectedState, selectedCountry);
      if (state && state.latitude && state.longitude) {
        // Use state's latitude/longitude as center and create a larger box
        const lat = parseFloat(state.latitude);
        const lng = parseFloat(state.longitude);
        return {
          minLat: lat - 2,
          maxLat: lat + 2,
          minLng: lng - 2,
          maxLng: lng + 2,
        };
      }
    }

    if (selectedCountry) {
      const country = Country.getCountryByCode(selectedCountry);
      if (country && country.latitude && country.longitude) {
        // Use country's latitude/longitude as center and create a large box
        const lat = parseFloat(country.latitude);
        const lng = parseFloat(country.longitude);
        return {
          minLat: lat - 5,
          maxLat: lat + 5,
          minLng: lng - 5,
          maxLng: lng + 5,
        };
      }
    }

    return null;
  };

  const getSearchConfig = () => {
    switch (searchPrecision) {
      case 'high':
        return { maxResults: 10, radiusMultiplier: 0.5 }; // 1km radius, fewer results
      case 'low':
        return { maxResults: 500, radiusMultiplier: 2.5 }; // 5km radius, all possible results
      default: // medium
        return { maxResults: 30, radiusMultiplier: 1.5 }; // 3km radius, moderate results
    }
  };

  const throwNewPin = async () => {
    setIsThrowing(true);
    setShowPin(false);  // Hide pin before animation
    
    // Wait a moment before generating new location
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Save current location before generating new one
    if (coordinates) {
      setLastLocations(prev => {
        const newLocations = [{
          coordinates,
          restaurant: selectedRestaurant,
          timestamp: Date.now()
        }, ...prev].slice(0, 5); // Keep last 5 locations
        return newLocations;
      });
    }

    const generateRandomCoordinates = (): LatLngTuple => {
      const minLat = isNonAntarctic ? -60 : -90;
      const maxLat = 90;
      const minLng = -180;
      const maxLng = 180;

      let lat: number;
      let lng: number;

      const bounds = getBoundingBox();

      if (bounds) {
        // Use map bounds but respect the Antarctic limit
        lat = Math.max(
          minLat,
          bounds.minLat + Math.random() * (bounds.maxLat - bounds.minLat)
        );
        lng = bounds.minLng + Math.random() * (bounds.maxLng - bounds.minLng);
      } else {
        lat = minLat + Math.random() * (maxLat - minLat);
        lng = minLng + Math.random() * (maxLng - minLng);
      }

      // Convert precision to decimal places (0 = whole number, 1 = tenths, 2 = hundredths, etc.)
      const decimalPlaces = Math.max(6, precision);
      
      // Use Number to maintain floating point precision
      lat = Number(lat.toFixed(decimalPlaces));
      lng = Number(lng.toFixed(decimalPlaces));

      if (isLandOnly) {
        const onLand = checkIfOnLand(lat, lng);
        if (onLand) {
          return [lat, lng];
        } else {
          return generateRandomCoordinates();
        }
      } else {
        return [lat, lng];
      }
    };

    const searchForRestaurant = async (coordinates: LatLngTuple): Promise<boolean> => {
      try {
        setIsLoading(true);
        const restaurantTags = [
          'restaurant',
          'fast_food',
          'cafe',
          'pub',
          'bar',
          'food_court',
          'biergarten',
          'ice_cream',
          'food',
          'deli'
        ];
        
        const { maxResults, radiusMultiplier } = getSearchConfig();
        const searchRadius = 2000 * radiusMultiplier;
        
        const restaurants = await searchNearby(
          coordinates[0],
          coordinates[1],
          searchRadius,
          restaurantTags,
          maxResults
        );

        if (restaurants && restaurants.length > 0) {
          const randomIndex = Math.floor(Math.random() * restaurants.length);
          const restaurant = restaurants[randomIndex];
          setSelectedRestaurant(restaurant);
          setCoordinates([restaurant.latitude, restaurant.longitude]);
          
          toast({
            title: "Found a place to eat!",
            description: `${restaurant.name} (${restaurant.type || 'Food'})`,
            duration: 3000,
          });
          return true;
        }
        return false;
      } catch (error) {
        console.error("Error finding restaurant:", error);
        return false;
      } finally {
        setIsLoading(false);
      }
    };

    try {
      if (findRestaurant) {
        // Keep trying different cities until we find a restaurant
        let maxAttempts = 5;
        let attempt = 1;
        let found = false;

        while (attempt <= maxAttempts && !found) {
          const cityCoords = generateRandomCoordinates();
          setCoordinates(cityCoords); // Show the search location on the map
          found = await searchForRestaurant(cityCoords);
          
          if (!found) {
            console.log(`No restaurants found in attempt ${attempt}, trying another city...`);
            attempt++;
          }
        }

        if (!found) {
          toast({
            title: "No restaurants found",
            description: "Couldn't find any restaurants. Please try again.",
            variant: "destructive",
            duration: 3000,
          });
          return;
        }
      } else {
        // Regular pin throw
        setSelectedRestaurant(null);
        const newCoordinates = generateRandomCoordinates();
        setCoordinates(newCoordinates);
      }

      // Save to history if we have coordinates
      if (coordinates) {
        saveToHistory(coordinates[0], coordinates[1]);
      }
    } catch (error) {
      console.error("Error generating new pin:", error);
      toast({
        title: "Error",
        description: "Failed to generate location. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      // Wait for map to finish moving before removing overlay
      setTimeout(() => {
        setIsThrowing(false);
        setShowPin(true);
      }, 1500);
    }
  };

  const checkIfOnLand = (lat: number, lng: number): boolean => {
    const point = turf.point([lng, lat]);
    const isInside = landGeoJSONTyped.features.some((feature: any) =>
      turf.booleanPointInPolygon(point, feature)
    );
    console.log(`Coordinate (${lat}, ${lng}) is on land: ${isInside}`);
    return isInside;
  };

  const findRestaurantInArea = async () => {
    if (!mapBounds) {
      toast({
        title: "Error",
        description: "Please wait for the map to load completely.",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    // Save current location before searching
    if (coordinates) {
      setLastLocations(prev => {
        const newLocations = [{
          coordinates,
          restaurant: selectedRestaurant,
          timestamp: Date.now()
        }, ...prev].slice(0, 5);
        return newLocations;
      });
    }

    try {
      setIsLoading(true);
      const centerLat = (mapBounds.north + mapBounds.south) / 2;
      const centerLng = (mapBounds.east + mapBounds.west) / 2;

      const latDistance = (mapBounds.north - mapBounds.south) * 111000;
      const lngDistance = (mapBounds.east - mapBounds.west) * 111000 * Math.cos(centerLat * Math.PI / 180);
      const baseRadius = Math.min(Math.max(Math.max(latDistance, lngDistance) / 2, 1000), 50000);
      
      const { maxResults, radiusMultiplier } = getSearchConfig();
      const radius = baseRadius * radiusMultiplier;

      console.log(`Searching for restaurants at ${centerLat}, ${centerLng} with radius ${radius}m`);

      const restaurantTags = [
        'restaurant',
        'fast_food',
        'cafe',
        'pub',
        'bar',
        'food_court',
        'biergarten',
        'ice_cream',
        'food',
        'deli'
      ];

      const restaurants = await searchNearby(
        centerLat,
        centerLng,
        radius,
        restaurantTags,
        maxResults
      );

      if (restaurants.length === 0) {
        toast({
          title: "No restaurants found",
          description: "Try adjusting the search area or precision.",
          duration: 3000,
        });
        return;
      }

      // Select a random restaurant
      const randomIndex = Math.floor(Math.random() * restaurants.length);
      const selectedPlace = restaurants[randomIndex];
      
      // Fetch the address for the selected restaurant
      const address = await getPlaceAddress(selectedPlace);
      setSelectedRestaurant({ ...selectedPlace, address });
      setCoordinates([selectedPlace.latitude, selectedPlace.longitude]);

      toast({
        title: "Found a restaurant!",
        description: selectedPlace.name,
        duration: 3000,
      });
    } catch (error) {
      console.error('Error finding restaurant:', error);
      toast({
        title: "Error",
        description: "Failed to find restaurants. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const findRestaurantsNearMe = async () => {
    try {
      setIsLoading(true);
      // Save current location before searching
      if (coordinates) {
        setLastLocations(prev => {
          const newLocations = [{
            coordinates,
            restaurant: selectedRestaurant,
            timestamp: Date.now()
          }, ...prev].slice(0, 5);
          return newLocations;
        });
      }

      // Get user's current location
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });

      const { latitude, longitude } = position.coords;
      console.log(`Current location: ${latitude}, ${longitude}`);

      // Always use 5km radius for GF HUNGRY button, regardless of precision setting
      const searchRadius = 5000;

      // Search for restaurants within 5km
      const restaurantTags = [
        'restaurant',
        'fast_food',
        'cafe',
        'pub',
        'bar',
        'food_court',
        'biergarten',
        'ice_cream',
        'food',
        'deli'
      ];

      const restaurants = await searchNearby(
        latitude,
        longitude,
        searchRadius,
        restaurantTags,
        500 // Get all possible results
      );

      if (restaurants.length === 0) {
        toast({
          title: "No restaurants found",
          description: "No restaurants found in your area.",
          duration: 3000,
        });
        return;
      }

      // Select a random restaurant
      const randomIndex = Math.floor(Math.random() * restaurants.length);
      const selectedPlace = restaurants[randomIndex];
      
      // Fetch the address for the selected restaurant
      const address = await getPlaceAddress(selectedPlace);
      setSelectedRestaurant({ ...selectedPlace, address });
      setCoordinates([selectedPlace.latitude, selectedPlace.longitude]);

      toast({
        title: "Found a restaurant!",
        description: selectedPlace.name,
        duration: 3000,
      });
    } catch (error) {
      console.error('Error finding restaurant:', error);
      toast({
        title: "Error",
        description: "Failed to find restaurants. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const checkIfOpen = (hours: string | undefined) => {
    if (!hours) return false;
    
    const now = new Date();
    const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
    const time = now.getHours() * 100 + now.getMinutes();

    const todayHours = hours.split('\n').find(line => line.startsWith(day));
    if (!todayHours) return false;

    const timeRanges = todayHours.split(': ')[1];
    if (!timeRanges) return false;

    return timeRanges.split(' and ').some(range => {
      const [start, end] = range.split('-').map(t => {
        const [hours, minutes = '00'] = t.trim().split(':');
        return parseInt(hours) * 100 + parseInt(minutes);
      });
    });
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] py-8 px-4 sm:px-6 lg:px-8">
      <div className="w-full mx-auto">
        <div className="flex gap-8">
          <div className="w-3/4">
            <div className="grid grid-cols-[2fr_1fr] gap-8 mb-8">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>Current Location</CardTitle>
                      <CardDescription>
                        {selectedRestaurant ? "Selected Restaurant" : "Randomly generated coordinates"}
                      </CardDescription>
                    </div>
                    {user && (
                      <Button 
                        variant="outline" 
                        onClick={saveLocation} 
                        className="h-8 px-3" 
                        disabled={isLoading}
                      >
                        Save Location
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="max-h-[400px] overflow-y-auto space-y-4">
                  {coordinates ? (
                    <div className="space-y-4">
                      <Card className="border-0 shadow-none bg-muted/50">
                        <CardContent className="p-3">
                          <p className="text-sm text-muted-foreground">
                            Latitude: {coordinates[0].toFixed(6)}, Longitude:{" "}
                            {coordinates[1].toFixed(6)}
                          </p>
                        </CardContent>
                      </Card>
                      {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                          <span className="ml-3 text-sm text-muted-foreground">Finding restaurants...</span>
                        </div>
                      ) : selectedRestaurant && (
                        <Card className="bg-card text-card-foreground border">
                          <CardContent className="p-6 space-y-6">
                            <div className="space-y-2">
                              <div className="flex justify-between items-start">
                                <h2 className="text-2xl font-bold">{selectedRestaurant.name}</h2>
                                {selectedRestaurant.openingHours && (
                                  <span className={cn(
                                    "px-3 py-1 rounded-full text-sm font-medium",
                                    checkIfOpen(selectedRestaurant.openingHours) 
                                      ? "bg-green-500/20 text-green-500" 
                                      : "bg-red-500/20 text-red-500"
                                  )}>
                                    {checkIfOpen(selectedRestaurant.openingHours) ? "Open Now" : "Closed"}
                                  </span>
                                )}
                              </div>
                              {selectedRestaurant.cuisine && (
                                <p className="text-muted-foreground">Cuisine: {selectedRestaurant.cuisine}</p>
                              )}
                            </div>

                            <div className="space-y-4">
                              <div className="flex items-center gap-2">
                                <span className="text-xl">📍</span>
                                <p className="text-muted-foreground flex-1">
                                  {selectedRestaurant.address}
                                </p>
                              </div>

                              {selectedRestaurant.openingHours && (
                                <div className="flex items-start gap-2">
                                  <span className="text-xl mt-1">🕒</span>
                                  <div className="text-muted-foreground flex-1 whitespace-pre-line">
                                    {selectedRestaurant.openingHours}
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="flex gap-4">
                              <Button 
                                variant="outline" 
                                className="flex-1 hover:bg-muted"
                                asChild
                              >
                                <a 
                                  href={`https://www.google.com/maps/dir/?api=1&destination=${selectedRestaurant.latitude},${selectedRestaurant.longitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Get Directions
                                </a>
                              </Button>
                              {selectedRestaurant.website && (
                                <Button 
                                  variant="outline" 
                                  className="flex-1 hover:bg-muted"
                                  asChild
                                >
                                  <a 
                                    href={selectedRestaurant.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    Visit Website
                                  </a>
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                      <p>No location selected yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {lastLocations.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle>Previous Locations</CardTitle>
                    <CardDescription>
                      Recently viewed places
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="max-h-[400px] overflow-y-auto space-y-3">
                    {lastLocations.map((location, index) => (
                      <Card key={location.timestamp} className="border-0 shadow-none bg-muted/50">
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">
                              {location.coordinates[0].toFixed(4)}, {location.coordinates[1].toFixed(4)}
                            </p>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-6 px-2"
                              onClick={() => {
                                setCoordinates(location.coordinates);
                                setSelectedRestaurant(location.restaurant);
                              }}
                            >
                              Return
                            </Button>
                          </div>
                          {location.restaurant && (
                            <div className="bg-card text-card-foreground rounded-md p-3 border">
                              <div className="flex justify-between items-start gap-2">
                                <h3 className="text-sm font-semibold truncate">
                                  {location.restaurant.name}
                                </h3>
                                {location.restaurant.openingHours && (
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-full text-xs font-medium",
                                    checkIfOpen(location.restaurant.openingHours) 
                                      ? "bg-green-500/20 text-green-500" 
                                      : "bg-red-500/20 text-red-500"
                                  )}>
                                    {checkIfOpen(location.restaurant.openingHours) ? "Open" : "Closed"}
                                  </span>
                                )}
                              </div>
                              {location.restaurant.cuisine && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {location.restaurant.cuisine}
                                </p>
                              )}
                              <div className="flex items-center gap-1 mt-2">
                                <span className="text-sm">📍</span>
                                <p className="text-xs text-muted-foreground truncate">
                                  {location.restaurant.address}
                                </p>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="h-[600px] w-full relative">
                  <CoordinateOverlay coordinates={coordinates} />
                  
                  {/* Add the throwing overlay */}
                  <div className={cn(
                    "throwing-overlay",
                    isThrowing && "visible",
                    // Only allow pointer events when throwing
                    isThrowing ? "pointer-events-auto" : "pointer-events-none"
                  )}>
                    <div className="text-center">
                      <span className="text-4xl mb-4 block">📍</span>
                      <h3 className="text-xl font-semibold text-foreground">Throwing a pin...</h3>
                    </div>
                  </div>
                  
                  <MapContainer
                    center={[0, 0]}
                    zoom={2}
                    style={{ height: "100%", width: "100%" }}
                    zoomControl={false}
                    className={cn(
                      isThrowing && "map-blur map-spin",
                      "transition-all duration-300"
                    )}
                  >
                    <ZoomControl position="topright" />
                    <TileLayer
                      url={theme === "dark"
                        ? "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png"
                        : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                      }
                      attribution={theme === "dark"
                        ? '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors'
                        : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                      }
                      maxZoom={20}
                    />
                    {coordinates && showPin && (
                      <Marker 
                        position={coordinates}
                        icon={selectedRestaurant ? foodPin : regularPin}
                      >
                        <Popup>
                          <div>
                            <h3 className="font-bold mb-2">
                              {selectedRestaurant ? selectedRestaurant.name : "Random Location"}
                            </h3>
                            <p>Latitude: {coordinates[0].toFixed(6)}</p>
                            <p>Longitude: {coordinates[1].toFixed(6)}</p>
                            {selectedRestaurant && (
                              <div className="space-y-2">
                                <p className="text-sm text-muted-foreground">
                                  {selectedRestaurant.cuisine && (
                                    <span className="block">Cuisine: {selectedRestaurant.cuisine}</span>
                                  )}
                                  <span className="block">{selectedRestaurant.address}</span>
                                  {selectedRestaurant.openingHours && (
                                    <div className="mt-2 border-t pt-2">
                                      <span className="block font-medium mb-1">Opening Hours:</span>
                                      <span className="block whitespace-pre-line text-sm">
                                        {selectedRestaurant.openingHours}
                                      </span>
                                    </div>
                                  )}
                                </p>
                                <div className="flex gap-2 mt-2 justify-end">
                                  <a 
                                    href={`https://www.google.com/maps/dir/?api=1&destination=${selectedRestaurant.latitude},${selectedRestaurant.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline text-sm"
                                  >
                                    Get Directions
                                  </a>
                                  {selectedRestaurant.website && (
                                    <a 
                                      href={selectedRestaurant.website}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary hover:underline text-sm"
                                    >
                                      Website
                                    </a>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
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
              </CardContent>
            </Card>
          </div>
          <div className="w-1/4">
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
              isNonAntarctic={isNonAntarctic}
              setIsNonAntarctic={setIsNonAntarctic}
            />
          </div>
        </div>
      </div>
    </div>
  );
} 