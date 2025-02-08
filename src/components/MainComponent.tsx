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
import { searchNearby, searchPlaces, checkIfOpen, findRestaurantInArea, findRestaurantsNearMe, findRandomPOI, findPOI, findPOIInView, getPlaceAddress } from "@/lib/overpass";
import L from 'leaflet';
import { cn } from "@/lib/utils";
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
`;
document.head.appendChild(style);

const RecenterMap: React.FC<{
  coordinates: LatLngTuple | null;
  selectedCity: string | null;
  selectedState: string | null;
  selectedCountry: string | null;
  isRestaurant: boolean;
  isPOI?: boolean;
  onMapMoved?: (bounds: { north: number; south: number; east: number; west: number }) => void;
}> = ({
  coordinates,
  selectedCity,
  selectedState,
  selectedCountry,
  isRestaurant,
  isPOI,
  onMapMoved,
}) => {
  const map = useMap();

  useEffect(() => {
    if (coordinates) {
      let zoomLevel = 4;
      
      if (isRestaurant || isPOI) {
        zoomLevel = 16; // Same zoom level for both restaurants and POIs
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
  }, [coordinates, map, selectedCity, selectedState, selectedCountry, isRestaurant, isPOI]);

  // Add event listener for map movements
  useEffect(() => {
    const handleMapMove = () => {
      const bounds = map.getBounds();
      const boundsObj = {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      };
      console.log('Map bounds updated:', boundsObj);
      onMapMoved?.(boundsObj);
    };

    map.on('moveend', handleMapMove);
    map.on('zoomend', handleMapMove);
    return () => {
      map.off('moveend', handleMapMove);
      map.off('zoomend', handleMapMove);
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

type ValidPOIType = "tourism" | "food" | "entertainment" | "shopping";

const isValidPOIType = (type: string): type is ValidPOIType => {
  return ["tourism", "food", "entertainment", "shopping"].includes(type);
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
  const [poiTypes, setPoiTypes] = useState<string[]>([]);
  const [selectedPOIs, setSelectedPOIs] = useState<any[]>([]);
  const [lastLocations, setLastLocations] = useState<Array<{
    coordinates: LatLngTuple;
    restaurant: any | null;
    poi: any | null;
    timestamp: number;
  }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [searchPrecision, setSearchPrecision] = useState<'high' | 'medium' | 'low'>('medium');

  const generateRandomCityCoordinates = (): [number, number] => {
    if (selectedCity && selectedState && selectedCountry) {
      const cities = City.getCitiesOfState(selectedCountry, selectedState);
      const city = cities.find(c => c.name === selectedCity);
      if (city && city.latitude && city.longitude) {
        return [parseFloat(city.latitude), parseFloat(city.longitude)];
      }
    }
    
    if (selectedState && selectedCountry) {
      const cities = City.getCitiesOfState(selectedCountry, selectedState);
      if (cities.length > 0) {
        const randomCity = cities[Math.floor(Math.random() * cities.length)];
        if (randomCity.latitude && randomCity.longitude) {
          return [parseFloat(randomCity.latitude), parseFloat(randomCity.longitude)];
        }
      }
    }
    
    if (selectedCountry) {
      const states = State.getStatesOfCountry(selectedCountry);
      const allCities: any[] = [];
      states.forEach(state => {
        const cities = City.getCitiesOfState(selectedCountry, state.isoCode);
        allCities.push(...cities);
      });
      if (allCities.length > 0) {
        const randomCity = allCities[Math.floor(Math.random() * allCities.length)];
        if (randomCity.latitude && randomCity.longitude) {
          return [parseFloat(randomCity.latitude), parseFloat(randomCity.longitude)];
        }
      }
    }

    // If no location restrictions or couldn't find a city, use a list of major cities
    const majorCities = [
      { lat: 40.7128, lng: -74.0060 },    // New York
      { lat: 51.5074, lng: -0.1278 },     // London
      { lat: 35.6762, lng: 139.6503 },    // Tokyo
      { lat: 48.8566, lng: 2.3522 },      // Paris
      { lat: -33.8688, lng: 151.2093 },   // Sydney
      { lat: 55.7558, lng: 37.6173 },     // Moscow
      { lat: 22.3193, lng: 114.1694 },    // Hong Kong
      { lat: 1.3521, lng: 103.8198 },     // Singapore
      { lat: -23.5505, lng: -46.6333 },   // São Paulo
      { lat: 19.4326, lng: -99.1332 },    // Mexico City
      { lat: 37.7749, lng: -122.4194 },   // San Francisco
      { lat: 41.9028, lng: 12.4964 },     // Rome
      { lat: -34.6037, lng: -58.3816 },   // Buenos Aires
      { lat: 31.2304, lng: 121.4737 },    // Shanghai
      { lat: 25.2048, lng: 55.2708 },     // Dubai
    ];
    
    const randomCity = majorCities[Math.floor(Math.random() * majorCities.length)];
    return [randomCity.lat, randomCity.lng];
  };

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

  const searchForPOIs = async (coordinates: LatLngTuple): Promise<void> => {
    if (!enablePOI || poiTypes.length === 0) return;

    try {
      setIsLoading(true);
      const MAX_SEARCH_RADIUS = 50000; // 50km maximum search radius

      // Search for POIs in all selected categories
      const allPOIs = await Promise.all(
        poiTypes.filter(isValidPOIType).map(type => 
          searchPlaces(
            coordinates[0],
            coordinates[1],
            type as ValidPOIType,
            MAX_SEARCH_RADIUS
          )
        )
      );

      // Flatten and sort by distance from search coordinates
      const sortedPOIs = allPOIs
        .flat()
        .sort((a, b) => {
          const distA = Math.pow(a.latitude - coordinates[0], 2) + Math.pow(a.longitude - coordinates[1], 2);
          const distB = Math.pow(b.latitude - coordinates[0], 2) + Math.pow(b.longitude - coordinates[1], 2);
          return distA - distB;
        });

      if (sortedPOIs.length > 0) {
        // Take the closest POI
        const closestPOI = sortedPOIs[0];
        setSelectedPOIs([closestPOI]);
        setSelectedRestaurant(null); // Clear any selected restaurant
        setCoordinates([closestPOI.latitude, closestPOI.longitude]);

        // Calculate approximate distance in kilometers
        const distance = Math.sqrt(
          Math.pow((closestPOI.latitude - coordinates[0]) * 111, 2) + 
          Math.pow((closestPOI.longitude - coordinates[1]) * 111 * Math.cos(coordinates[0] * Math.PI / 180), 2)
        ).toFixed(1);
        
        toast({
          title: "Found a Place!",
          description: `${closestPOI.name} (${closestPOI.type}) - ${distance}km away`,
          duration: 3000,
        });
      } else {
        toast({
          title: "No POIs found",
          description: "No places found within 50km. Try different categories.",
          duration: 3000,
        });
      }
    } catch (error) {
      console.error("Error finding POIs:", error);
      toast({
        title: "Error",
        description: "Failed to find POIs. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFindPOIsInView = async () => {
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
          poi: selectedPOIs[0] || null,
          timestamp: Date.now()
        }, ...prev].slice(0, 5);
        return newLocations;
      });
    }

    try {
      setIsLoading(true);
      const poi = await findPOIInView(mapBounds, poiTypes);

      if (!poi) {
        toast({
          title: "No POIs found",
          description: "Try panning the map to a different area or selecting different POI types.",
          variant: "destructive",
          duration: 3000,
        });
        return;
      }

      // Map specific POI types to our categories
      const typeMapping: Record<string, string[]> = {
        food: ['restaurant', 'cafe', 'bar', 'meal_takeaway', 'bakery', 'food'],
        entertainment: ['movie_theater', 'night_club', 'amusement_park', 'casino', 'theatre', 'cinema'],
        shopping: ['shopping_mall', 'store', 'department_store', 'supermarket', 'mall'],
        tourism: ['museum', 'art_gallery', 'tourist_attraction', 'park', 'church']
      };

      const poiType = poi.type.toLowerCase();
      const matchesSelectedTypes = poiTypes.some(type => 
        typeMapping[type]?.some(specificType => 
          poiType.includes(specificType.toLowerCase())
        )
      );

      if (!matchesSelectedTypes) {
        console.log(`POI type "${poiType}" didn't match any selected types:`, poiTypes);
        toast({
          title: "No matching POIs found",
          description: "No places matching your selected types were found in view.",
          variant: "destructive",
          duration: 3000,
        });
        return;
      }

      setSelectedPOIs([poi]);
      setSelectedRestaurant(null);
      setCoordinates([poi.latitude, poi.longitude]);

      toast({
        title: "Found a place!",
        description: `${poi.name} (${poi.type})`,
        duration: 3000,
      });
    } catch (error) {
      console.error('Error finding POIs:', error);
      toast({
        title: "Error",
        description: "Failed to find POIs. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateRegularPin = (): LatLngTuple => {
    const bounds = getBoundingBox();
    let lat: number;
    let lng: number;

    if (bounds) {
      lat = bounds.minLat + Math.random() * (bounds.maxLat - bounds.minLat);
      lng = bounds.minLng + Math.random() * (bounds.maxLng - bounds.minLng);
    } else {
      lat = Math.random() * 180 - 90;
      lng = Math.random() * 360 - 180;
    }

    lat = parseFloat(lat.toFixed(precision));
    lng = parseFloat(lng.toFixed(precision));

    if (isLandOnly) {
      const onLand = checkIfOnLand(lat, lng);
      if (onLand) {
        return [lat, lng];
      } else {
        return generateRegularPin();
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

  const throwNewPin = async () => {
    // Save current location before generating new one
    if (coordinates) {
      setLastLocations(prev => {
        const newLocations = [{
          coordinates,
          restaurant: selectedRestaurant,
          poi: selectedPOIs[0] || null,
          timestamp: Date.now()
        }, ...prev].slice(0, 5); // Keep last 5 locations
        return newLocations;
      });
    }

    try {
      if (findRestaurant || (enablePOI && poiTypes.length > 0)) {
        // Keep trying different cities until we find a place
        let maxAttempts = 5;
        let attempt = 1;
        let found = false;
        let selectedPlace = null;

        while (attempt <= maxAttempts && !found) {
          const cityCoords: [number, number] = generateRandomCityCoordinates();
          setCoordinates(cityCoords); // Show the search location on the map

          selectedPlace = await findPOI(cityCoords, {
            isRestaurant: findRestaurant,
            poiTypes: findRestaurant ? [] : poiTypes,
            searchPrecision: searchPrecision
          });

          found = selectedPlace !== null;
          
          if (!found) {
            console.log(`No places found in attempt ${attempt}, trying another city...`);
            attempt++;
          }
        }

        if (!found || !selectedPlace) {
          toast({
            title: findRestaurant ? "No restaurants found" : "No POIs found",
            description: "Couldn't find any places. Please try again.",
            variant: "destructive",
            duration: 3000,
          });
          return;
        }

        // Update state with found place
        if (findRestaurant) {
          setSelectedRestaurant(selectedPlace);
          setSelectedPOIs([]);
        } else {
          setSelectedPOIs([selectedPlace]);
          setSelectedRestaurant(null);
        }
        setCoordinates([selectedPlace.latitude, selectedPlace.longitude]);

      } else {
        // Regular pin throw
        setSelectedRestaurant(null);
        setSelectedPOIs([]);
        const newCoordinates = generateRegularPin();
        setCoordinates(newCoordinates);
      }
    } catch (error) {
      console.error("Error generating new pin:", error);
      toast({
        title: "Error",
        description: "Failed to generate location. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
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

  const handleFindRestaurantInArea = async () => {
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
          poi: selectedPOIs[0] || null,
          timestamp: Date.now()
        }, ...prev].slice(0, 5);
        return newLocations;
      });
    }

    try {
      setIsLoading(true);
      const selectedPlace = await findRestaurantInArea(mapBounds, searchPrecision);

      if (!selectedPlace) {
        toast({
          title: "No restaurants found",
          description: "Try adjusting the search area or precision.",
          duration: 3000,
        });
        return;
      }

      setSelectedRestaurant(selectedPlace);
      setSelectedPOIs([]);
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

  const handleFindRestaurantsNearMe = async () => {
    try {
      setIsLoading(true);
      // Save current location before searching
      if (coordinates) {
        setLastLocations(prev => {
          const newLocations = [{
            coordinates,
            restaurant: selectedRestaurant,
            poi: selectedPOIs[0] || null,
            timestamp: Date.now()
          }, ...prev].slice(0, 5);
          return newLocations;
        });
      }

      // Get user's current location
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });

      const selectedPlace = await findRestaurantsNearMe(position);

      if (!selectedPlace) {
        toast({
          title: "No restaurants found",
          description: "No restaurants found in your area.",
          duration: 3000,
        });
        return;
      }

      setSelectedRestaurant(selectedPlace);
      setSelectedPOIs([]);
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

  const handleFindRandomPOI = async () => {
    if (!mapBounds) {
      toast({
        title: "Error",
        description: "Please wait for the map to load completely.",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    try {
      setIsLoading(true);
      
      // Save current location before searching
      if (coordinates) {
        setLastLocations(prev => {
          const newLocations = [{
            coordinates,
            restaurant: selectedRestaurant,
            poi: selectedPOIs[0] || null,
            timestamp: Date.now()
          }, ...prev].slice(0, 5);
          return newLocations;
        });
      }

      const selectedPOI = await findRandomPOI(mapBounds, poiTypes);

      if (!selectedPOI) {
        toast({
          title: "No POIs found",
          description: "Try panning the map to a different area or selecting different POI types.",
          variant: "destructive",
          duration: 3000,
        });
        return;
      }

      setSelectedPOIs([selectedPOI]);
      setSelectedRestaurant(null);
      setCoordinates([selectedPOI.latitude, selectedPOI.longitude]);

      toast({
        title: "Found a place!",
        description: `${selectedPOI.name} (${selectedPOI.type})`,
        duration: 3000,
      });
    } catch (error) {
      console.error("Error finding random POI:", error);
      toast({
        title: "Error",
        description: "Failed to find a random POI. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="w-full mx-auto">
        <div className="flex gap-8">
          <div className="w-3/4">
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
                  <div className="grid grid-cols-5 gap-6">
                    {/* Left Column - Coordinates */}
                    <div className="col-span-2">
                      <h3 className="text-sm font-medium mb-2">Coordinates</h3>
                      <Card className="border-0 shadow-none bg-muted/50">
                        <CardContent className="p-3 space-y-2">
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                              <span className="font-medium">Latitude:</span> {coordinates && coordinates[0]?.toFixed(6)}
                            </p>
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                              <span className="font-medium">Longitude:</span> {coordinates && coordinates[1]?.toFixed(6)}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Right Column - Restaurant/POI Info */}
                    <div className="col-span-3">
                      <h3 className="text-sm font-medium mb-2">
                        {selectedRestaurant
                          ? "Restaurant Details"
                          : selectedPOIs.length > 0
                          ? "POI Details"
                          : "Points of Interest"}
                      </h3>
                      {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                          <span className="ml-3 text-sm text-muted-foreground">Finding places...</span>
                        </div>
                      ) : selectedRestaurant ? (
                        <Card className="bg-card text-card-foreground border">
                          <CardContent className="p-4 space-y-4">
                            <div className="space-y-2">
                              <div className="flex justify-between items-start gap-2">
                                <h2 className="text-base font-semibold">{selectedRestaurant.name}</h2>
                                {selectedRestaurant.openingHours && (
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-full text-xs font-medium",
                                    checkIfOpen(selectedRestaurant.openingHours) 
                                      ? "bg-green-500/20 text-green-500" 
                                      : "bg-red-500/20 text-red-500"
                                  )}>
                                    {checkIfOpen(selectedRestaurant.openingHours) ? "Open Now" : "Closed"}
                                  </span>
                                )}
                              </div>
                              {selectedRestaurant.cuisine && (
                                <p className="text-sm text-muted-foreground">Cuisine: {selectedRestaurant.cuisine}</p>
                              )}
                            </div>

                            <div className="space-y-3">
                              <div className="flex items-start gap-2">
                                <span className="text-base">📍</span>
                                <p className="text-sm text-muted-foreground flex-1">
                                  {selectedRestaurant.address}
                                </p>
                              </div>

                              {selectedRestaurant.openingHours && (
                                <div className="flex items-start gap-2">
                                  <span className="text-base">🕒</span>
                                  <div className="text-sm text-muted-foreground flex-1 whitespace-pre-line">
                                    {selectedRestaurant.openingHours}
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="flex gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="flex-1 h-8 text-xs"
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
                                  size="sm"
                                  className="flex-1 h-8 text-xs"
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
                      ) : selectedPOIs.length > 0 ? (
                        <Card className="bg-card text-card-foreground border">
                          <CardContent className="p-4 space-y-4">
                            <div className="space-y-2">
                              <div className="flex justify-between items-start gap-2">
                                <h2 className="text-base font-semibold">{selectedPOIs[0].name}</h2>
                                {selectedPOIs[0].openingHours && (
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-full text-xs font-medium",
                                    checkIfOpen(selectedPOIs[0].openingHours) 
                                      ? "bg-green-500/20 text-green-500" 
                                      : "bg-red-500/20 text-red-500"
                                  )}>
                                    {checkIfOpen(selectedPOIs[0].openingHours) ? "Open Now" : "Closed"}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">Type: {selectedPOIs[0].type}</p>
                            </div>

                            <div className="space-y-3">
                              <div className="flex items-start gap-2">
                                <span className="text-base">📍</span>
                                <p className="text-sm text-muted-foreground flex-1">
                                  {selectedPOIs[0].address}
                                </p>
                              </div>

                              {selectedPOIs[0].openingHours && (
                                <div className="flex items-start gap-2">
                                  <span className="text-base">🕒</span>
                                  <div className="text-sm text-muted-foreground flex-1 whitespace-pre-line">
                                    {selectedPOIs[0].openingHours}
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="flex gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="flex-1 h-8 text-xs"
                                asChild
                              >
                                <a 
                                  href={`https://www.google.com/maps/dir/?api=1&destination=${selectedPOIs[0].latitude},${selectedPOIs[0].longitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Get Directions
                                </a>
                              </Button>
                              {selectedPOIs[0].website && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="flex-1 h-8 text-xs"
                                  asChild
                                >
                                  <a 
                                    href={selectedPOIs[0].website}
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
                      ) : (
                        <Card className="bg-card text-card-foreground border">
                          <CardContent className="p-3">
                            <div className="flex flex-col items-center justify-center text-center space-y-1.5 py-2">
                              <span className="text-xl">🎯</span>
                              <p className="text-sm font-medium">No Places Selected</p>
                              <p className="text-xs text-muted-foreground">
                                Use the settings panel to find restaurants or points of interest
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <p>No location selected yet</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="mt-8">
              <CardContent className="p-0">
                <div className="h-[600px] w-full relative">
                  <CoordinateOverlay coordinates={coordinates} />
                  <MapContainer
                    center={[0, 0]}
                    zoom={2}
                    style={{ height: "100%", width: "100%" }}
                    zoomControl={false}
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
                    {coordinates && (
                      <>
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
                        {selectedPOIs.map((poi, index) => (
                          <Marker
                            key={`${poi.id}-${index}`}
                            position={[poi.latitude, poi.longitude]}
                            icon={L.divIcon({
                              html: getPOIIcon(poi.type),
                              className: 'custom-pin',
                              iconSize: [30, 30],
                              iconAnchor: [15, 30],
                              popupAnchor: [0, -30],
                            })}
                          >
                            <Popup>
                              <div>
                                <h3 className="font-bold mb-2">{poi.name}</h3>
                                <p className="text-sm text-muted-foreground">
                                  {poi.type}
                                  {poi.address && (
                                    <span className="block mt-1">{poi.address}</span>
                                  )}
                                  {poi.openingHours && (
                                    <div className="mt-2 border-t pt-2">
                                      <span className="block font-medium mb-1">Opening Hours:</span>
                                      <span className="block whitespace-pre-line text-sm">
                                        {poi.openingHours}
                                      </span>
                                    </div>
                                  )}
                                </p>
                                <div className="flex gap-2 mt-2 justify-end">
                                  <a 
                                    href={`https://www.google.com/maps/dir/?api=1&destination=${poi.latitude},${poi.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline text-sm"
                                  >
                                    Get Directions
                                  </a>
                                  {poi.website && (
                                    <a 
                                      href={poi.website}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary hover:underline text-sm"
                                    >
                                      Website
                                    </a>
                                  )}
                                </div>
                              </div>
                            </Popup>
                          </Marker>
                        ))}
                      </>
                    )}
                    <RecenterMap
                      coordinates={coordinates}
                      selectedCity={selectedCity}
                      selectedState={selectedState}
                      selectedCountry={selectedCountry}
                      isRestaurant={!!selectedRestaurant}
                      isPOI={selectedPOIs.length > 0}
                      onMapMoved={setMapBounds}
                    />
                  </MapContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="w-1/4 space-y-6">
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
              poiTypes={poiTypes}
              setPoiTypes={setPoiTypes}
              isLoading={isLoading}
              findRestaurantsNearMe={handleFindRestaurantsNearMe}
              searchPrecision={searchPrecision}
              setSearchPrecision={setSearchPrecision}
              findPOIsInView={handleFindPOIsInView}
              findRandomPOI={handleFindRandomPOI}
            />

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
                              setSelectedPOIs(location.poi ? [location.poi] : []);
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
        </div>
      </div>
    </div>
  );
}

// Helper function to get POI icons
const getPOIIcon = (type: string): string => {
  const typeMap: Record<string, string> = {
    'food': '🍽️',
    'entertainment': '🎭',
    'shopping': '🛍️',
    'tourism': '🏛️',
    'restaurant': '🍽️',
    'cafe': '☕',
    'bar': '🍺',
    'cinema': '🎬',
    'theatre': '🎭',
    'museum': '🏛️',
    'mall': '🛍️',
    'park': '🌳',
    'default': '📍'
  };
  return typeMap[type.toLowerCase()] || typeMap.default;
};
