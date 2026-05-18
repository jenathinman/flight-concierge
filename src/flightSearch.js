// flightSearch.js — flight search + airport resolution.
//
// This module exposes two functions: resolveAirports and searchFlights.
// Today they return realistic mock data so the demo runs without API keys.
// To go live, replace the body of searchFlights with a call to Duffel,
// Amadeus, Kiwi Tequila, or SerpAPI's google_flights engine — the input
// and output shapes are designed to match those APIs closely.

// --- Airport database -----------------------------------------------------
// A small curated set. In production you'd ship the full IATA list (~9000
// airports) or hit a /places endpoint on your flight provider.
const AIRPORTS = [
  { code: "SEA", city: "Seattle", name: "Seattle-Tacoma Intl", country: "US", lat: 47.45, lon: -122.31 },
  { code: "PDX", city: "Portland", name: "Portland Intl", country: "US", lat: 45.59, lon: -122.60 },
  { code: "SFO", city: "San Francisco", name: "San Francisco Intl", country: "US", lat: 37.62, lon: -122.38 },
  { code: "OAK", city: "Oakland", name: "Oakland Intl", country: "US", lat: 37.72, lon: -122.22 },
  { code: "SJC", city: "San Jose", name: "Norman Y. Mineta San Jose", country: "US", lat: 37.36, lon: -121.93 },
  { code: "LAX", city: "Los Angeles", name: "Los Angeles Intl", country: "US", lat: 33.94, lon: -118.41 },
  { code: "BUR", city: "Burbank", name: "Hollywood Burbank", country: "US", lat: 34.20, lon: -118.36 },
  { code: "SAN", city: "San Diego", name: "San Diego Intl", country: "US", lat: 32.73, lon: -117.19 },
  { code: "LAS", city: "Las Vegas", name: "Harry Reid Intl", country: "US", lat: 36.08, lon: -115.15 },
  { code: "PHX", city: "Phoenix", name: "Phoenix Sky Harbor", country: "US", lat: 33.43, lon: -112.01 },
  { code: "DEN", city: "Denver", name: "Denver Intl", country: "US", lat: 39.86, lon: -104.67 },
  { code: "DFW", city: "Dallas", name: "Dallas/Fort Worth Intl", country: "US", lat: 32.90, lon: -97.04 },
  { code: "DAL", city: "Dallas", name: "Dallas Love Field", country: "US", lat: 32.85, lon: -96.85 },
  { code: "IAH", city: "Houston", name: "George Bush Intercontinental", country: "US", lat: 29.98, lon: -95.34 },
  { code: "ATL", city: "Atlanta", name: "Hartsfield-Jackson", country: "US", lat: 33.64, lon: -84.43 },
  { code: "MIA", city: "Miami", name: "Miami Intl", country: "US", lat: 25.79, lon: -80.29 },
  { code: "MCO", city: "Orlando", name: "Orlando Intl", country: "US", lat: 28.43, lon: -81.31 },
  { code: "ORD", city: "Chicago", name: "O'Hare Intl", country: "US", lat: 41.98, lon: -87.90 },
  { code: "MDW", city: "Chicago", name: "Midway Intl", country: "US", lat: 41.79, lon: -87.75 },
  { code: "DTW", city: "Detroit", name: "Detroit Metropolitan", country: "US", lat: 42.21, lon: -83.35 },
  { code: "MSP", city: "Minneapolis", name: "Minneapolis-St Paul", country: "US", lat: 44.88, lon: -93.22 },
  { code: "BOS", city: "Boston", name: "Logan Intl", country: "US", lat: 42.36, lon: -71.01 },
  { code: "JFK", city: "New York", name: "John F. Kennedy Intl", country: "US", lat: 40.64, lon: -73.78 },
  { code: "LGA", city: "New York", name: "LaGuardia", country: "US", lat: 40.78, lon: -73.87 },
  { code: "EWR", city: "Newark", name: "Newark Liberty Intl", country: "US", lat: 40.69, lon: -74.17 },
  { code: "PHL", city: "Philadelphia", name: "Philadelphia Intl", country: "US", lat: 39.87, lon: -75.24 },
  { code: "DCA", city: "Washington", name: "Reagan National", country: "US", lat: 38.85, lon: -77.04 },
  { code: "IAD", city: "Washington", name: "Dulles Intl", country: "US", lat: 38.94, lon: -77.46 },
  { code: "YVR", city: "Vancouver", name: "Vancouver Intl", country: "CA", lat: 49.19, lon: -123.18 },
  { code: "YYZ", city: "Toronto", name: "Toronto Pearson", country: "CA", lat: 43.68, lon: -79.63 },
  { code: "YUL", city: "Montreal", name: "Montréal-Trudeau", country: "CA", lat: 45.47, lon: -73.74 },
  { code: "LHR", city: "London", name: "Heathrow", country: "GB", lat: 51.47, lon: -0.45 },
  { code: "LGW", city: "London", name: "Gatwick", country: "GB", lat: 51.15, lon: -0.18 },
  { code: "CDG", city: "Paris", name: "Charles de Gaulle", country: "FR", lat: 49.01, lon: 2.55 },
  { code: "ORY", city: "Paris", name: "Orly", country: "FR", lat: 48.73, lon: 2.37 },
  { code: "AMS", city: "Amsterdam", name: "Schiphol", country: "NL", lat: 52.31, lon: 4.76 },
  { code: "FRA", city: "Frankfurt", name: "Frankfurt am Main", country: "DE", lat: 50.04, lon: 8.56 },
  { code: "MUC", city: "Munich", name: "Munich Intl", country: "DE", lat: 48.35, lon: 11.79 },
  { code: "MAD", city: "Madrid", name: "Adolfo Suárez Madrid-Barajas", country: "ES", lat: 40.49, lon: -3.57 },
  { code: "BCN", city: "Barcelona", name: "Barcelona-El Prat", country: "ES", lat: 41.30, lon: 2.08 },
  { code: "FCO", city: "Rome", name: "Leonardo da Vinci-Fiumicino", country: "IT", lat: 41.80, lon: 12.25 },
  { code: "DXB", city: "Dubai", name: "Dubai Intl", country: "AE", lat: 25.25, lon: 55.36 },
  { code: "DOH", city: "Doha", name: "Hamad Intl", country: "QA", lat: 25.26, lon: 51.61 },
  { code: "BOM", city: "Mumbai", name: "Chhatrapati Shivaji Maharaj Intl", country: "IN", lat: 19.09, lon: 72.86 },
  { code: "DEL", city: "Delhi", name: "Indira Gandhi Intl", country: "IN", lat: 28.57, lon: 77.10 },
  { code: "BLR", city: "Bangalore", name: "Kempegowda Intl", country: "IN", lat: 13.20, lon: 77.71 },
  { code: "SIN", city: "Singapore", name: "Changi", country: "SG", lat: 1.36, lon: 103.99 },
  { code: "HKG", city: "Hong Kong", name: "Hong Kong Intl", country: "HK", lat: 22.31, lon: 113.91 },
  { code: "NRT", city: "Tokyo", name: "Narita Intl", country: "JP", lat: 35.77, lon: 140.39 },
  { code: "HND", city: "Tokyo", name: "Haneda", country: "JP", lat: 35.55, lon: 139.78 },
  { code: "ICN", city: "Seoul", name: "Incheon Intl", country: "KR", lat: 37.46, lon: 126.44 },
  { code: "SYD", city: "Sydney", name: "Sydney Kingsford Smith", country: "AU", lat: -33.94, lon: 151.18 },
  { code: "MEX", city: "Mexico City", name: "Benito Juárez Intl", country: "MX", lat: 19.44, lon: -99.07 },
  { code: "CUN", city: "Cancun", name: "Cancún Intl", country: "MX", lat: 21.04, lon: -86.87 },
];

