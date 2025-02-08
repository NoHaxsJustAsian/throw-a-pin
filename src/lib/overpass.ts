function formatOpeningHours(hours: string): string {
  if (!hours) return '';

  // Replace common abbreviations
  const formatted = hours
    .replace(/Mo/g, 'Monday')
    .replace(/Tu/g, 'Tuesday')
    .replace(/We/g, 'Wednesday')
    .replace(/Th/g, 'Thursday')
    .replace(/Fr/g, 'Friday')
    .replace(/Sa/g, 'Saturday')
    .replace(/Su/g, 'Sunday')
    .replace(/,/g, ', ')
    .replace(/;/g, '\n')
    .replace(/\|\|/g, ' and ')
    .replace(/\s*-\s*/g, '-');

  // Split into lines and format each line
  const lines = formatted.split('\n').map(line => {
    // If line contains multiple days (e.g., "Monday-Friday")
    if (line.includes('-')) {
      const [days, times] = line.split(/\s+(?=[0-9])/);
      return `${days}: ${times}`;
    }
    // If it's a single day
    const parts = line.split(/\s+(?=[0-9])/);
    if (parts.length === 2) {
      return `${parts[0]}: ${parts[1]}`;
    }
    return line;
  });

  return lines.join('\n');
}

// Add new formatting function for amenity types
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

interface OverpassResult {
  id: number;
  lat: number;
  lon: number;
  tags: {
    name?: string;
    amenity?: string;
    leisure?: string;
    tourism?: string;
    shop?: string;
    cuisine?: string;
    phone?: string;
    website?: string;
    opening_hours?: string;
    'contact:phone'?: string;
    'contact:website'?: string;
    'contact:email'?: string;
    'social:instagram'?: string;
    image?: string;
    [key: string]: string | undefined;
  };
}

interface OverpassResponse {
  elements: OverpassResult[];
}

async function getFormattedAddress(lat: number, lon: number): Promise<string> {
  try {
    const response = await fetch(
      `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lon}&key=${import.meta.env.VITE_OPENCAGE_API_KEY}&language=en`
    );
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const result = data.results[0];
      return result.formatted;
    }
    return 'Address not available';
  } catch (error) {
    console.error('Error fetching address:', error);
    return 'Address not available';
  }
}

export interface Place {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  type: string;
  website?: string;
  cuisine?: string;
  openingHours?: string;
  address?: string;
}

export const searchNearby = async (
  lat: number,
  lon: number,
  radius: number = 1000,
  amenities: string[] = ['restaurant', 'cafe', 'bar', 'park'],
  maxResults: number = 20
): Promise<Place[]> => {
  // Make the query more specific to actual food establishments
  const query = `
    [out:json][timeout:10];
    (
      // Restaurants and food places with names
      nwr[name][amenity~"^(restaurant|cafe|coffee_shop|fast_food|bar|pub|food_court|ice_cream)$"](around:${radius},${lat},${lon});
      // Places with cuisine tag but only if they are food-related
      nwr[name][cuisine][amenity~"^(restaurant|cafe|coffee_shop|fast_food|bar|pub|food_court)$"](around:${radius},${lat},${lon});
    );
    out body qt;
    >;
    out skel qt;
  `;

  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: OverpassResponse = await response.json();
    
    // Filter and sort results
    const places = data.elements
      .filter(element => {
        // Must have a name and be a food establishment
        if (!element.tags?.name) return false;
        
        // Check if it's actually a food establishment
        const isFood = element.tags.amenity === 'restaurant' ||
                      element.tags.amenity === 'cafe' ||
                      element.tags.amenity === 'coffee_shop' ||
                      element.tags.amenity === 'fast_food' ||
                      element.tags.amenity === 'bar' ||
                      element.tags.amenity === 'pub' ||
                      element.tags.amenity === 'food_court' ||
                      element.tags.amenity === 'ice_cream';
                      
        // Must have either a valid food amenity or a cuisine tag
        return isFood || (element.tags.cuisine && element.tags.amenity);
      })
      .sort((a, b) => {
        const distA = Math.pow(a.lat - lat, 2) + Math.pow(a.lon - lon, 2);
        const distB = Math.pow(b.lat - lat, 2) + Math.pow(b.lon - lon, 2);
        return distA - distB;
      })
      .slice(0, maxResults)
      .map(element => {
        const tags = element.tags;
        return {
          id: element.id,
          name: tags.name || 'Unnamed Location',
          latitude: element.lat,
          longitude: element.lon,
          type: formatAmenityType(tags.amenity) || 'Food',
          website: tags.website || tags['contact:website'],
          cuisine: formatCuisine(tags.cuisine),
          openingHours: tags.opening_hours ? formatOpeningHours(tags.opening_hours) : undefined,
        };
      });

    return places;
  } catch (error) {
    console.error('Error fetching from Overpass:', error);
    throw error;
  }
};

