let googleMapsPromise: Promise<void> | null = null;

async function loadGoogleMaps() {
  if (googleMapsPromise) return googleMapsPromise;
  
  googleMapsPromise = new Promise<void>((resolve, reject) => {
    // Check if Google Maps is already loaded
    if (window.google?.maps) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_PLACES_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

// Ensure TypeScript knows about the google object
declare global {
  interface Window {
    google: typeof google;
  }
}

export function checkIfOpen(openingHours: string | undefined): boolean {
  if (!openingHours) return false;
  
  const now = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const currentDay = days[now.getDay()];
  const currentTime = now.getHours() * 100 + now.getMinutes();

  const dayHours = openingHours.split('\n').find(line => line.startsWith(currentDay));
  if (!dayHours) return false;

  const timeRanges = dayHours.split(': ')[1];
  if (!timeRanges) return false;

  return timeRanges.split(', ').some(range => {
    const [start, end] = range.split('-').map(time => {
      const [hours, minutes] = time.trim().split(':').map(Number);
      return hours * 100 + (minutes || 0);
    });
    return currentTime >= start && currentTime <= end;
  });
}

export function formatOpeningHours(hours: string | undefined): string {
  if (!hours) return '';
  
  // Split into lines and parse each day's hours
  const lines = hours.split('\n').map(line => {
    const parts = line.split(': ');
    return { 
      day: parts[0] || '', 
      times: parts[1] || '' 
    };
  });
  
  // Check if all days have the same hours
  const allSameHours = lines.every(line => line.times === lines[0].times);
  if (allSameHours && lines.length > 0) {
    return `Daily: ${lines[0].times}`;
  }
  
  // Group days with the same hours
  const hourGroups = new Map<string, string[]>();
  lines.forEach(({ day, times }) => {
    const existingGroup = Array.from(hourGroups.entries()).find(([hours]) => hours === times);
    if (existingGroup) {
      existingGroup[1].push(day);
    } else {
      hourGroups.set(times, [day]);
    }
  });
  
  // Format each group
  return Array.from(hourGroups.entries())
    .map(([times, days]) => {
      if (days.length === 1) {
        return `${days[0].substring(0, 3)}: ${times}`;
      }
      
      // For consecutive days, use a range
      const firstDay = days[0];
      const lastDay = days[days.length - 1];
      const isConsecutive = days.length === (
        days.reduce((acc, day) => Math.max(acc, getDayIndex(day)), 0) -
        days.reduce((acc, day) => Math.min(acc, getDayIndex(day)), 6) + 1
      );
      
      if (isConsecutive) {
        return `${firstDay.substring(0, 3)}-${lastDay.substring(0, 3)}: ${times}`;
      }
      
      // If not consecutive, list all days
      return `${days.map(d => d.substring(0, 3)).join(', ')}: ${times}`;
    })
    .join('\n');
}

// Helper function to get day index (Sunday = 0, Monday = 1, etc.)
function getDayIndex(day: string): number {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days.indexOf(day);
}

// Format amenity type by splitting underscores and capitalizing words.
function formatAmenityType(type: string | undefined): string {
  if (!type) return 'Unknown';
  
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function formatCuisine(cuisine: string | undefined): string | undefined {
  if (!cuisine) return undefined;
  
  return cuisine
    .split(/[,;_]/) // Split by commas, semicolons, and underscores
    .map(c => c.trim())
    .filter(c => c.length > 0) // Remove empty strings
    .map(c => c.charAt(0).toUpperCase() + c.slice(1).toLowerCase()) // Proper capitalization
    .join(', ');
}

// --- Interfaces ---

export interface Place {
  id: string; // Google Place IDs are strings
  name: string;
  latitude: number;
  longitude: number;
  type: string;
  website?: string;
  cuisine?: string;
  openingHours?: string;
  address?: string;
  phone?: string;
  email?: string;
}

export interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

// --- Google Places API functions ---

/**
 * Uses the Google Places Nearby Search endpoint to find places matching
 * one or more types near the specified coordinates.
 */
export const searchNearby = async (
  lat: number,
  lon: number,
  radius: number = 1000,
  types: string[] = ['restaurant', 'cafe', 'bar', 'park'],
  maxResults: number = 20
): Promise<Place[]> => {
  // Ensure Google Maps is loaded
  await loadGoogleMaps();
  
  // Create a promise that resolves when the places service returns results
  return new Promise((resolve, reject) => {
    const location = new google.maps.LatLng(lat, lon);
    
    // Create a temporary div for the map (Places API requires a map instance)
    const mapDiv = document.createElement('div');
    const map = new google.maps.Map(mapDiv, {
      center: location,
      zoom: 12  // Changed from 15 to 12 for a more zoomed out view
    });

    const service = new google.maps.places.PlacesService(map);
    let allPlaces: Place[] = [];
    let completedRequests = 0;
    let totalRequests = types.length;
    let successfulRequests = 0;

    console.log(`Searching for types:`, types);

    // For each type, make a separate Places API request
    types.forEach(type => {
      const request = {
        location,
        radius,
        type
      };

      service.nearbySearch(request, (results, status) => {
        completedRequests++;
        console.log(`Search for type ${type} returned status: ${status}`);

        if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
          successfulRequests++;
          // Map Google Place results to our Place interface
          const places: Place[] = results.map(result => ({
            id: result.place_id || '',
            name: result.name || 'Unknown',
            latitude: result.geometry?.location?.lat() || lat,
            longitude: result.geometry?.location?.lng() || lon,
            type: result.types?.length ? formatAmenityType(result.types[0]) : formatAmenityType(type),
            website: undefined,
            cuisine: undefined,
            openingHours: undefined, // We'll need a separate getDetails call for this
            address: result.vicinity || undefined,
            phone: undefined,
            email: undefined,
          }));
          allPlaces = allPlaces.concat(places);
          console.log(`Found ${places.length} places for type ${type}`);
        } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          console.log(`No results found for type ${type}`);
        } else if (status !== google.maps.places.PlacesServiceStatus.OK) {
          console.error(`Error searching for type ${type}: ${status}`);
        }

        // If all requests are complete, process and return results
        if (completedRequests === totalRequests) {
          if (allPlaces.length === 0) {
            console.log('No places found for any type');
            resolve([]);
            return;
          }

          console.log(`Found total of ${allPlaces.length} places before deduplication`);

          // Remove duplicates based on place ID
          const uniquePlaces = new Map<string, Place>();
          for (const place of allPlaces) {
            uniquePlaces.set(place.id, place);
          }
          const uniqueArray = Array.from(uniquePlaces.values());
          console.log(`Found ${uniqueArray.length} unique places`);

          // Sort by distance from search location
          uniqueArray.sort((a, b) => {
            const distA = Math.pow(a.latitude - lat, 2) + Math.pow(a.longitude - lon, 2);
            const distB = Math.pow(b.latitude - lat, 2) + Math.pow(b.longitude - lon, 2);
            return distA - distB;
          });

          // Return all unique places, up to maxResults
          const finalResults = uniqueArray.slice(0, maxResults);
          console.log(`Returning ${finalResults.length} places`);
          resolve(finalResults);
        }
      });
    });
  });
};

/**
 * Uses the Google Place Details API to fetch the full formatted address.
 */
export const getPlaceAddress = async (place: Place): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Create a temporary div for the map
    const mapDiv = document.createElement('div');
    const map = new google.maps.Map(mapDiv, {
      center: new google.maps.LatLng(place.latitude, place.longitude),
      zoom: 15
    });

    const service = new google.maps.places.PlacesService(map);
    
    service.getDetails({
      placeId: place.id,
      fields: ['formatted_address', 'opening_hours']
    }, (result, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && result) {
        // Update the place's opening hours if available
        if (result.opening_hours?.weekday_text) {
          place.openingHours = formatOpeningHours(result.opening_hours.weekday_text.join('\n'));
        }
        resolve(result.formatted_address || 'Address not available');
      } else {
        resolve('Address not available');
      }
    });
  });
};

