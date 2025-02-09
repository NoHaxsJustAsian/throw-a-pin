// overpass.ts

import * as turf from "@turf/turf";
import landGeoJSON from "@/data/land.json";
import { FeatureCollection } from "geojson";

const landGeoJSONTyped = landGeoJSON as FeatureCollection;

/* ───────────────────────────────────────────────
   HELPER FUNCTIONS (client only)
   ─────────────────────────────────────────────── */

export function checkIfOpen(openingHours: string | undefined): boolean {
  if (!openingHours) return false;

  const now = new Date();
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const currentDay = days[now.getDay()];
  const currentTime = now.getHours() * 100 + now.getMinutes();

  const dayHours = openingHours.split("\n").find((line) => line.startsWith(currentDay));
  if (!dayHours) return false;

  const timeRanges = dayHours.split(": ")[1];
  if (!timeRanges) return false;

  return timeRanges.split(", ").some((range) => {
    const [start, end] = range.split("-").map((time) => {
      const [hours, minutes] = time.trim().split(":").map(Number);
      return hours * 100 + (minutes || 0);
    });
    return currentTime >= start && currentTime <= end;
  });
}

export function formatOpeningHours(hours: string | undefined): string {
  if (!hours) return "";

  // Split into lines and parse each day's hours
  const lines = hours.split("\n").map((line) => {
    const parts = line.split(": ");
    return {
      day: parts[0] || "",
      times: parts[1] || "",
    };
  });

  // Check if all days have the same hours
  const allSameHours = lines.every((line) => line.times === lines[0].times);
  if (allSameHours && lines.length > 0) {
    return `Daily: ${lines[0].times}`;
  }

  // Group days with the same hours
  const hourGroups = new Map<string, string[]>();
  lines.forEach(({ day, times }) => {
    const existingGroup = Array.from(hourGroups.entries()).find(
      ([hours]) => hours === times
    );
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
      const isConsecutive =
        days.length ===
        days.reduce((acc, day) => Math.max(acc, getDayIndex(day)), 0) -
          days.reduce((acc, day) => Math.min(acc, getDayIndex(day)), 6) +
          1;

      if (isConsecutive) {
        return `${firstDay.substring(0, 3)}-${lastDay.substring(0, 3)}: ${times}`;
      }

      // If not consecutive, list all days
      return `${days.map((d) => d.substring(0, 3)).join(", ")}: ${times}`;
    })
    .join("\n");
}

// Helper function to get day index (Sunday = 0, Monday = 1, etc.)
function getDayIndex(day: string): number {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return days.indexOf(day);
}

// Format amenity type by splitting underscores and capitalizing words.
function formatAmenityType(type: string | undefined): string {
  if (!type) return "Unknown";

  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/* ───────────────────────────────────────────────
   INTERFACES
   ─────────────────────────────────────────────── */

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

/* ───────────────────────────────────────────────
   GOOGLE API–BASED FUNCTIONS (now calling Supabase Edge Functions)
   ─────────────────────────────────────────────── */

/**
 * Instead of using the Google Maps JS API directly, we now call our
 * Supabase Edge Function to perform the nearby search.
 */
export const searchNearby = async (
  lat: number,
  lon: number,
  radius: number = 1000,
  types: string[] = ["restaurant", "cafe", "bar", "park"],
  maxResults: number = 20,
  category?: ValidPOIType
): Promise<Place[]> => {
  const response = await fetch("/api/searchNearby", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lon, radius, types, maxResults, category }),
  });
  if (!response.ok) {
    throw new Error("Failed to search nearby");
  }
  const places = await response.json();
  return places;
};

/**
 * Gets the full formatted address (and optionally opening hours)
 * by calling our Supabase Edge Function.
 */
export const getPlaceAddress = async (place: Place): Promise<string> => {
  const response = await fetch("/api/getPlaceAddress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      placeId: place.id,
      lat: place.latitude,
      lng: place.longitude,
    }),
  });
  if (!response.ok) {
    throw new Error("Failed to get place address");
  }
  const data = await response.json();
  // Optionally update the openingHours property if returned:
  if (data.opening_hours && Array.isArray(data.opening_hours)) {
    place.openingHours = formatOpeningHours(data.opening_hours.join("\n"));
  }
  return data.formatted_address || "Address not available";
};

/**
 * Gets additional details for a place.
 */
