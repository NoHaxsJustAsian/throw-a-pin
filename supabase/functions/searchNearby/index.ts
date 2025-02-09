/// <reference types="https://deno.land/x/deno_types/deno.ns.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  try {
    const { lat, lon, radius, types, maxResults, category } = await req.json();
    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!apiKey) return new Response("Missing API key", { status: 500 });

    let allPlaces: any[] = [];
    let errors: string[] = [];

    for (const type of types) {
      try {
        const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
        url.searchParams.set("location", `${lat},${lon}`);
        url.searchParams.set("radius", radius.toString());
        url.searchParams.set("type", type);
        url.searchParams.set("key", apiKey);

        const res = await fetch(url.toString());
        const data = await res.json();
        
        if (data.status === "OK" && data.results && data.results.length > 0) {
          allPlaces = allPlaces.concat(data.results);
        } else if (data.status === "ZERO_RESULTS") {
          console.log(`No results found for type ${type} at [${lat}, ${lon}]`);
        } else {
          errors.push(`${type}: ${data.status} - ${data.error_message || 'Unknown error'}`);
        }
      } catch (error) {
        errors.push(`Failed to search for type ${type}: ${error.message}`);
      }
    }

    if (allPlaces.length === 0 && errors.length > 0) {
      return new Response(
        JSON.stringify({ 
          error: "Search failed", 
          details: errors,
          location: [lat, lon],
          types: types 
        }), 
        { status: 500 }
      );
    }

    // Deduplicate based on place_id
    const unique = new Map<string, any>();
    for (const result of allPlaces) {
      unique.set(result.place_id, result);
    }
    let uniqueArray = Array.from(unique.values());
    uniqueArray.sort((a, b) => {
      const distA = Math.pow(a.geometry.location.lat - lat, 2) + Math.pow(a.geometry.location.lng - lon, 2);
      const distB = Math.pow(b.geometry.location.lat - lat, 2) + Math.pow(b.geometry.location.lng - lon, 2);
      return distA - distB;
    });
    uniqueArray = uniqueArray.slice(0, maxResults);

    // Map the results to our Place interface shape
    const places = uniqueArray.map((result) => ({
      id: result.place_id || "",
      name: result.name || "Unknown",
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      type: category
        ? category.charAt(0).toUpperCase() + category.slice(1)
        : result.types && result.types.length > 0
        ? result.types[0]
        : "Unknown",
      address: result.vicinity || undefined,
      website: undefined,
      cuisine: undefined,
      openingHours: undefined,
      phone: undefined,
      email: undefined,
    }));

    return new Response(JSON.stringify(places), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ 
        error: "Search failed", 
        message: error.message,
        stack: error.stack 
      }), 
      { status: 500 }
    );
  }
}); 