/**
 * Searches for places matching a specific category (food, entertainment, shopping, or tourism)
 * using type mappings for the Google Places API.
 */
export const searchPlaces = async (
  lat: number,
  lon: number,
  type: ValidPOIType,
  radius: number = 1000
): Promise<Place[]> => {
  const typeMapping: { [key in ValidPOIType]: string[] } = {
    food: ['restaurant', 'cafe', 'meal_takeaway', 'bakery'],
    bars: ['bar', 'night_club', 'pub'],
    entertainment: ['movie_theater', 'bowling_alley', 'amusement_park', 'casino', 'arcade'],
    shopping: ['clothing_store', 'shoe_store', 'jewelry_store', 'shopping_mall', 'boutique'],
    arts: ['art_gallery', 'museum', 'theater'],
    nature: ['park', 'campground', 'beach', 'national_park', 'hiking_trail'],
    tourist: ['tourist_attraction', 'theme_park', 'aquarium', 'zoo', 'landmark']
  };

  const types = typeMapping[type];
  return searchNearby(lat, lon, radius, types);
};

/**
 * Fetches additional details for a place via the Google Place Details API.
 * (This can be expanded to request more fields as needed.)
 */
export const getPlaceDetails = async (placeId: string): Promise<any> => {
  const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${apiKey}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch place details');
    }
    const data = await response.json();
    return data.result;
  } catch (error) {
    console.error('Error fetching place details:', error);
    throw error;
  }
};