export const getPlaceDetails = async (placeId: string): Promise<any> => {
  const response = await fetch("/api/getPlaceDetails", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ placeId }),
  });
  if (!response.ok) {
    throw new Error("Failed to get place details");
  }
  const data = await response.json();
  return data;
};

/**
 * Checks if the destination is drivable from the origin by calling
 * our Supabase Edge Function (which uses the Google Directions API).
 */
export const isDrivableTo = async (
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<boolean> => {
  const response = await fetch("/api/isDrivableTo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ origin, destination }),
  });
  if (!response.ok) {
    throw new Error("Failed to check drivable route");
  }
  const data = await response.json();
  return data.isDrivable;
};

/* ───────────────────────────────────────────────
   TYPE MAPPING & POI SEARCH FUNCTIONS
   ─────────────────────────────────────────────── */

export type ValidPOIType =
  | "food"
  | "bars"
  | "entertainment"
  | "shopping"
  | "arts"
  | "nature"
  | "tourist";

const typeMapping: { [key in ValidPOIType]: string[] } = {
  food: [
    "restaurant",
    "cafe",
    "meal_takeaway",
    "bakery",
    "food",
    "meal_delivery",
    "ice_cream",
  ],
  bars: ["bar", "night_club", "pub", "liquor_store", "brewery"],
  entertainment: [
    "movie_theater",
    "bowling_alley",
    "amusement_park",
    "casino",
    "arcade",
    "game_center",
    "stadium",
    "theater",
    "concert_hall",
    "performing_arts",
  ],
  shopping: [
    "clothing_store",
    "shoe_store",
    "jewelry_store",
    "shopping_mall",
    "boutique",
    "department_store",
    "store",
    "book_store",
    "retail",
    "shop",
    "mall",
    "outlet",
  ],
  arts: [
    "art_gallery",
    "museum",
    "theater",
    "library",
    "cultural_center",
    "exhibition_center",
    "opera_house",
    "concert_hall",
    "gallery",
    "arts_centre",
  ],
  nature: [
    "park",
    "campground",
    "beach",
    "national_park",
    "hiking_trail",
    "garden",
    "forest",
    "nature_reserve",
    "botanical_garden",
    "lake",
    "trail",
    "outdoor",
    "viewpoint",
    "natural_feature",
  ],
  tourist: [
    "tourist_attraction",
    "theme_park",
    "aquarium",
    "zoo",
    "landmark",
    "monument",
    "historic_site",
    "museum",
    "gallery",
    "sightseeing",
    "observation_deck",
    "historical",
  ],
};

/**
 * Searches for a single POI (or restaurant) based on the provided coordinates
 * and options. (Note that we use our edge function inside searchNearby above.)
 */
export interface FindPOIOptions {
  searchPrecision?: "high" | "medium" | "low";
  searchRadius?: number;
  isRestaurant?: boolean;
  poiTypes?: string[];
}

export const findPOI = async (
  coordinates: [number, number] | GeolocationPosition | Bounds,
  options: FindPOIOptions = {}
): Promise<Place | null> => {
  const {
    searchPrecision = "medium",
    searchRadius: customSearchRadius,
    isRestaurant = false,
    poiTypes = [],
  } = options;

  let searchLat: number;
  let searchLng: number;
  let baseRadius: number;

  // Handle different coordinate input types
  if ("coords" in coordinates) {
    // GeolocationPosition
    searchLat = coordinates.coords.latitude;
    searchLng = coordinates.coords.longitude;
    baseRadius = customSearchRadius || 5000; // Default 5km for geolocation
  } else if ("north" in coordinates) {
    // Bounds
    searchLat = (coordinates.north + coordinates.south) / 2;
    searchLng = (coordinates.east + coordinates.west) / 2;
    const latDistance = (coordinates.north - coordinates.south) * 111000;
    const lngDistance =
      (coordinates.east - coordinates.west) *
      111000 *
      Math.cos((searchLat * Math.PI) / 180);
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
    low: { maxResults: 500, radiusMultiplier: 2.5 },
  }[searchPrecision];

  const searchRadius = baseRadius * searchConfig.radiusMultiplier;

  // Define search tags based on type.
  const restaurantTags = [
    "restaurant",
    "cafe",
    "bar",
    "meal_takeaway",
    "bakery",
  ];

  let results: Place[] = [];

  if (isRestaurant) {
    // Search for restaurants using restaurantTags
    results = await searchNearby(
      searchLat,
      searchLng,
      searchRadius,
      restaurantTags,
      searchConfig.maxResults
    );
  } else if (poiTypes.length > 0) {
    // Search for POIs in selected categories.
    const amenities: string[] = [];
    poiTypes.forEach((type) => {
      if (typeMapping[type as ValidPOIType]) {
        amenities.push(...typeMapping[type as ValidPOIType]);
      }
    });
    results = await searchNearby(
      searchLat,
      searchLng,
      searchRadius,
      amenities,
      searchConfig.maxResults
    );
  }

  if (results.length === 0) {
    return null;
  }

  // Sort by distance from the search coordinates
  results.sort((a, b) => {
    const distA =
      Math.pow(a.latitude - searchLat, 2) + Math.pow(a.longitude - searchLng, 2);
    const distB =
      Math.pow(b.latitude - searchLat, 2) + Math.pow(b.longitude - searchLng, 2);
    return distA - distB;
  });

  // For restaurants or if no POI type is specified, pick a random one from the top 10;
  // otherwise choose the closest.
  const selectedPlace =
    isRestaurant || poiTypes.length === 0
      ? results[Math.floor(Math.random() * Math.min(results.length, 10))]
      : results[0];

  // Fetch a full address using our edge function
  const address = await getPlaceAddress(selectedPlace);
  return { ...selectedPlace, address };
};