// Function to get address for a specific place when needed
export const getPlaceAddress = async (place: Place): Promise<string> => {
  // First try to get address from OpenStreetMap
  const query = `
    [out:json];
    (
      nwr(${place.id});
    );
    out body;
  `;

  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (response.ok) {
      const data: OverpassResponse = await response.json();
      const element = data.elements[0];
      
      if (element?.tags) {
        const tags = element.tags;
        
        // Try to get full address first
        if (tags['addr:full']) {
          return tags['addr:full'];
        }

        // Try to build address from components
        const addressParts = [];
        
        // Try street address
        if (tags['addr:housenumber'] && tags['addr:street']) {
          addressParts.push(`${tags['addr:housenumber']} ${tags['addr:street']}`);
        } else if (tags['addr:street']) {
          addressParts.push(tags['addr:street']);
        }
        
        // Add neighborhood/suburb if available
        if (tags['addr:suburb'] || tags['addr:neighborhood']) {
          addressParts.push(tags['addr:suburb'] || tags['addr:neighborhood']);
        }
        
        // Add city
        if (tags['addr:city']) {
          addressParts.push(tags['addr:city']);
        }
        
        // Add state/province
        if (tags['addr:state']) {
          addressParts.push(tags['addr:state']);
        }
        
        // Add postcode
        if (tags['addr:postcode']) {
          addressParts.push(tags['addr:postcode']);
        }

        if (addressParts.length > 0) {
          return addressParts.join(', ');
        }
      }
    }

    // Only use OpenCage as last resort for the displayed place
    console.log('Falling back to OpenCage for address lookup');
    return getFormattedAddress(place.latitude, place.longitude);
  } catch (error) {
    console.error('Error fetching address:', error);
    return 'Address not available';
  }
};

// Helper function to search for specific types of places
export const searchPlaces = async (
  lat: number,
  lon: number,
  type: 'food' | 'entertainment' | 'shopping' | 'tourism',
  radius: number = 1000
) => {
  const typeQueries = {
    food: ['restaurant', 'cafe', 'bar', 'fast_food', 'pub', 'food_court'],
    entertainment: ['cinema', 'theatre', 'nightclub', 'arts_centre', 'casino'],
    shopping: ['mall', 'supermarket', 'marketplace', 'department_store'],
    tourism: ['museum', 'gallery', 'attraction', 'viewpoint', 'theme_park'],
  };

  return searchNearby(lat, lon, radius, typeQueries[type]);
};

// Function to get place details
export const getPlaceDetails = async (
  lat: number,
  lon: number,
  radius: number = 100 // Smaller radius for exact matches
) => {
  const query = `
    [out:json][timeout:25];
    (
      node(around:${radius},${lat},${lon});
      way(around:${radius},${lat},${lon});
      relation(around:${radius},${lat},${lon});
    );
    out body;
    >;
    out skel qt;
  `;

  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: query,
    });

    if (!response.ok) {
      throw new Error('Failed to fetch place details');
    }

    const data: OverpassResponse = await response.json();
    const place = data.elements.find(element => element.tags && element.tags.name);

    if (!place) {
      return null;
    }

    return {
      id: place.id,
      name: place.tags.name || 'Unnamed Location',
      latitude: place.lat,
      longitude: place.lon,
      type: place.tags.amenity || place.tags.leisure || place.tags.tourism || place.tags.shop,
      tags: place.tags,
    };
  } catch (error) {
    console.error('Error fetching place details:', error);
    throw error;
  }
}; 