// --- POI search functions ---

export type ValidPOIType = 'food' | 'bars' | 'entertainment' | 'shopping' | 'arts' | 'nature' | 'tourist';

const typeMapping: { [key in ValidPOIType]: string[] } = {
  food: ['restaurant', 'cafe', 'meal_takeaway', 'bakery'],
  bars: ['bar', 'night_club', 'pub'],
  entertainment: ['movie_theater', 'bowling_alley', 'amusement_park', 'casino', 'arcade'],
  shopping: ['clothing_store', 'shoe_store', 'jewelry_store', 'shopping_mall', 'boutique'],
  arts: ['art_gallery', 'museum', 'theater'],
  nature: ['park', 'campground', 'beach', 'national_park', 'hiking_trail'],
  tourist: ['tourist_attraction', 'theme_park', 'aquarium', 'zoo', 'landmark']
};

export const isValidPOIType = (type: string): type is ValidPOIType => {
  return ["food", "bars", "entertainment", "shopping", "arts", "nature", "tourist"].includes(type);
};

/**
 * Searches for a single POI (or restaurant) based on the provided coordinates (or bounds)
 * and options. It uses the Google Places API to fetch nearby businesses.
 */
export interface FindPOIOptions {
  searchPrecision?: 'high' | 'medium' | 'low';
  searchRadius?: number;
  isRestaurant?: boolean;
  poiTypes?: string[];
}

