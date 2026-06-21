# Sanchari — Simple Travel Planner

Sanchari creates personalized day-by-day travel itineraries using live place data rather than a hard-coded destination list.

## What it does

- Accepts any city, region, or country
- Resolves the destination with OpenStreetMap Nominatim
- Finds real nearby attractions through the OpenStreetMap Overpass API
- Uses Wikipedia geosearch as a service fallback
- Personalizes the order and daily schedule by interest, pace, budget, travelers, and comfort needs
- Requires no API key or build step

## Run locally

From the project directory:

```powershell
firebase.cmd emulators:start --only hosting
```

Open `http://localhost:5000`.

## Data attribution

Location and attraction data is © OpenStreetMap contributors. The website includes visible attribution and direct links to source place pages.

## Production note

The public Nominatim and Overpass endpoints are appropriate for a lightweight demonstration. For high traffic, use a hosted geocoding provider or your own OpenStreetMap services and add server-side caching.
