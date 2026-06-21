(() => {
  "use strict";

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  const form = $("#trip-form");
  const destinationInput = $("#destination");
  const dateInput = $("#start-date");
  const itinerarySection = $("#itinerary");
  const toast = $("#toast");
  let currentPlan = null;
  let toastTimer;

  const destinations = {
    bali: {
      label: "Bali",
      region: "Indonesia",
      themes: {
        culture: ["Water temple and artisan village", "Ubud palace and evening dance", "Ancient gateways and local traditions"],
        food: ["Market breakfast and spice tasting", "Family-run warung lunch", "Balinese cooking workshop"],
        nature: ["Tegalalang rice terrace walk", "Waterfall and jungle viewpoint", "Sunrise among the volcanic hills"],
        adventure: ["Ayung River rafting", "Mount Batur sunrise hike", "Coastal surf lesson"],
        wellness: ["Garden yoga and sound healing", "Traditional flower bath", "Slow afternoon at a wellness retreat"],
        nightlife: ["Seminyak sunset lounge", "Beachside music and night market", "Canggu cafÃ© hop after dark"]
      },
      food: "A relaxed dinner at a locally loved warung",
      intro: "Settle into the island rhythm",
      note: "Tropical heat can sneak up on you. Keep water close and leave a cool midday pause between outdoor stops."
    },
    tokyo: {
      label: "Tokyo",
      region: "Japan",
      themes: {
        culture: ["Meiji Shrine and Harajuku lanes", "Asakusa temple and old Tokyo walk", "Mori art museum and city views"],
        food: ["Tsukiji outer market tasting", "Tiny ramen shop lunch", "Guided izakaya food walk"],
        nature: ["Shinjuku Gyoen garden pause", "Riverside walk in Nakameguro", "Day trip toward Mount Takao"],
        adventure: ["Cycling through hidden neighborhoods", "Indoor climbing with a city view", "Fast-paced Shibuya discovery walk"],
        wellness: ["Quiet garden tea ritual", "Restorative sento visit", "Mindful morning in Yoyogi Park"],
        nightlife: ["Shinjuku lantern alleys", "Shibuya rooftop evening", "Live music in Shimokitazawa"]
      },
      food: "Dinner at a neighborhood izakaya",
      intro: "Ease into Tokyo one neighborhood at a time",
      note: "Stations are large and days can become step-heavy. The plan groups nearby stops and protects a seated break each afternoon."
    },
    switzerland: {
      label: "Switzerland",
      region: "Swiss Alps",
      themes: {
        culture: ["Old-town lanes and local museum", "Mountain village heritage walk", "Lakeside castle and historic quarter"],
        food: ["Alpine cheese tasting", "Village bakery breakfast", "Cozy fondue evening"],
        nature: ["Panoramic train through the Alps", "Gentle turquoise-lake trail", "Cable-car ride to a high viewpoint"],
        adventure: ["Guided ridge hike", "Paragliding above the valley", "Mountain bike discovery route"],
        wellness: ["Thermal spa afternoon", "Slow forest bathing walk", "Sunrise stretch overlooking the peaks"],
        nightlife: ["Lakeside wine bar", "Village music evening", "Starlit mountain terrace"]
      },
      food: "Seasonal dinner in a warm mountain inn",
      intro: "Arrive, exhale, and let the scenery lead",
      note: "Altitude and changeable weather deserve an easy first day. Layers, hydration, and flexible train timing are built into your plan."
    },
    dubai: {
      label: "Dubai",
      region: "United Arab Emirates",
      themes: {
        culture: ["Al Fahidi historic district", "Creek abra ride and spice souk", "Jumeirah mosque cultural visit"],
        food: ["Emirati breakfast experience", "Old Dubai street-food trail", "Modern Middle Eastern tasting menu"],
        nature: ["Desert conservation drive", "Sunrise at a quiet beach", "Hatta mountain day escape"],
        adventure: ["Desert dune experience", "Skyline zipline", "Paddle session along the coast"],
        wellness: ["Hammam and spa reset", "Sunrise beach yoga", "Poolside recovery afternoon"],
        nightlife: ["Marina promenade after dark", "Downtown fountain evening", "Rooftop skyline lounge"]
      },
      food: "Dinner with a view of the evening skyline",
      intro: "Meet the city beyond the skyline",
      note: "Outdoor time is placed early or late to avoid peak heat, with air-conditioned transfers and indoor breaks during midday."
    },
    maldives: {
      label: "Maldives",
      region: "Indian Ocean",
      themes: {
        culture: ["Island community walk", "Local craft and storytelling hour", "MalÃ© heritage discovery"],
        food: ["Maldivian breakfast by the sea", "Tuna and coconut cooking lesson", "Sunset beach dinner"],
        nature: ["Lagoon snorkel with a guide", "Dolphin-spotting sail", "Sandbank picnic and reef walk"],
        adventure: ["Guided open-water snorkel", "Kayak between quiet coves", "Beginner windsurf session"],
        wellness: ["Oceanfront morning yoga", "Island spa ritual", "Barefoot digital-detox afternoon"],
        nightlife: ["Starlit beach cinema", "Sunset music cruise", "Low-key island evening"]
      },
      food: "Fresh island dinner beside the water",
      intro: "Step off the clock and into island time",
      note: "Sun exposure and boat transfers are paced carefully. Reef-safe sunscreen, shade, and hydration are your daily essentials."
    }
  };

  const generic = {
    label: null,
    region: "Your chosen destination",
    themes: {
      culture: ["Old-town orientation and landmark visit", "Independent gallery and heritage quarter", "Local craft workshop and cultural show"],
      food: ["Market breakfast and local flavors", "Neighborhood food walk", "Cook-with-a-local experience"],
      nature: ["Scenic morning walk", "Botanical garden and viewpoint", "Easy day trip into the landscape"],
      adventure: ["Guided outdoor challenge", "Cycling beyond the main streets", "Signature active experience"],
      wellness: ["Gentle yoga and slow breakfast", "Restorative spa break", "Mindful sunset walk"],
      nightlife: ["Rooftop sunset stop", "Live local music", "Evening neighborhood discovery"]
    },
    food: "A locally recommended dinner",
    intro: "Arrive gently and get your bearings",
    note: "Keep water, essential medication, and a little unscheduled time close. A flexible plan is usually the most enjoyable one."
  };

  const wellbeingNotes = {
    none: null,
    mobility: "Your days favor step-free routes, shorter walking loops, direct transfers, and attractions where seating is readily available.",
    "low-impact": "High-impact activities have been swapped for scenic, low-strain alternatives with generous recovery time.",
    dietary: "Food stops include time to confirm ingredients and dietary requirements. Keep a translated dietary card available when helpful.",
    medical: "Daily reminders, regular meals, and a protected rest window are built in. Keep medication in your hand luggage while moving between stays."
  };

  function toLocalDateString(date) {
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
  }

  const today = new Date();
  const defaultDate = new Date(today);
  defaultDate.setDate(today.getDate() + 14);
  dateInput.min = toLocalDateString(today);
  dateInput.value = toLocalDateString(defaultDate);
  $("#year").textContent = new Date().getFullYear();

  $$("[data-scroll-planner]").forEach(button => button.addEventListener("click", () => {
    $("#planner").scrollIntoView({ behavior: "smooth", block: "start" });
    closeMenu();
    window.setTimeout(() => destinationInput.focus(), 500);
  }));

  const menuButton = $(".menu-button");
  const nav = $("#site-nav");
  menuButton.addEventListener("click", () => {
    const open = !nav.classList.contains("open");
    nav.classList.toggle("open", open);
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  });
  $$("a", nav).forEach(link => link.addEventListener("click", closeMenu));
  function closeMenu() {
    nav.classList.remove("open");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Open menu");
  }

  $$(".choice-chip").forEach(chip => chip.addEventListener("click", () => {
    const selected = !chip.classList.contains("selected");
    if (!selected && $$(".choice-chip.selected").length === 1) {
      showToast("Keep at least one travel style selected.");
      return;
    }
    chip.classList.toggle("selected", selected);
    chip.setAttribute("aria-pressed", String(selected));
  }));

  $$(".destination-card").forEach(card => {
    card.addEventListener("click", () => chooseDestination(card.dataset.destination));
    card.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") chooseDestination(card.dataset.destination);
    });
    card.tabIndex = 0;
  });

  function chooseDestination(destination) {
    destinationInput.value = destination;
    $("#planner").scrollIntoView({ behavior: "smooth" });
    window.setTimeout(() => dateInput.focus(), 450);
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const rawName = destinationInput.value.trim().replace(/\s+/g, " ");
    if (rawName.length < 2) {
      destinationInput.setCustomValidity("Please enter a destination.");
      destinationInput.reportValidity();
      return;
    }
    destinationInput.setCustomValidity("");

    const key = Object.keys(destinations).find(name => rawName.toLowerCase().includes(name));
    const profile = key ? destinations[key] : { ...generic, label: titleCase(rawName) };
    const styles = $$(".choice-chip.selected").map(chip => chip.dataset.style);
    const data = {
      destination: profile.label,
      profile,
      days: Number($("#days").value),
      startDate: dateInput.value,
      budget: Number($("#budget").value),
      travelers: Number($("#travelers").value),
      pace: $("#pace").value,
      wellbeing: $("#wellbeing-needs").value,
      styles
    };

    const submitButton = $("button[type='submit']", form);
    const original = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.textContent = "Shaping your tripâ€¦";
    window.setTimeout(() => {
      currentPlan = buildPlan(data);
      renderPlan(currentPlan);
      submitButton.disabled = false;
      submitButton.innerHTML = original;
      itinerarySection.hidden = false;
      itinerarySection.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 650);
  });

  function buildPlan(data) {
    const { profile, styles, pace, days, destination } = data;
    const activityCount = pace === "slow" ? 2 : pace === "full" ? 4 : 3;
    const allChoices = styles.flatMap(style => profile.themes[style] || generic.themes[style]);
    const fallbackChoices = Object.values(profile.themes).flat();
    const choices = allChoices.length ? allChoices : fallbackChoices;
    const dayPlans = [];

    for (let day = 0; day < days; day += 1) {
      const date = new Date(`${data.startDate}T12:00:00`);
      date.setDate(date.getDate() + day);
      const activities = [];
      if (day === 0) activities.push({ time: "11:00", title: profile.intro, detail: "Check in, reset, and explore the immediate neighborhood without rushing." });
      const needed = activityCount - activities.length;
      for (let i = 0; i < needed; i += 1) {
        const choice = choices[(day * activityCount + i) % choices.length];
        const times = pace === "slow" ? ["10:00", "16:30"] : pace === "full" ? ["08:30", "11:30", "15:00", "19:30"] : ["09:00", "14:00", "19:00"];
        activities.push({
          time: times[activities.length] || "18:30",
          title: choice,
          detail: activityDetail(styles[(day + i) % styles.length], data.wellbeing)
        });
      }
      if (day > 0 && !activities.some(item => item.time.startsWith("19"))) {
        activities[activities.length - 1] = { time: "19:00", title: profile.food, detail: "A flexible table choice close to your final daytime stop." };
      }
      dayPlans.push({
        day: day + 1,
        date: date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
        title: dayTitle(day, days, styles),
        activities
      });
    }

    const targetSpend = Math.round(data.budget * data.travelers * Math.min(1, .62 + days * .035));
    return { ...data, dayPlans, targetSpend };
  }

  function activityDetail(style, wellbeing) {
    const detail = {
      culture: "Time for the essential story, plus space to notice the details on your own.",
      food: "A local favorite selected to fit naturally into the dayâ€™s route.",
      nature: "Scenic time with weather flexibility and an unhurried photo stop.",
      adventure: "A book-ahead experience with a gentler alternative close by.",
      wellness: "Protected slow timeâ€”this is part of the plan, not an empty gap.",
      nightlife: "An easy evening option with a simple route back to your stay."
    }[style] || "A well-located experience with enough time to enjoy it.";
    return wellbeing === "mobility" ? `${detail} Step-free access should be confirmed when booking.` : detail;
  }

  function dayTitle(index, total, styles) {
    if (index === 0) return "A gentle hello";
    if (index === total - 1) return "One last lovely chapter";
    const titles = {
      culture: "Stories, streets & local character",
      food: "Flavors worth slowing down for",
      nature: "A wider, greener view",
      adventure: "A little more alive",
      wellness: "Breathe in, stretch out",
      nightlife: "Golden hour to after dark"
    };
    return titles[styles[index % styles.length]];
  }

  function renderPlan(plan) {
    $("#itinerary-title").textContent = `${plan.days} days in ${plan.destination}`;
    $("#itinerary-subtitle").textContent = `${plan.profile.region} Â· ${paceLabel(plan.pace)} Â· shaped around ${listStyles(plan.styles)}`;
    const start = new Date(`${plan.startDate}T12:00:00`);
    const end = new Date(start);
    end.setDate(start.getDate() + plan.days - 1);

    const overview = $("#trip-overview");
    overview.replaceChildren(
      overviewItem("Dates", `${shortDate(start)} â€“ ${shortDate(end)}`),
      overviewItem("Travelers", plan.travelers === 1 ? "Solo traveler" : `${plan.travelers} travelers`),
      overviewItem("Trip rhythm", paceLabel(plan.pace)),
      overviewItem("Top interests", listStyles(plan.styles))
    );

    const dayList = $("#day-list");
    dayList.replaceChildren(...plan.dayPlans.map(day => {
      const card = create("article", "day-card");
      const heading = create("div", "day-heading");
      const number = create("span", "day-number", String(day.day).padStart(2, "0"));
      const headingCopy = create("div");
      const title = create("h3", "", day.title);
      const date = create("p", "", day.date);
      headingCopy.append(title, date);
      heading.append(number, headingCopy);
      const activities = create("div", "day-activities");
      day.activities.forEach(item => {
        const row = create("div", "activity");
        const time = create("time", "", item.time);
        const copy = create("div");
        copy.append(create("strong", "", item.title), create("small", "", item.detail));
        row.append(time, copy);
        activities.append(row);
      });
      card.append(heading, activities);
      return card;
    }));

    $("#budget-total").textContent = money(plan.targetSpend);
    const breakdown = [
      ["Stay", 42], ["Food", 23], ["Experiences", 22], ["Local travel", 13]
    ];
    const budgetBars = $("#budget-bars");
    budgetBars.replaceChildren(...breakdown.map(([label, percent]) => {
      const row = create("div", "budget-row");
      const track = create("div", "budget-track");
      const fill = create("div", "budget-fill");
      fill.style.width = `${percent}%`;
      track.append(fill);
      row.append(create("span", "", label), track, create("span", "", money(Math.round(plan.targetSpend * percent / 100))));
      return row;
    }));

    $("#care-note").textContent = wellbeingNotes[plan.wellbeing] || plan.profile.note;
    $("#save-trip").textContent = "â™¡ Save this trip";
  }

  function overviewItem(label, value) {
    const item = create("div", "overview-item");
    item.append(create("small", "", label), create("strong", "", value));
    return item;
  }

  $("#edit-trip").addEventListener("click", () => $("#planner").scrollIntoView({ behavior: "smooth" }));
  $("#new-trip").addEventListener("click", () => {
    destinationInput.value = "";
    itinerarySection.hidden = true;
    $("#planner").scrollIntoView({ behavior: "smooth" });
    window.setTimeout(() => destinationInput.focus(), 450);
  });

  $("#save-trip").addEventListener("click", () => {
    if (!currentPlan) return;
    const saved = getSavedTrips();
    const record = { ...currentPlan, savedAt: new Date().toISOString() };
    saved.unshift(record);
    localStorage.setItem("sanchari-trips", JSON.stringify(saved.slice(0, 8)));
    updateSavedCount();
    $("#save-trip").textContent = "â™¥ Trip saved";
    showToast("Your itinerary is saved on this device.");
  });

  $("#footer-saved").addEventListener("click", () => {
    const saved = getSavedTrips();
    if (!saved.length) {
      showToast("No saved trips yetâ€”your next one can live here.");
      return;
    }
    showToast(`${saved.length} saved ${saved.length === 1 ? "trip" : "trips"} on this device.`);
  });

  function getSavedTrips() {
    try { return JSON.parse(localStorage.getItem("sanchari-trips")) || []; }
    catch { return []; }
  }

  function updateSavedCount() { $("#saved-count").textContent = getSavedTrips().length; }
  updateSavedCount();

  function showToast(message) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("show");
    toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2800);
  }

  function create(tag, className = "", text = "") {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  }

  function shortDate(date) { return date.toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
  function money(value) { return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); }
  function titleCase(value) { return value.replace(/\b\w/g, char => char.toUpperCase()); }
  function paceLabel(value) { return ({ slow: "Slow & easy", balanced: "Balanced", full: "Full & lively" })[value]; }
  function listStyles(styles) {
    const labels = styles.slice(0, 3).map(titleCase);
    return labels.length > 1 ? `${labels.slice(0, -1).join(", ")} & ${labels.at(-1)}` : labels[0];
  }
})();

