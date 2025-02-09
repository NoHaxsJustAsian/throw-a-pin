/// <reference types="https://deno.land/x/deno_types/deno.ns.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  try {
    const { placeId } = await req.json();
    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!apiKey) return new Response("Missing API key", { status: 500 });

    const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
    url.searchParams.set("place_id", placeId);
    url.searchParams.set("fields", "formatted_address,opening_hours");
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString());
    const data = await res.json();

    if (data.status === "OK" && data.result) {
      return new Response(
        JSON.stringify({
          formatted_address: data.result.formatted_address || "Address not available",
          opening_hours: data.result.opening_hours?.weekday_text || null,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({ formatted_address: "Address not available" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}); 