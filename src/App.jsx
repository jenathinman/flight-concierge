import { useState, useEffect, useRef, useMemo } from "react";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { buildSystemPrompt } from "./instructions";
import { resolveAirports, searchFlights } from "./flightSearch";

// --- Tool declarations the model can call --------------------------------
const tools = [
  {
    functionDeclarations: [
      {
        name: "resolve_airports",
        description:
          "Resolve a city name, airport name, or IATA code into one or more airports. Use this any time the user gives you a place that isn't already a 3-letter IATA code, OR when a city has multiple airports and you need to confirm which one.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            query: {
              type: SchemaType.STRING,
              description: 'Free-text place name, e.g. "Seattle", "New York", "Heathrow", or an IATA code like "LHR".',
            },
          },
          required: ["query"],
        },
      },
      {
        name: "search_flights",
        description:
          "Search for flights. Only call this once you have a confirmed origin IATA code, destination IATA code, departure_date in YYYY-MM-DD, and (for round trips) a return_date. The result is rendered as cards in the UI under your text reply.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            origin: { type: SchemaType.STRING, description: "Origin IATA code, 3 letters." },
            destination: { type: SchemaType.STRING, description: "Destination IATA code, 3 letters." },
            departure_date: { type: SchemaType.STRING, description: "YYYY-MM-DD." },
            return_date: { type: SchemaType.STRING, description: "YYYY-MM-DD. Required for round_trip." },
            trip_type: {
              type: SchemaType.STRING,
              enum: ["one_way", "round_trip"],
              description: "Defaults to round_trip if the user didn't say.",
            },
            passengers: { type: SchemaType.INTEGER, description: "Number of adult passengers. Default 1." },
            cabin_class: {
              type: SchemaType.STRING,
              enum: ["economy", "premium_economy", "business", "first"],
              description: "Default economy.",
            },
            time_of_day: {
              type: SchemaType.STRING,
              enum: ["morning", "afternoon", "evening", "red_eye", "any"],
              description: "User's outbound time preference. Default any.",
            },
            sort: {
              type: SchemaType.STRING,
              enum: ["best", "cheapest", "fastest"],
              description: "Sort order. Default best.",
            },
          },
          required: ["origin", "destination", "departure_date"],
        },
      },
    ],
  },
];

// Local tool dispatcher
function runTool(name, args) {
  if (name === "resolve_airports") return resolveAirports(args);
  if (name === "search_flights") return searchFlights(args);
  return { error: `Unknown tool: ${name}` };
}