export const findPOI = async (
  coordinates: [number, number] | GeolocationPosition | Bounds,
  options: FindPOIOptions = {}
): Promise<Place | null> => {
  const {
    searchPrecision = 'medium',
    searchRadius: customSearchRadius,
    isRestaurant = false,
    poiTypes = []
  } = options;

  let searchLat: number;
  let searchLng: number;
  let baseRadius: number;

  // Handle different coordinate input types
  if ('coords' in coordinates) {
    // GeolocationPosition
    searchLat = coordinates.coords.latitude;
    searchLng = coordinates.coords.longitude;
    baseRadius = customSearchRadius || 5000; // Default 5km for geolocation
  } else if ('north' in coordinates) {
    // Bounds
    searchLat = (coordinates.north + coordinates.south) / 2;
    searchLng = (coordinates.east + coordinates.west) / 2;
    
    // Calculate approximate radius based on bounds
    const latDistance = (coordinates.north - coordinates.south) * 111000;
    const lngDistance = (coordinates.east - coordinates.west) * 111000 * Math.cos(searchLat * Math.PI / 180);
    baseRadius = Math.min(Math.max(Math.max(latDistance, lngDistance) / 2, 1000), 50000);
  } else {
    // [latitude, longitude]
    [searchLat, searchLng] = coordinates;
    baseRadius = customSearchRadius || 10000; // Default 10km for direct coordinates
  }

  // Configure search parameters based on precision
  const searchConfig = {
    high: { maxResults: 10, radiusMultiplier: 0.5 },
    medium: { maxResults: 30, radiusMultiplier: 1.5 },
    low: { maxResults: 500, radiusMultiplier: 2.5 }
  }[searchPrecision];

  const searchRadius = baseRadius * searchConfig.radiusMultiplier;

  // Define search tags based on type.
  const restaurantTags = [
    'restaurant',
    'cafe',
    'bar',
    'meal_takeaway',
    'bakery'
  ];

  let results: Place[] = [];

  if (isRestaurant) {
    // Search for restaurants using the restaurantTags
    results = await searchNearby(
      searchLat,
      searchLng,
      searchRadius,
      restaurantTags,
      searchConfig.maxResults
    );
  } else if (poiTypes.length > 0) {
    // Search for POIs in selected categories. Map our internal types to Google types.
    const amenities: string[] = [];
    poiTypes.forEach(type => {
      if (typeMapping[type as ValidPOIType]) {
        amenities.push(...typeMapping[type as ValidPOIType]);
      }
    });
    results = await searchNearby(searchLat, searchLng, searchRadius, amenities, searchConfig.maxResults);
  }

  if (results.length === 0) {
    return null;
  }

  // Sort by distance from the search coordinates
  results.sort((a, b) => {
    const distA = Math.pow(a.latitude - searchLat, 2) + Math.pow(a.longitude - searchLng, 2);
    const distB = Math.pow(b.latitude - searchLat, 2) + Math.pow(b.longitude - searchLng, 2);
    return distA - distB;
  });

  // For restaurants or if no POI type is specified, pick a random one from the top 10; otherwise choose the closest.
  const selectedPlace = (isRestaurant || poiTypes.length === 0)
    ? results[Math.floor(Math.random() * Math.min(results.length, 10))]
    : results[0];

  // Fetch a full address using the Place Details API
  const address = await getPlaceAddress(selectedPlace);
  return { ...selectedPlace, address };
};

/**
 * Helper function to search for a POI within a map viewport (bounds).
 * Since Google's Nearby Search does not directly support bounds, we approximate by computing
 * the center and a radius that covers the bounds.
 */
