# Sanchari — The Explorer

Sanchari is a responsive travel-planning website that creates personalized day-by-day itineraries from a traveler's destination, dates, budget, pace, interests, group size, and wellbeing needs.

## Features

- Personalized 1–14 day itineraries
- Travel-style matching across culture, food, nature, adventure, wellness, and nightlife
- Budget estimate and category breakdown
- Mobility, low-impact, dietary, and medication/rest considerations
- Local saved trips using browser storage
- Responsive, accessible single-page interface
- Firebase Hosting configuration

## Run locally

No build step is required.

```powershell
firebase.cmd emulators:start --only hosting
```

Or serve the `public` directory with any static web server.

## Deploy

```powershell
firebase.cmd deploy --only hosting
```

The project is configured for Firebase project `sanchari-6a63a`.

## AI integration note

The deployed version uses a deterministic, privacy-friendly itinerary engine so it works with no API key and never exposes secrets in frontend code. For a production generative model, add a server-side Firebase Function or another protected API endpoint and call it from the form submission handler in `public/app.js`. Keep all provider keys in server-side secrets, never in `public/`.
