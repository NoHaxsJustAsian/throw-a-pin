import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function getLocationDetails(latitude: number, longitude: number) {
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${import.meta.env.VITE_GOOGLE_PLACES_API_KEY}`
    );
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const result = data.results[0];
      const components = result.address_components;
      
      let locality = components.find((c: any) => c.types.includes('locality'))?.long_name;
      let state = components.find((c: any) => c.types.includes('administrative_area_level_1'))?.long_name;
      let country = components.find((c: any) => c.types.includes('country'))?.long_name;

      // Build location string
      let locationParts = [];
      if (locality) locationParts.push(locality);
      if (state) locationParts.push(state);
      if (country) locationParts.push(country);

      return locationParts.join(', ');
    }
    return 'Unknown Location';
  } catch (error) {
    console.error('Error getting location details:', error);
    return 'Unknown Location';
  }
}
