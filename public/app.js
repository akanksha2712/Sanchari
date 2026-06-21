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
    mobility: "The schedule uses fewer stops per day and allows extra transfer time. Confirm step-free access directly with each venue before visiting.",
    "low-energy": "A longer midday break is included. Keep one activity optional so the plan remains comfortable if energy levels change.",
    dietary: "Allow time to review menus and confirm ingredients. Save your dietary requirements in the local language before the trip."
  };
  const knownFallbacks = {
    "new york": ["Statue of Liberty", "Empire State Building", "Central Park", "The Metropolitan Museum of Art", "Brooklyn Bridge", "One World Trade Center", "Times Square", "Museum of Modern Art", "Grand Central Terminal", "The High Line"],
    "new york city": ["Statue of Liberty", "Empire State Building", "Central Park", "The Metropolitan Museum of Art", "Brooklyn Bridge", "One World Trade Center", "Times Square", "Museum of Modern Art", "Grand Central Terminal", "The High Line"],
    paris: ["Eiffel Tower", "Louvre Museum", "Notre-Dame de Paris", "Arc de Triomphe", "MusÃ©e d'Orsay", "Montmartre", "Luxembourg Garden", "Sainte-Chapelle", "Palais Garnier"],
    tokyo: ["SensÅ-ji", "Tokyo Skytree", "Meiji Shrine", "Tokyo National Museum", "Shinjuku Gyo-en", "Shibuya Crossing", "Imperial Palace", "Ueno Park", "Mori Art Museum"]
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
      setStatus("Enter a city and country, such as New York, USA.", true);
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
      if (["country", "state"].includes(location.addressType)) {
        throw new Error("Please enter a city or specific destination, not an entire country or state.");
      }
      setStatus(`Ranking well-known places near ${location.shortName}...`);
      const places = await findRelevantPlaces(location, query);
      if (places.length < 4) {
        throw new Error("Not enough well-known places were found. Try adding the country or choosing a nearby major city.");
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
      setStatus(error.message || "The destination service is temporarily unavailable. Please try again.", true);
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
    if (!Array.isArray(data) || !data.length) throw new Error(`We could not find â€œ${query}â€. Try adding the country.`);
    const match = data[0];
    const address = match.address || {};
    const shortName = address.city || address.town || address.village || address.municipality || address.state || match.namedetails?.name || query;
    return {
      shortName,
      displayName: match.display_name,
      addressType: match.addresstype || match.type,
      lat: Number(match.lat),
      lon: Number(match.lon)
    };
  }

  async function findRelevantPlaces(location, originalQuery) {
    let places = [];
    try {
      places = await fetchRankedWikidataPlaces(location);
    } catch {
      places = [];
    }

    const fallbackKey = originalQuery.toLowerCase().replace(/,.*$/, "").trim();
    if (places.length < 8 && knownFallbacks[fallbackKey]) {
      const fallbacks = knownFallbacks[fallbackKey].map((name, index) => ({
        name,
        type: "Major attraction",
        score: 100 - index,
        url: osmSearchUrl(name, location)
      }));
      places = [...places, ...fallbacks];
    }

    return deduplicatePlaces(places)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, 35);
  }

  async function fetchRankedWikidataPlaces(location) {
    const radius = 18;
    const sparql = `
      SELECT ?item ?itemLabel ?sitelinks (GROUP_CONCAT(DISTINCT ?instanceLabel; separator="|") AS ?types) WHERE {
        SERVICE wikibase:around {
          ?item wdt:P625 ?location .
          bd:serviceParam wikibase:center "Point(${location.lon} ${location.lat})"^^geo:wktLiteral .
          bd:serviceParam wikibase:radius "${radius}" .
        }
        ?item wikibase:sitelinks ?sitelinks ; wdt:P18 ?image ; wdt:P31 ?instance .
        FILTER(?sitelinks >= 3)
        SERVICE wikibase:label {
          bd:serviceParam wikibase:language "en".
          ?item rdfs:label ?itemLabel.
          ?instance rdfs:label ?instanceLabel.
        }
      }
      GROUP BY ?item ?itemLabel ?sitelinks
      ORDER BY DESC(?sitelinks)
      LIMIT 120`;
    const params = new URLSearchParams({ format: "json", query: sparql });
    const response = await fetchJson(`https://query.wikidata.org/sparql?${params}`, 25000);
    return (response.results?.bindings || []).map(binding => normalizeWikidataPlace(binding, location)).filter(Boolean);
  }

  function normalizeWikidataPlace(binding, location) {
    const name = cleanName(binding.itemLabel?.value);
    const types = cleanName(binding.types?.value).toLowerCase();
    const sitelinks = Number(binding.sitelinks?.value || 0);
    if (!name || /^Q\d+$/.test(name) || !isTravelRelevant(types)) return null;
    return {
      name,
      type: displayType(types),
      score: sitelinks + relevanceBonus(types),
      url: osmSearchUrl(name, location),
      types
    };
  }

  function isTravelRelevant(types) {
    const excluded = /constructed language|human|company|organization|university|school|library|protest|riot|historical event|historical country|former country|sovereign state|sultanate|empire|dynasty|kingdom|stock exchange|rapid transit|administrative territorial|municipality|city in |county seat|borough of|village of|political party|hospital|geographic region/;
    if (excluded.test(types)) return false;
    return /tourist attraction|museum|gallery|park|garden|monument|memorial|bridge|skyscraper|tower|palace|castle|fort|archaeological|historic site|historic district|heritage site|historic building|square|street|market|temple|church|cathedral|mosque|synagogue|shrine|theatre|opera house|stadium|zoo|aquarium|island|beach|waterfall|mountain|volcano|nature reserve|national park|observation|arts district|world heritage|landmark/ .test(types);
  }

  function relevanceBonus(types) {
    let bonus = 0;
    if (types.includes("tourist attraction")) bonus += 120;
    if (types.includes("world heritage")) bonus += 100;
    if (/museum|gallery/.test(types)) bonus += 45;
    if (/archaeological|monument|memorial/.test(types)) bonus += 40;
    if (/palace|castle|temple|church|cathedral|mosque|synagogue|shrine/.test(types)) bonus += 35;
    if (/park|garden|beach|nature reserve|national park|waterfall|mountain|volcano/.test(types)) bonus += 30;
    if (/market|square|arts district|zoo|aquarium/.test(types)) bonus += 20;
    return bonus;
  }
  function displayType(types) {
    const labels = [
      ["museum", "Museum"], ["gallery", "Gallery"], ["national park", "National park"], ["urban park", "Park"], ["park", "Park"],
      ["palace", "Palace"], ["castle", "Castle"], ["archaeological", "Historic site"], ["historic", "Historic site"], ["memorial", "Memorial"],
      ["monument", "Monument"], ["cathedral", "Religious landmark"], ["church", "Religious landmark"], ["mosque", "Religious landmark"],
      ["temple", "Religious landmark"], ["shrine", "Religious landmark"], ["bridge", "Landmark"], ["skyscraper", "Landmark"],
      ["tower", "Landmark"], ["square", "Public square"], ["market", "Market"], ["beach", "Beach"], ["island", "Island"],
      ["mountain", "Natural landmark"], ["waterfall", "Natural landmark"], ["stadium", "Stadium"], ["zoo", "Zoo"], ["aquarium", "Aquarium"]
    ];
    return labels.find(([match]) => types.includes(match))?.[1] || "Major attraction";
  }

  function osmSearchUrl(name, location) {
    return `https://www.openstreetmap.org/search?query=${encodeURIComponent(`${name}, ${location.shortName}`)}`;
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

  function renderItinerary({ location, places, preferences }) {
    const orderedPlaces = orderByInterest(places, preferences.interest);
    const activityCount = preferences.pace === "relaxed" ? 2 : preferences.pace === "active" ? 4 : 3;
    const selectedPlaces = cyclePlaces(orderedPlaces, preferences.days * activityCount);

    $("#result-title").textContent = `${preferences.days} days in ${location.shortName}`;
    $("#result-location").textContent = location.displayName;
    $("#summary-grid").replaceChildren(
      summaryItem("Duration", `${preferences.days} days`),
      summaryItem("Travelers", String(preferences.travelers)),
      summaryItem("Focus", interestLabels[preferences.interest]),
      summaryItem("Pace", paceLabels[preferences.pace])
    );

    const dayCards = [];
    for (let day = 0; day < preferences.days; day += 1) {
      const start = day * activityCount;
      dayCards.push(dayCard(day + 1, selectedPlaces.slice(start, start + activityCount), preferences));
    }
    $("#day-list").replaceChildren(...dayCards);

    $("#place-list").replaceChildren(...orderedPlaces.slice(0, 12).map(place => {
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
    if (preferences.comfort === "none") comfortCard.hidden = true;
    else {
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
    if (interest === "culture" && /museum|gallery|historic|monument|memorial|religious|palace|castle/.test(type)) boost = 35;
    if (interest === "nature" && /park|garden|beach|island|natural|zoo/.test(type)) boost = 35;
    if (interest === "adventure" && /park|beach|island|natural|tower|landmark/.test(type)) boost = 20;
    if (interest === "food" && /market|public square|street/.test(type)) boost = 35;
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
    copy.append(create("h3", "", dayTitle(dayNumber, preferences.interest)), create("p", "", `${places.length} well-known places with time between them`));
    header.append(create("span", "", String(dayNumber).padStart(2, "0")), copy);
    const list = create("ol", "activity-list");
    const times = preferences.pace === "relaxed" ? ["10:00", "15:30"] : preferences.pace === "active" ? ["08:30", "11:00", "14:30", "18:00"] : ["09:00", "13:00", "16:30"];
    places.forEach((place, index) => {
      const item = create("li", "activity");
      const details = create("div");
      const link = create("a", "", "View on map");
      link.href = place.url;
      link.target = "_blank";
      link.rel = "noopener";
      details.append(create("strong", "", place.name), create("p", "", activityDescription(place, preferences, index)), link);
      item.append(create("time", "", times[index]), details);
      list.append(item);
    });
    card.append(header, list);
    return card;
  }

  function activityDescription(place, preferences, index) {
    const type = place.type.toLowerCase();
    if (preferences.interest === "food" && index === 1) return `Explore ${place.name}, then choose a well-reviewed local meal nearby.`;
    if (/museum|gallery/.test(type)) return `Allow two to three hours for this ${type} and check admission times before visiting.`;
    if (/park|beach|natural|island/.test(type)) return `Enjoy this ${type} at an unhurried pace and keep the timing flexible for weather.`;
    if (/historic|monument|memorial|religious|palace|castle/.test(type)) return "Spend time with the siteâ€™s history and the surrounding area.";
    return "Visit this internationally recognized place and leave time to explore the surrounding area.";
  }

  function dayTitle(day, interest) {
    if (day === 1) return "Essential places";
    return {
      highlights: "More destination highlights",
      culture: "Culture and local history",
      nature: "Parks and open spaces",
      food: "Neighborhoods and local food",
      adventure: "Active exploration"
    }[interest];
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
      if (!response.ok) throw new Error(`Destination service returned ${response.status}`);
      return await response.json();
    } catch (error) {
      if (error.name === "AbortError") throw new Error("The destination service took too long. Please try again.");
      throw error;
    } finally {
      window.clearTimeout(timer);
    }
  }

  function setStatus(message, isError = false) { status.textContent = message; status.classList.toggle("error", isError); }
  function create(tag, className = "", text = "") { const element = document.createElement(tag); if (className) element.className = className; if (text) element.textContent = text; return element; }
  function cleanName(name) { return String(name || "").trim().replace(/\s+/g, " "); }
  function formatCurrency(value) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); }
})();
