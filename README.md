# Sanchari â€” Worldwide Travel Planner

Sanchari creates simple day-by-day itineraries from globally ranked destination data.

## Data approach

- OpenStreetMap Nominatim resolves the userâ€™s city and coordinates.
- Wikidata finds nearby places and ranks them by the number of Wikimedia projects that reference each place. This provides a practical worldwide notability signal instead of returning arbitrary nearby map objects.
- Results are limited to travel-relevant categories such as attractions, museums, parks, monuments, landmarks, religious sites, markets, beaches, and natural features.
- OpenStreetMap search links provide map details for each itinerary stop.

No API key or build step is required.

## Run locally

```powershell
firebase.cmd emulators:start --only hosting
```

Open `http://localhost:5000` and enter a city plus country for the most precise result.

## Production note

For guaranteed commercial service levels, replace the public endpoints with a paid places provider such as Google Places, Foursquare, or Geoapify and proxy requests through a server-side endpoint.