// --- Component -----------------------------------------------------------
function App() {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState([]); // [{role, text, flights?, airports?}]
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  // Build the chat session once. systemInstruction depends on today's date.
  const chat = useMemo(() => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) return null;
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: buildSystemPrompt(new Date()),
      tools,
    });
    return model.startChat({ history: [] });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, isTyping]);

  // The agent loop: send a message, and keep responding to function calls
  // until the model returns plain text. Capped to avoid runaway loops.
  async function sendMessage() {
    const text = input.trim();
    if (!text || !chat || isTyping) return;
    setError(null);
    setInput("");
    setHistory(h => [...h, { role: "user", text }]);
    setIsTyping(true);

    try {
      let result = await chat.sendMessage(text);
      let safetyCounter = 0;

      while (safetyCounter++ < 5) {
        const calls = result.response.functionCalls();
        if (!calls || calls.length === 0) break;

        // Run all calls (they're independent in our setup).
        const toolResponses = calls.map(call => ({
          functionResponse: {
            name: call.name,
            response: runTool(call.name, call.args),
          },
        }));

        // Attach side-effects to the UI for any search_flights call.
        for (let i = 0; i < calls.length; i++) {
          const call = calls[i];
          const response = toolResponses[i].functionResponse.response;
          if (call.name === "search_flights" && response?.results?.length) {
            // We'll attach to the upcoming model text message below.
            // Stash on a ref so we can pick it up.
            pendingAttachments.current.flights = response;
          }
          if (call.name === "resolve_airports" && response?.airports?.length > 1) {
            pendingAttachments.current.airports = response.airports;
          }
        }

        result = await chat.sendMessage(toolResponses);
      }

      const finalText = result.response.text();
      const attachments = pendingAttachments.current;
      pendingAttachments.current = {};

      setHistory(h => [
        ...h,
        {
          role: "model",
          text: finalText,
          flights: attachments.flights,
          airports: attachments.airports,
        },
      ]);
    } catch (e) {
      console.error(e);
      setError(e.message || "Something went wrong.");
      setHistory(h => [
        ...h,
        {
          role: "model",
          text: "Sorry — I hit turbulence reaching the server. Mind trying again?",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  }

  // Tiny ref-bag for attaching tool results to the next assistant turn.
  const pendingAttachments = useRef({});

  const showApiKeyWarning = !import.meta.env.VITE_GEMINI_API_KEY;

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div style={styles.brand}>
          <span style={styles.logoMark}>✈</span>
          <div>
            <h1 style={styles.title}>SkyBound Concierge</h1>
            <p style={styles.subtitle}>Tell me where, when, and how you like to fly.</p>
          </div>
        </div>
      </header>

      {showApiKeyWarning && (
        <div style={styles.warning}>
          Set <code>VITE_GEMINI_API_KEY</code> in a <code>.env</code> file to enable the assistant.
        </div>
      )}

      <main style={styles.chatBox}>
        {history.length === 0 && (
          <div style={styles.starter}>
            <p style={{ marginBottom: 12, color: "#666" }}>Try one of these:</p>
            {[
              "Round trip SEA to Tokyo, Dec 10-22, economy for 2",
              "Cheapest morning flights from JFK to London next Friday",
              "One-way SFO to Mexico City on Jan 5",
            ].map(s => (
              <button
                key={s}
                onClick={() => setInput(s)}
                style={styles.starterChip}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {history.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}

        {isTyping && (
          <div style={styles.typing}>
            <span style={styles.typingDot} />
            <span style={{ ...styles.typingDot, animationDelay: "0.15s" }} />
            <span style={{ ...styles.typingDot, animationDelay: "0.3s" }} />
            <span style={{ marginLeft: 8, color: "#666" }}>
              Concierge is checking routes…
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      <div style={styles.inputRow}>
        <input
          style={styles.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendMessage()}
          placeholder="e.g., 2 adults, SEA → BOM June 13–27, prefer mornings"
          disabled={isTyping || !chat}
        />
        <button
          onClick={sendMessage}
          disabled={isTyping || !chat || !input.trim()}
          style={{
            ...styles.sendBtn,
            ...(isTyping || !chat || !input.trim() ? styles.sendBtnDisabled : {}),
          }}
        >
          Send
        </button>
      </div>

      {error && <div style={styles.errorBar}>{error}</div>}

      <style>{keyframes}</style>
    </div>
  );
}

// --- Message bubble ------------------------------------------------------
function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        marginBottom: 18,
      }}
    >
      <div
        style={{
          maxWidth: "85%",
          background: isUser ? "#0a58ca" : "#ffffff",
          color: isUser ? "#fff" : "#1a1a1a",
          padding: "12px 16px",
          borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          border: isUser ? "none" : "1px solid #e4e6eb",
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
        }}
      >
        {msg.text}
      </div>

      {msg.airports && <AirportPicker airports={msg.airports} />}
      {msg.flights && <FlightResults data={msg.flights} />}
    </div>
  );
}

// --- Airport disambiguator -----------------------------------------------
function AirportPicker({ airports }) {
  return (
    <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
      {airports.map(a => (
        <div key={a.code} style={styles.airportChip}>
          <div style={{ fontWeight: 700, color: "#0a58ca" }}>{a.code}</div>
          <div style={{ fontSize: 13 }}>{a.city}</div>
          <div style={{ fontSize: 11, color: "#777" }}>{a.name}</div>
        </div>
      ))}
    </div>
  );
}

// --- Flight result cards -------------------------------------------------
function FlightResults({ data }) {
  if (!data.results?.length) return null;
  return (
    <div style={{ marginTop: 12, width: "100%", maxWidth: 640 }}>
      <div style={styles.resultsHeader}>
        <strong>{data.results.length} options</strong>
        <span style={{ color: "#666", fontSize: 13 }}>
          {data.query.origin} → {data.query.destination}
          {data.query.return_date ? ` · returning ${data.query.return_date}` : ""}
          {" · "}
          {data.query.cabin_class.replace("_", " ")}
          {data.query.passengers > 1 ? ` · ${data.query.passengers} pax` : ""}
        </span>
      </div>
      {data.results.map(opt => (
        <FlightCard key={opt.id} option={opt} />
      ))}
    </div>
  );
}

function FlightCard({ option }) {
  const { outbound, inbound, price_usd, passengers, cabin_class, booking_url } = option;
  return (
    <div style={styles.flightCard}>
      <div style={styles.flightCardLeft}>
        <Leg leg={outbound} label="Outbound" />
        {inbound && (
          <>
            <div style={styles.legDivider} />
            <Leg leg={inbound} label="Return" />
          </>
        )}
      </div>
      <div style={styles.flightCardRight}>
        <div style={styles.price}>${price_usd.toLocaleString()}</div>
        <div style={styles.priceSub}>
          {passengers > 1 ? `total for ${passengers}` : "total"}
        </div>
        <div style={styles.cabinTag}>{cabin_class.replace("_", " ")}</div>
        <a
          href={booking_url}
          target="_blank"
          rel="noreferrer"
          style={styles.bookBtn}
        >
          Book →
        </a>
      </div>
    </div>
  );
}

function Leg({ leg, label }) {
  const carriers = [...new Set(leg.segments.map(s => s.airline))].join(" + ");
  return (
    <div>
      <div style={styles.legLabel}>{label}</div>
      <div style={styles.legTimes}>
        <div>
          <div style={styles.bigTime}>{leg.depart_local}</div>
          <div style={styles.code}>{leg.segments[0].from}</div>
        </div>
        <div style={styles.legMid}>
          <div style={styles.duration}>{leg.duration_label}</div>
          <div style={styles.legLine}>
            <span style={styles.legDot} />
            {leg.stops > 0 && <span style={styles.legStop}>{leg.stops} stop</span>}
            <span style={styles.legDot} />
          </div>
          <div style={styles.duration}>
            {leg.stops === 0 ? "Nonstop" : `${leg.stops} stop`}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={styles.bigTime}>
            {leg.arrive_local}
            {leg.overnight && <sup style={{ color: "#d97706", fontSize: 10 }}>+1</sup>}
          </div>
          <div style={styles.code}>
            {leg.segments[leg.segments.length - 1].to}
          </div>
        </div>
      </div>
      <div style={styles.carrier}>{carriers}</div>
    </div>
  );
}

// --- Styles --------------------------------------------------------------
const styles = {
  app: {
    maxWidth: 720,
    margin: "0 auto",
    padding: "20px 16px 32px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "#1a1a1a",
  },
  header: { marginBottom: 16 },
  brand: { display: "flex", alignItems: "center", gap: 12 },
  logoMark: {
    fontSize: 28,
    width: 44, height: 44,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    background: "linear-gradient(135deg, #0a58ca, #6366f1)",
    color: "#fff", borderRadius: 10,
  },
  title: { margin: 0, fontSize: 22, fontWeight: 600 },
  subtitle: { margin: "2px 0 0", color: "#666", fontSize: 14 },
  warning: {
    background: "#fef3c7", border: "1px solid #fde68a",
    color: "#78350f", padding: "10px 14px", borderRadius: 8,
    fontSize: 14, marginBottom: 12,
  },
  chatBox: {
    height: 540, overflowY: "auto",
    border: "1px solid #e4e6eb", padding: 18, borderRadius: 14,
    marginBottom: 12, background: "#fafbfc",
    display: "flex", flexDirection: "column",
  },
  starter: { padding: "20px 4px", textAlign: "center" },
  starterChip: {
    display: "block", margin: "8px auto", padding: "8px 14px",
    background: "#fff", border: "1px solid #d1d5db", borderRadius: 999,
    cursor: "pointer", fontSize: 14, maxWidth: 460,
  },
  typing: {
    display: "flex", alignItems: "center",
    padding: "8px 12px", alignSelf: "flex-start",
  },
  typingDot: {
    width: 8, height: 8, borderRadius: "50%", background: "#999",
    display: "inline-block", margin: "0 2px",
    animation: "bounce 1s infinite",
  },
  inputRow: { display: "flex", gap: 8 },
  input: {
    flex: 1, padding: "14px 16px", borderRadius: 10,
    border: "1px solid #d1d5db", fontSize: 15, outline: "none",
  },
  sendBtn: {
    padding: "14px 22px", background: "#0a58ca", color: "#fff",
    border: "none", borderRadius: 10, fontWeight: 600, fontSize: 15,
    cursor: "pointer",
  },
  sendBtnDisabled: { background: "#cbd5e1", cursor: "not-allowed" },
  errorBar: {
    marginTop: 10, padding: "10px 14px",
    background: "#fee2e2", border: "1px solid #fecaca", color: "#7f1d1d",
    borderRadius: 8, fontSize: 14,
  },
  airportChip: {
    background: "#fff", border: "1px solid #e4e6eb",
    padding: "8px 12px", borderRadius: 10, minWidth: 140,
  },
  resultsHeader: {
    display: "flex", justifyContent: "space-between",
    alignItems: "baseline", marginBottom: 8, padding: "0 2px",
  },
  flightCard: {
    display: "flex", background: "#fff", border: "1px solid #e4e6eb",
    borderRadius: 12, padding: 14, marginBottom: 10, gap: 14,
    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
  },
  flightCardLeft: { flex: 1 },
  flightCardRight: {
    display: "flex", flexDirection: "column", alignItems: "flex-end",
    justifyContent: "center", gap: 4, minWidth: 110,
    borderLeft: "1px solid #f1f3f5", paddingLeft: 14,
  },
  legDivider: { height: 1, background: "#f1f3f5", margin: "12px 0" },
  legLabel: {
    fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5,
    color: "#888", marginBottom: 4, fontWeight: 600,
  },
  legTimes: { display: "flex", alignItems: "center", gap: 12 },
  bigTime: { fontSize: 18, fontWeight: 700 },
  code: { fontSize: 12, color: "#666" },
  legMid: { flex: 1, textAlign: "center", padding: "0 4px" },
  duration: { fontSize: 11, color: "#777" },
  legLine: {
    position: "relative", margin: "4px 0",
    height: 2, background: "#d1d5db", borderRadius: 1,
    display: "flex", alignItems: "center", justifyContent: "space-between",
  },
  legDot: {
    width: 6, height: 6, borderRadius: "50%", background: "#0a58ca",
  },
  legStop: {
    position: "absolute", left: "50%", transform: "translateX(-50%)",
    top: -8, fontSize: 10, background: "#fef3c7",
    color: "#78350f", padding: "1px 6px", borderRadius: 6,
  },
  carrier: { fontSize: 12, color: "#555", marginTop: 6 },
  price: { fontSize: 22, fontWeight: 700, color: "#0a58ca" },
  priceSub: { fontSize: 11, color: "#888" },
  cabinTag: {
    fontSize: 11, textTransform: "capitalize",
    background: "#eef2ff", color: "#3730a3",
    padding: "2px 8px", borderRadius: 6,
  },
  bookBtn: {
    marginTop: 6, padding: "6px 14px",
    background: "#198754", color: "#fff",
    borderRadius: 6, textDecoration: "none",
    fontWeight: 600, fontSize: 13,
  },
};

const keyframes = `
@keyframes bounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-4px); opacity: 1; }
}
`;

export default App;
