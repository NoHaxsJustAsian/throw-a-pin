import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function getLocationDetails(latitude: number, longitude: number) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'en', // Get results in English
          'User-Agent': 'RandomDestinationGenerator/1.0' // Required by Nominatim ToS
        }
      }
    );
    const data = await response.json();

    if (data.address) {
      const locationParts = [];
      if (data.address.city || data.address.town || data.address.village) {
        locationParts.push(data.address.city || data.address.town || data.address.village);
      }
      if (data.address.state) {
        locationParts.push(data.address.state);
      }
      if (data.address.country) {
        locationParts.push(data.address.country);
      }

      return locationParts.join(', ');
    }
    return 'Unknown Location';
  } catch (error) {
    console.error('Error getting location details:', error);
    return 'Unknown Location';
  }
}