export const findPOIInView = async (bounds: Bounds, poiTypes: string[] = []): Promise<Place | null> => {
  // Ensure Google Maps is loaded first
  await loadGoogleMaps();

  // Calculate the center of the bounds
  const centerLat = (bounds.north + bounds.south) / 2;
  const centerLng = (bounds.east + bounds.west) / 2;

  // Calculate radius in meters (distance from center to corner)
  const latDistance = (bounds.north - bounds.south) * 111000;
  const lngDistance = (bounds.east - bounds.west) * 111000 * Math.cos(centerLat * Math.PI / 180);
  const radius = Math.min(Math.sqrt(Math.pow(latDistance/2, 2) + Math.pow(lngDistance/2, 2)), 50000);

  // Type mapping for Google Places API types
  const typeMapping: { [key in ValidPOIType]: string[] } = {
    food: ['restaurant', 'cafe', 'meal_takeaway', 'bakery', 'food', 'meal_delivery', 'ice_cream'],
    bars: ['bar', 'night_club', 'pub', 'liquor_store', 'brewery'],
    entertainment: [
      'movie_theater', 'bowling_alley', 'amusement_park', 'casino', 'arcade',
      'game_center', 'stadium', 'theater', 'concert_hall', 'performing_arts'
    ],
    shopping: [
      'clothing_store', 'shoe_store', 'jewelry_store', 'shopping_mall', 'boutique',
      'department_store', 'store', 'supermarket', 'convenience_store', 'book_store',
      'retail', 'market', 'shop', 'mall', 'outlet'
    ],
    arts: [
      'art_gallery', 'museum', 'theater', 'library', 'cultural_center',
      'exhibition_center', 'opera_house', 'concert_hall', 'gallery', 'arts_centre'
    ],
    nature: [
      'park', 'campground', 'beach', 'national_park', 'hiking_trail',
      'garden', 'forest', 'nature_reserve', 'botanical_garden', 'lake',
      'trail', 'outdoor', 'viewpoint', 'natural_feature'
    ],
    tourist: [
      'tourist_attraction', 'theme_park', 'aquarium', 'zoo', 'landmark',
      'point_of_interest', 'monument', 'historic_site', 'museum', 'gallery',
      'sightseeing', 'observation_deck', 'historical'
    ]
  };

  // Get only the place types for selected categories
  const selectedPlaceTypes = poiTypes
    .filter(type => typeMapping[type as ValidPOIType])
    .flatMap(type => typeMapping[type as ValidPOIType]);

  if (selectedPlaceTypes.length === 0) {
    console.log('No place types selected');
    return null;
  }

  let lastError: Error | null = null;
  let allResults: Place[] = [];

  // Try searching in different areas of the map view
  const searchPoints = [
    [centerLat, centerLng], // Center
    [bounds.north, centerLng], // Top
    [bounds.south, centerLng], // Bottom
    [centerLat, bounds.east],  // Right
    [centerLat, bounds.west]   // Left
  ];

  // Search from each point
  for (const [lat, lng] of searchPoints) {
    try {
      const results = await searchNearby(lat, lng, radius, selectedPlaceTypes, 50);
      if (results.length > 0) {
        allResults.push(...results);
      }
    } catch (error) {
      console.log(`Search failed at [${lat}, ${lng}]:`, error);
      lastError = error as Error;
    }
  }

  // Remove duplicates based on place ID
  const uniquePlaces = new Map<string, Place>();
  for (const place of allResults) {
    uniquePlaces.set(place.id, place);
  }
  allResults = Array.from(uniquePlaces.values());

  // Filter results to only include places within the bounds
  allResults = allResults.filter(place => 
    place.latitude >= bounds.south &&
    place.latitude <= bounds.north &&
    place.longitude >= bounds.west &&
    place.longitude <= bounds.east
  );

  if (allResults.length > 0) {
    // Pick a random result from the top 10 closest places to the center
    allResults.sort((a, b) => {
      const distA = Math.pow(a.latitude - centerLat, 2) + Math.pow(a.longitude - centerLng, 2);
      const distB = Math.pow(b.latitude - centerLat, 2) + Math.pow(b.longitude - centerLng, 2);
      return distA - distB;
    });

    const topPlaces = allResults.slice(0, Math.min(10, allResults.length));
    const selectedPlace = topPlaces[Math.floor(Math.random() * topPlaces.length)];
    
    // Get the address for the selected place
    const address = await getPlaceAddress(selectedPlace);
    return { ...selectedPlace, address };
  }

  console.error('No places found in the current view after searching multiple points');
  return null;
};

// --- Additional helper functions ---

export const findRandomPOI = async (
  mapBounds: Bounds,
  poiTypes: string[],
): Promise<Place | null> => {
  // Generate random coordinates anywhere in the world
  const generateRandomCoordinates = (): [number, number] => {
    const lat = Math.random() * 180 - 90;  // -90 to 90
    const lng = Math.random() * 360 - 180; // -180 to 180
    return [lat, lng];
  };

  // Try up to 5 times to find a POI
  for (let attempt = 0; attempt < 5; attempt++) {
    const coordinates = generateRandomCoordinates();
    try {
      const result = await findPOI(coordinates, {
        poiTypes,
        searchPrecision: 'low', // Use low precision to cast a wider net
        searchRadius: 50000 // 50km radius to increase chances of finding something
      });
      
      if (result) {
        return result;
      }
      console.log(`Attempt ${attempt + 1}: No POIs found at coordinates ${coordinates}, trying again...`);
    } catch (error) {
      console.log(`Attempt ${attempt + 1} failed:`, error);
    }
  }

  return null;
};

export const findClosestPOI = async (
  coordinates: [number, number],
  poiTypes: string[],
): Promise<Place | null> => {
  return findPOI(coordinates, {
    poiTypes,
    searchPrecision: 'high'
  });
};

export const findRestaurantsNearMe = async (
  position: GeolocationPosition,
): Promise<Place | null> => {
  return findPOI(position, {
    isRestaurant: true,
    searchPrecision: 'medium'
  });
};

export const findRestaurantInArea = async (
  mapBounds: Bounds,
  searchPrecision: 'high' | 'medium' | 'low' = 'medium'
): Promise<Place | null> => {
  return findPOI(mapBounds, {
    isRestaurant: true,
    searchPrecision
  });
};
  