// --- Public: resolve a free-text place into airport options ---------------
export function resolveAirports({ query }) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return { airports: [] };

  // Direct IATA hit
  const exact = AIRPORTS.find(a => a.code.toLowerCase() === q);
  if (exact) return { airports: [exact] };

  // City / name substring match
  const matches = AIRPORTS.filter(
    a =>
      a.city.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q) ||
      q.includes(a.city.toLowerCase())
  );

  return { airports: matches.slice(0, 6) };
}

// --- Distance & duration helpers -----------------------------------------
function haversineKm(a, b) {
  const toRad = d => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Cruise ~830 km/h, plus ~40 min for taxi/climb/descent
function flightMinutes(km) {
  return Math.round((km / 830) * 60 + 40);
}

// --- Realistic carrier selection by region pair --------------------------
const CARRIERS_BY_REGION = {
  US_US: ["Alaska", "Delta", "United", "American", "Southwest", "JetBlue"],
  US_CA: ["Air Canada", "Alaska", "WestJet", "United"],
  US_EU: ["Delta", "United", "American", "British Airways", "Lufthansa", "Air France", "KLM"],
  US_ASIA: ["United", "ANA", "Japan Airlines", "Korean Air", "Cathay Pacific", "Singapore Airlines"],
  US_ME: ["Emirates", "Qatar Airways", "Etihad", "United"],
  US_IN: ["Air India", "United", "Emirates", "Qatar Airways", "Lufthansa"],
  US_AU: ["Qantas", "United", "Delta", "Air New Zealand"],
  US_MX: ["Aeromexico", "Volaris", "United", "Delta", "American"],
  EU_EU: ["Lufthansa", "Air France", "KLM", "British Airways", "Iberia", "Ryanair", "easyJet"],
  DEFAULT: ["Delta", "Emirates", "Qatar Airways", "Singapore Airlines"],
};

function regionOf(country) {
  if (country === "US") return "US";
  if (country === "CA") return "CA";
  if (["GB", "FR", "DE", "NL", "ES", "IT"].includes(country)) return "EU";
  if (["JP", "KR", "SG", "HK"].includes(country)) return "ASIA";
  if (["AE", "QA"].includes(country)) return "ME";
  if (country === "IN") return "IN";
  if (country === "AU") return "AU";
  if (country === "MX") return "MX";
  return "OTHER";
}

function carriersForRoute(origin, dest) {
  const o = regionOf(origin.country);
  const d = regionOf(dest.country);
  const key = `${o}_${d}`;
  const reverseKey = `${d}_${o}`;
  return (
    CARRIERS_BY_REGION[key] ||
    CARRIERS_BY_REGION[reverseKey] ||
    CARRIERS_BY_REGION.DEFAULT
  );
}

// --- Pricing model -------------------------------------------------------
// Real price = base + per-km + cabin multiplier + last-minute premium
// + non-stop premium − layover discount, plus a bit of jitter.
function basePriceUSD(km, cabin) {
  const cabinMult = { economy: 1, premium_economy: 1.6, business: 3.4, first: 5.2 }[cabin] ?? 1;
  const distancePart = 0.09 * km + 60;
  return distancePart * cabinMult;
}

function daysUntil(dateISO) {
  const ms = new Date(dateISO + "T00:00:00Z") - new Date();
  return Math.max(0, Math.floor(ms / 86400000));
}

function leadTimeMult(days) {
  // Cheapest ~3–8 weeks out; expensive inside 14 days.
  if (days <= 3) return 1.9;
  if (days <= 14) return 1.4;
  if (days <= 60) return 1.0;
  return 1.1;
}

// --- Deterministic pseudo-random so a route generates stable results -----
function seedFromString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// --- Time-of-day helpers -------------------------------------------------
const TIME_WINDOWS = {
  morning: [5, 11],
  afternoon: [12, 17],
  evening: [18, 22],
  red_eye: [22, 5], // wraps midnight
  any: [0, 24],
};

function hourInWindow(hour, window) {
  const [a, b] = TIME_WINDOWS[window] || TIME_WINDOWS.any;
  if (a < b) return hour >= a && hour < b;
  return hour >= a || hour < b; // wraps midnight (red_eye)
}

function formatTime(date) {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatDuration(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

// --- One leg generator ---------------------------------------------------
function buildLeg({ origin, dest, dateISO, carrier, flightNum, depHour, depMin, totalMin, stops, rand }) {
  const dep = new Date(`${dateISO}T00:00:00`);
  dep.setHours(depHour, depMin, 0, 0);
  const arr = new Date(dep.getTime() + totalMin * 60_000);

  const segments = [];
  if (stops === 0) {
    segments.push({
      from: origin.code,
      to: dest.code,
      depart: dep.toISOString(),
      arrive: arr.toISOString(),
      airline: carrier,
      flight_number: `${carrier.slice(0, 2).toUpperCase()}${flightNum}`,
      duration_minutes: totalMin,
    });
  } else {
    // Insert a plausible layover hub.
    const hubs = ["DEN", "DFW", "ORD", "ATL", "FRA", "AMS", "DXB", "DOH", "ICN", "SIN"];
    const hubCode = hubs[Math.floor(rand() * hubs.length)];
    const layoverMin = 60 + Math.floor(rand() * 180); // 1–4h
    const firstLeg = Math.floor((totalMin - layoverMin) * (0.4 + rand() * 0.2));
    const secondLeg = totalMin - layoverMin - firstLeg;
    const arrHub = new Date(dep.getTime() + firstLeg * 60_000);
    const depHub = new Date(arrHub.getTime() + layoverMin * 60_000);

    segments.push({
      from: origin.code, to: hubCode,
      depart: dep.toISOString(), arrive: arrHub.toISOString(),
      airline: carrier,
      flight_number: `${carrier.slice(0, 2).toUpperCase()}${flightNum}`,
      duration_minutes: firstLeg,
    });
    segments.push({
      from: hubCode, to: dest.code,
      depart: depHub.toISOString(), arrive: arr.toISOString(),
      airline: carrier,
      flight_number: `${carrier.slice(0, 2).toUpperCase()}${flightNum + 1}`,
      duration_minutes: secondLeg,
      layover_minutes: layoverMin,
    });
  }

  return {
    depart: dep.toISOString(),
    arrive: arr.toISOString(),
    depart_local: formatTime(dep),
    arrive_local: formatTime(arr),
    duration_minutes: totalMin,
    duration_label: formatDuration(totalMin),
    stops,
    segments,
    overnight: arr.getDate() !== dep.getDate(),
  };
}

// --- Public: search flights ----------------------------------------------
export function searchFlights({
  origin,
  destination,
  departure_date,
  return_date = null,
  trip_type = "round_trip",
  passengers = 1,
  cabin_class = "economy",
  time_of_day = "any",
  sort = "best",
}) {
  // Validate airports
  const o = AIRPORTS.find(a => a.code === origin);
  const d = AIRPORTS.find(a => a.code === destination);
  if (!o || !d) {
    return {
      error: `Unknown airport code: ${!o ? origin : destination}`,
      results: [],
    };
  }
  if (o.code === d.code) {
    return { error: "Origin and destination must be different", results: [] };
  }

  // Validate dates
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dep = new Date(departure_date + "T00:00:00");
  if (isNaN(dep.getTime())) {
    return { error: `Invalid departure_date: ${departure_date}`, results: [] };
  }
  if (dep < today) {
    return { error: "Departure date is in the past", results: [] };
  }
  if (trip_type === "round_trip") {
    if (!return_date) {
      return { error: "round_trip requires return_date", results: [] };
    }
    const ret = new Date(return_date + "T00:00:00");
    if (isNaN(ret.getTime()) || ret < dep) {
      return { error: "Return date must be on or after departure date", results: [] };
    }
  }

  const km = haversineKm(o, d);
  const baseMin = flightMinutes(km);
  const carriers = carriersForRoute(o, d);
  const seed = seedFromString(`${origin}-${destination}-${departure_date}`);
  const rand = rng(seed);

  // Number of options scales with distance: short hops have more daily flights.
  const numOptions = km < 1500 ? 8 : km < 5000 ? 6 : 5;

  const options = [];
  for (let i = 0; i < numOptions; i++) {
    const carrier = carriers[Math.floor(rand() * carriers.length)];
    const flightNum = 100 + Math.floor(rand() * 8900);

    // Stops: long-haul intercontinental usually requires a stop.
    const stopProb = km < 2000 ? 0.15 : km < 6000 ? 0.55 : 0.8;
    const stops = rand() < stopProb ? 1 : 0;

    // Departure hour spread across the day
    const depHour = Math.floor(rand() * 24);
    const depMin = [0, 10, 15, 25, 30, 45, 55][Math.floor(rand() * 7)];

    const stopExtraMin = stops * (60 + Math.floor(rand() * 180));
    const totalMin = baseMin + stopExtraMin + Math.floor(rand() * 30 - 15);

    // Price
    let price =
      basePriceUSD(km, cabin_class) *
      leadTimeMult(daysUntil(departure_date)) *
      (stops === 0 ? 1.18 : 0.92) *
      (0.85 + rand() * 0.4);

    if (trip_type === "round_trip") price *= 1.92; // RT discount vs 2x one-way

    const outbound = buildLeg({
      origin: o, dest: d, dateISO: departure_date,
      carrier, flightNum, depHour, depMin, totalMin, stops, rand,
    });

    let inbound = null;
    if (trip_type === "round_trip") {
      const rCarrier = carriers[Math.floor(rand() * carriers.length)];
      const rFlight = 100 + Math.floor(rand() * 8900);
      const rHour = Math.floor(rand() * 24);
      const rMin = [0, 10, 15, 25, 30, 45, 55][Math.floor(rand() * 7)];
      const rStops = rand() < stopProb ? 1 : 0;
      const rTotal = baseMin + rStops * (60 + Math.floor(rand() * 180)) + Math.floor(rand() * 30 - 15);
      inbound = buildLeg({
        origin: d, dest: o, dateISO: return_date,
        carrier: rCarrier, flightNum: rFlight,
        depHour: rHour, depMin: rMin, totalMin: rTotal, stops: rStops, rand,
      });
    }

    options.push({
      id: `flt_${seed.toString(36)}_${i}`,
      price_usd: Math.round(price * passengers),
      price_per_passenger_usd: Math.round(price),
      passengers,
      cabin_class,
      trip_type,
      outbound,
      inbound,
      total_duration_minutes:
        outbound.duration_minutes + (inbound?.duration_minutes ?? 0),
      booking_url: buildGoogleFlightsURL({
        origin, destination, departure_date, return_date, trip_type,
        passengers, cabin_class,
      }),
    });
  }

  // Filter by time-of-day preference (on the outbound)
  let filtered = options;
  if (time_of_day && time_of_day !== "any") {
    filtered = options.filter(opt => {
      const h = new Date(opt.outbound.depart).getHours();
      return hourInWindow(h, time_of_day);
    });
    // If too aggressive a filter, fall back to all.
    if (filtered.length === 0) filtered = options;
  }

  // Sort
  if (sort === "cheapest") {
    filtered.sort((a, b) => a.price_usd - b.price_usd);
  } else if (sort === "fastest") {
    filtered.sort((a, b) => a.total_duration_minutes - b.total_duration_minutes);
  } else {
    // "best" = simple blended score: normalized price + normalized duration
    const maxP = Math.max(...filtered.map(o => o.price_usd));
    const maxD = Math.max(...filtered.map(o => o.total_duration_minutes));
    filtered.sort(
      (a, b) =>
        a.price_usd / maxP + a.total_duration_minutes / maxD -
        (b.price_usd / maxP + b.total_duration_minutes / maxD)
    );
  }

  return {
    query: {
      origin, destination, departure_date, return_date, trip_type,
      passengers, cabin_class, time_of_day, sort,
    },
    distance_km: Math.round(km),
    results: filtered.slice(0, 5),
    result_count: filtered.length,
  };
}

// --- Booking handoff URL (used by both the agent and result cards) -------
function buildGoogleFlightsURL({
  origin, destination, departure_date, return_date, trip_type,
}) {
  const q =
    trip_type === "round_trip"
      ? `Flights from ${origin} to ${destination} on ${departure_date} returning ${return_date}`
      : `One-way flights from ${origin} to ${destination} on ${departure_date}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`;
}