/**
 * Helper function to search for a POI within a map viewport (bounds).
 */
export const findPOIInView = async (
  bounds: Bounds,
  poiTypes: string[] = []
): Promise<Place | null> => {
  const centerLat = (bounds.north + bounds.south) / 2;
  const centerLng = (bounds.east + bounds.west) / 2;
  const latDistance = (bounds.north - bounds.south) * 111000;
  const lngDistance =
    (bounds.east - bounds.west) * 111000 * Math.cos((centerLat * Math.PI) / 180);
  const radius = Math.min(
    Math.sqrt(Math.pow(latDistance / 2, 2) + Math.pow(lngDistance / 2, 2)),
    50000
  );

  const typeMappingForView: { [key in ValidPOIType]: string[] } = {
    food: [
      "restaurant",
      "cafe",
      "meal_takeaway",
      "bakery",
      "food",
      "meal_delivery",
      "ice_cream",
    ],
    bars: ["bar", "night_club", "pub", "liquor_store", "brewery"],
    entertainment: [
      "movie_theater",
      "bowling_alley",
      "amusement_park",
      "casino",
      "arcade",
      "game_center",
      "stadium",
      "theater",
      "concert_hall",
      "performing_arts",
    ],
    shopping: [
      "clothing_store",
      "shoe_store",
      "jewelry_store",
      "shopping_mall",
      "boutique",
      "department_store",
      "store",
      "supermarket",
      "convenience_store",
      "book_store",
      "retail",
      "market",
      "shop",
      "mall",
      "outlet",
    ],
    arts: [
      "art_gallery",
      "museum",
      "theater",
      "library",
      "cultural_center",
      "exhibition_center",
      "opera_house",
      "concert_hall",
      "gallery",
      "arts_centre",
    ],
    nature: [
      "park",
      "campground",
      "beach",
      "national_park",
      "hiking_trail",
      "garden",
      "forest",
      "nature_reserve",
      "botanical_garden",
      "lake",
      "trail",
      "outdoor",
      "viewpoint",
      "natural_feature",
    ],
    tourist: [
      "tourist_attraction",
      "theme_park",
      "aquarium",
      "zoo",
      "landmark",
      "point_of_interest",
      "monument",
      "historic_site",
      "museum",
      "gallery",
      "sightseeing",
      "observation_deck",
      "historical",
    ],
  };

  const selectedPlaceTypes = poiTypes
    .filter((type) => typeMappingForView[type as ValidPOIType])
    .flatMap((type) => typeMappingForView[type as ValidPOIType]);

  if (selectedPlaceTypes.length === 0) {
    console.log("No place types selected");
    return null;
  }

  let allResults: Place[] = [];
  const searchPoints: [number, number][] = [
    [centerLat, centerLng],
    [bounds.north, centerLng],
    [bounds.south, centerLng],
    [centerLat, bounds.east],
    [centerLat, bounds.west],
  ];

  for (const [lat, lng] of searchPoints) {
    try {
      const results = await searchNearby(lat, lng, radius, selectedPlaceTypes, 50);
      if (results.length > 0) {
        allResults.push(...results);
      }
    } catch (error) {
      console.log(`Search failed at [${lat}, ${lng}]:`, error);
    }
  }

  // Remove duplicates based on place ID
  const uniquePlaces = new Map<string, Place>();
  for (const place of allResults) {
    uniquePlaces.set(place.id, place);
  }
  allResults = Array.from(uniquePlaces.values());

  // Filter to only include places within the bounds
  allResults = allResults.filter(
    (place) =>
      place.latitude >= bounds.south &&
      place.latitude <= bounds.north &&
      place.longitude >= bounds.west &&
      place.longitude <= bounds.east
  );

  if (allResults.length > 0) {
    allResults.sort((a, b) => {
      const distA =
        Math.pow(a.latitude - centerLat, 2) + Math.pow(a.longitude - centerLng, 2);
      const distB =
        Math.pow(b.latitude - centerLat, 2) + Math.pow(b.longitude - centerLng, 2);
      return distA - distB;
    });
    const topPlaces = allResults.slice(0, Math.min(10, allResults.length));
    const selectedPlace = topPlaces[Math.floor(Math.random() * topPlaces.length)];
    const address = await getPlaceAddress(selectedPlace);
    return { ...selectedPlace, address };
  }

  console.error("No places found in the current view after searching multiple points");
  return null;
};

