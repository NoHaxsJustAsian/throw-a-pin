/// <reference types="https://deno.land/x/deno_types/deno.ns.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  try {
    const { origin, destination } = await req.json(); // origin and destination are objects with lat and lng
    // You can use the same API key if your project permits or set up a separate one.
    const apiKey = Deno.env.get("GOOGLE_DIRECTIONS_API_KEY") || Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!apiKey) return new Response("Missing API key", { status: 500 });

    const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
    url.searchParams.set("origin", `${origin.lat},${origin.lng}`);
    url.searchParams.set("destination", `${destination.lat},${destination.lng}`);
    url.searchParams.set("mode", "driving");
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString());
    const data = await res.json();
    const isDrivable = data.status === "OK" && data.routes && data.routes.length > 0;
    return new Response(JSON.stringify({ isDrivable }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}); 