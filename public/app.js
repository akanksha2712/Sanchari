(() => {
  "use strict";

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  const form = $("#planner");
  const destinationInput = $("#destination");
  const submitButton = $("#submit-button");
  const status = $("#form-status");
  const results = $("#results");

  const paceLabels = { relaxed: "Relaxed", balanced: "Balanced", active: "Active" };
  const interestLabels = {
    highlights: "Top highlights",
    culture: "Culture and history",
    nature: "Parks and nature",
    food: "Food and neighborhoods",
    adventure: "Active exploration"
  };
  const comfortNotes = {
    mobility: "The schedule uses fewer stops per day and allows extra transfer time. Check step-free access directly with each venue before visiting.",
    "low-energy": "A longer midday break is included. Keep one activity optional so the plan remains comfortable if energy levels change.",
    dietary: "Allow time to review menus and confirm ingredients. Save your dietary requirements in the local language before the trip."
  };

  const knownFallbacks = {
    "new york": ["Central Park", "Statue of Liberty", "The Metropolitan Museum of Art", "Empire State Building", "Brooklyn Bridge", "Times Square", "The High Line", "Grand Central Terminal", "9/11 Memorial", "Museum of Modern Art", "Rockefeller Center", "One World Trade Center"],
    "new york city": ["Central Park", "Statue of Liberty", "The Metropolitan Museum of Art", "Empire State Building", "Brooklyn Bridge", "Times Square", "The High Line", "Grand Central Terminal", "9/11 Memorial", "Museum of Modern Art", "Rockefeller Center", "One World Trade Center"],
    paris: ["Eiffel Tower", "Louvre Museum", "Notre-Dame de Paris", "Montmartre", "Arc de Triomphe", "MusÃ©e d'Orsay", "Luxembourg Garden", "Sainte-Chapelle", "Palais Garnier"],
    tokyo: ["Meiji Shrine", "SensÅ-ji", "Tokyo National Museum", "Shinjuku Gyo-en", "Tokyo Skytree", "Shibuya Crossing", "Imperial Palace", "Ueno Park", "Mori Art Museum"]
  };

  $$("[data-example]").forEach(button => button.addEventListener("click", () => {
    destinationInput.value = button.dataset.example;
    destinationInput.focus();
  }));

  $("#edit-plan").addEventListener("click", () => {
    form.scrollIntoView({ behavior: "smooth", block: "center" });
    destinationInput.focus();
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const query = destinationInput.value.trim().replace(/\s+/g, " ");
    if (query.length < 2) {
      destinationInput.classList.add("invalid");
      setStatus("Enter a city, region, or country.", true);
      destinationInput.focus();
      return;
    }

    destinationInput.classList.remove("invalid");
    submitButton.disabled = true;
    submitButton.textContent = "Creating your itinerary...";
    results.hidden = true;

    try {
      setStatus(`Finding ${query}...`);
      const location = await searchDestination(query);
      setStatus(`Finding real places near ${location.shortName}...`);
      const places = await findPlaces(location, query);

      if (places.length < 4) {
        throw new Error("Not enough named attractions were found for this destination. Try a nearby city or a more specific destination name.");
      }

      const preferences = {
        query,
        days: Number($("#days").value),
        travelers: Number($("#travelers").value),
        interest: $("#interest").value,
        pace: $("#pace").value,
        budget: Number($("#budget").value),
        comfort: $("#comfort").value
      };

      renderItinerary({ location, places, preferences });
      setStatus("");
      results.hidden = false;
      results.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      setStatus(error.message || "Place data is temporarily unavailable. Please try again.", true);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Create my itinerary";
    }
  });

  async function searchDestination(query) {
    const params = new URLSearchParams({
      q: query,
      format: "jsonv2",
      limit: "1",
      addressdetails: "1",
      namedetails: "1",
      "accept-language": "en"
    });
    const data = await fetchJson(`https://nominatim.openstreetmap.org/search?${params}`);
    if (!Array.isArray(data) || !data.length) {
      throw new Error(`We could not find â€œ${query}â€. Try adding the state or country.`);
    }
    const match = data[0];
    const address = match.address || {};
    const shortName = address.city || address.town || address.village || address.state || match.namedetails?.name || query;
    return {
      shortName,
      displayName: match.display_name,
      lat: Number(match.lat),
      lon: Number(match.lon)
    };
  }

  async function findPlaces(location, originalQuery) {
    const radius = 15000;
    const query = `[out:json][timeout:25];(` +
      `nwr["tourism"~"attraction|museum|gallery|viewpoint"]["name"](around:${radius},${location.lat},${location.lon});` +
      `nwr["historic"~"monument|memorial|castle|archaeological_site"]["name"](around:${radius},${location.lat},${location.lon});` +
      `nwr["leisure"="park"]["name"](around:${radius},${location.lat},${location.lon});` +
      `);out center tags 300;`;

    let apiPlaces = [];
    try {
      const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
      const response = await fetchJson(overpassUrl, 28000);
      apiPlaces = (response.elements || []).map(normalizeOsmPlace).filter(Boolean);
    } catch {
      apiPlaces = await findWikipediaPlaces(location);
    }

    const fallbackKey = originalQuery.toLowerCase().replace(/,.*$/, "").trim();
    const fallback = (knownFallbacks[fallbackKey] || []).map((name, index) => ({
      name,
      type: "Popular place",
      score: 100 - index,
      url: `https://www.openstreetmap.org/search?query=${encodeURIComponent(`${name}, ${location.shortName}`)}`
    }));

    return deduplicatePlaces([...apiPlaces, ...fallback])
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, 30);
  }

  function normalizeOsmPlace(element) {
    const tags = element.tags || {};
    const name = cleanName(tags.name);
    if (!name || /playground|school|daycare|parking|apartment|cemetery|triangle$/i.test(name)) return null;

    let score = 0;
    if (tags.wikipedia) score += 15;
    if (tags.wikidata) score += 10;
    if (tags.website || tags["contact:website"]) score += 2;
    if (tags.tourism === "museum") score += 11;
    if (tags.tourism === "attraction") score += 9;
    if (tags.tourism === "gallery") score += 8;
    if (tags.tourism === "viewpoint") score += 7;
    if (tags.historic === "castle" || tags.historic === "monument") score += 9;
    if (tags.historic === "memorial") score += 5;
    if (tags.leisure === "park") score += 5;

    return {
      name,
      type: placeType(tags),
      score,
      url: `https://www.openstreetmap.org/${element.type}/${element.id}`,
      tags
    };
  }

  async function findWikipediaPlaces(location) {
    try {
      const params = new URLSearchParams({
        action: "query",
        list: "geosearch",
        gscoord: `${location.lat}|${location.lon}`,
        gsradius: "10000",
        gslimit: "50",
        format: "json",
        origin: "*"
      });
      const response = await fetchJson(`https://en.wikipedia.org/w/api.php?${params}`);
      return (response.query?.geosearch || [])
        .filter(item => !/climate|history of|list of|election|smog|police|station \(|building$/i.test(item.title))
        .map((item, index) => ({
          name: cleanName(item.title),
          type: "Nearby landmark",
          score: Math.max(1, 10 - index * .1),
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replaceAll(" ", "_"))}`
        }));
    } catch {
      return [];
    }
  }

  function deduplicatePlaces(places) {
    const seen = new Set();
    return places.filter(place => {
      const key = place.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function placeType(tags) {
    if (tags.tourism === "museum") return "Museum";
    if (tags.tourism === "gallery") return "Gallery";
    if (tags.tourism === "viewpoint") return "Viewpoint";
    if (tags.leisure === "park") return "Park";
    if (tags.historic === "castle") return "Historic site";
    if (tags.historic === "monument") return "Monument";
    if (tags.historic === "memorial") return "Memorial";
    return "Attraction";
  }

  function renderItinerary({ location, places, preferences }) {
    const orderedPlaces = orderByInterest(places, preferences.interest);
    const activityCount = preferences.pace === "relaxed" ? 2 : preferences.pace === "active" ? 4 : 3;
    const requiredCount = preferences.days * activityCount;
    const selectedPlaces = cyclePlaces(orderedPlaces, requiredCount);

    $("#result-title").textContent = `${preferences.days} days in ${location.shortName}`;
    $("#result-location").textContent = location.displayName;

    const summary = $("#summary-grid");
    summary.replaceChildren(
      summaryItem("Duration", `${preferences.days} days`),
      summaryItem("Travelers", String(preferences.travelers)),
      summaryItem("Focus", interestLabels[preferences.interest]),
      summaryItem("Pace", paceLabels[preferences.pace])
    );

    const dayList = $("#day-list");
    const days = [];
    for (let day = 0; day < preferences.days; day += 1) {
      const start = day * activityCount;
      const dayPlaces = selectedPlaces.slice(start, start + activityCount);
      days.push(dayCard(day + 1, dayPlaces, preferences));
    }
    dayList.replaceChildren(...days);

    const placeList = $("#place-list");
    placeList.replaceChildren(...orderedPlaces.slice(0, 10).map(place => {
      const item = create("li");
      const link = create("a", "", place.name);
      link.href = place.url;
      link.target = "_blank";
      link.rel = "noopener";
      item.append(link, create("small", "", place.type));
      return item;
    }));

    const totalBudget = preferences.budget * preferences.days * preferences.travelers;
    $("#budget-total").textContent = formatCurrency(totalBudget);
    $("#budget-note").textContent = `Approximate total for ${preferences.travelers} ${preferences.travelers === 1 ? "traveler" : "travelers"}, excluding flights.`;

    const comfortCard = $("#comfort-card");
    if (preferences.comfort === "none") {
      comfortCard.hidden = true;
    } else {
      $("#comfort-note").textContent = comfortNotes[preferences.comfort];
      comfortCard.hidden = false;
    }
  }

  function orderByInterest(places, interest) {
    return [...places].sort((a, b) => interestScore(b, interest) - interestScore(a, interest) || b.score - a.score);
  }

  function interestScore(place, interest) {
    const type = place.type.toLowerCase();
    let boost = 0;
    if (interest === "culture" && /museum|gallery|historic|monument|memorial/.test(type)) boost = 20;
    if (interest === "nature" && /park|viewpoint/.test(type)) boost = 20;
    if (interest === "adventure" && /park|viewpoint|attraction/.test(type)) boost = 12;
    if (interest === "food" && /park|attraction/.test(type)) boost = 5;
    return place.score + boost;
  }

  function cyclePlaces(places, count) {
    const result = [];
    for (let i = 0; i < count; i += 1) result.push(places[i % places.length]);
    return result;
  }

  function dayCard(dayNumber, places, preferences) {
    const card = create("article", "day-card");
    const header = create("div", "day-header");
    const copy = create("div");
    copy.append(create("h3", "", dayTitle(dayNumber, preferences.interest)), create("p", "", `${places.length} planned stops with time between them`));
    header.append(create("span", "", String(dayNumber).padStart(2, "0")), copy);

    const list = create("ol", "activity-list");
    const times = preferences.pace === "relaxed" ? ["10:00", "15:30"] : preferences.pace === "active" ? ["08:30", "11:00", "14:30", "18:00"] : ["09:00", "13:00", "16:30"];
    places.forEach((place, index) => {
      const item = create("li", "activity");
      const details = create("div");
      const link = create("a", "", "View place details");
      link.href = place.url;
      link.target = "_blank";
      link.rel = "noopener";
      details.append(create("strong", "", place.name), create("p", "", activityDescription(place, preferences, index)), link);
      const time = create("time", "", times[index]);
      item.append(time, details);
      list.append(item);
    });
    card.append(header, list);
    return card;
  }

  function activityDescription(place, preferences, index) {
    const type = place.type.toLowerCase();
    if (preferences.interest === "food" && index === 1) return `Explore ${place.name}, then choose a well-reviewed local lunch nearby.`;
    if (/museum|gallery/.test(type)) return `Allow two to three hours for this ${place.type.toLowerCase()} and check admission times before visiting.`;
    if (/park|viewpoint/.test(type)) return `Enjoy this ${place.type.toLowerCase()} at an unhurried pace and keep the timing flexible for weather.`;
    if (/historic|monument|memorial/.test(type)) return "Spend time with the siteâ€™s history and the surrounding area.";
    return "Visit this well-known local place and leave time to explore the surrounding neighborhood.";
  }

  function dayTitle(day, interest) {
    if (day === 1) return "Arrival and essential places";
    const titles = {
      highlights: "More city highlights",
      culture: "Culture and local history",
      nature: "Parks and open spaces",
      food: "Neighborhoods and local food",
      adventure: "Active city exploration"
    };
    return titles[interest];
  }

  function summaryItem(label, value) {
    const item = create("div", "summary-item");
    item.append(create("span", "", label), create("strong", "", value));
    return item;
  }

  async function fetchJson(url, timeout = 18000) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
      if (!response.ok) throw new Error(`Place service returned ${response.status}`);
      return await response.json();
    } catch (error) {
      if (error.name === "AbortError") throw new Error("The place service took too long to respond. Please try again.");
      throw error;
    } finally {
      window.clearTimeout(timer);
    }
  }

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle("error", isError);
  }

  function create(tag, className = "", text = "") {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  }

  function cleanName(name) { return String(name || "").trim().replace(/\s+/g, " "); }
  function formatCurrency(value) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); }
})();