/* ───────────────────────────────────────────────
   ADDITIONAL HELPER FUNCTIONS (mostly unchanged)
   ─────────────────────────────────────────────── */

export const findDrivableLocation = async (
  userLocation: { lat: number; lng: number },
  maxAttempts: number = 10,
  maxDistance: number = 2000 // km
): Promise<[number, number] | null> => {
  // Convert km to degrees (approximation)
  const maxDegrees = maxDistance / 111;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.random() * maxDegrees;
    const newLat = userLocation.lat + distance * Math.cos(angle);
    const newLng = userLocation.lng + distance * Math.sin(angle);

    // Check if point is on land
    const point = turf.point([newLng, newLat]);
    const isOnLand = landGeoJSONTyped.features.some((feature: any) =>
      turf.booleanPointInPolygon(point, feature)
    );
    if (!isOnLand) {
      console.log(`Attempt ${attempt + 1}: Point not on land, trying again...`);
      continue;
    }

    // Check drivable via our edge function
    const drivable = await isDrivableTo(userLocation, { lat: newLat, lng: newLng });
    if (drivable) {
      return [newLat, newLng];
    }
    console.log(`Attempt ${attempt + 1}: Location not drivable, trying again...`);
  }

  return null;
};

export const findRandomPOI = async (
  mapBounds: Bounds,
  poiTypes: string[],
  options?: {
    roadtripMode?: boolean;
    userLocation?: { lat: number; lng: number };
  }
): Promise<Place | null> => {
  const generateRandomCoordinates = async (): Promise<[number, number]> => {
    if (options?.roadtripMode && options.userLocation) {
      const drivableLocation = await findDrivableLocation(options.userLocation);
      if (drivableLocation) {
        return drivableLocation;
      }
      console.log("No drivable location found, falling back to regular random coordinates");
    }
    const lat = Math.random() * 180 - 90;
    const lng = Math.random() * 360 - 180;
    return [lat, lng];
  };

  for (let attempt = 0; attempt < 5; attempt++) {
    const coordinates = await generateRandomCoordinates();
    try {
      const result = await findPOI(coordinates, {
        poiTypes,
        searchPrecision: "low",
        searchRadius: 50000,
      });
      if (result) {
        if (options?.roadtripMode && options.userLocation) {
          const drivable = await isDrivableTo(options.userLocation, {
            lat: result.latitude,
            lng: result.longitude,
          });
          if (!drivable) {
            console.log("Found POI is not drivable, trying again...");
            continue;
          }
        }
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
  poiTypes: string[]
): Promise<Place | null> => {
  return findPOI(coordinates, {
    poiTypes,
    searchPrecision: "high",
  });
};

export const findRestaurantsNearMe = async (
  position: GeolocationPosition
): Promise<Place | null> => {
  return findPOI(position, {
    isRestaurant: true,
    searchPrecision: "medium",
  });
};

export const findRestaurantInArea = async (
  mapBounds: Bounds,
  searchPrecision: "high" | "medium" | "low" = "medium"
): Promise<Place | null> => {
  return findPOI(mapBounds, {
    isRestaurant: true,
    searchPrecision,
  });
};
