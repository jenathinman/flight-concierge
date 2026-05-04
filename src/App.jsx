import { useState, useEffect, useRef } from 'react'
import { GoogleGenerativeAI } from "@google/generative-ai"
import { flightConciergePrompt } from './instructions'

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
  model: "gemini-2.5-flash",
  systemInstruction: flightConciergePrompt 
});

function App() {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [chat] = useState(model.startChat({ history: [] }));
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [history, isTyping]); 

  const sendMessage = async () => {
    if (!input.trim()) return; 
    
    const userMsg = { role: "user", parts: [{ text: input }] };
    setHistory(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true); // Turn on the loading indicator

    try {
      const result = await chat.sendMessage(input);
      const botText = await result.response.text();
      
      let botMsg = { role: "model", parts: [{ text: botText }] };

      // Optimized Round-Trip Link Generation
      if (botText.includes("[SEARCH_DATA:")) {
        const match = botText.match(/\[SEARCH_DATA:\s*(.*?)\]/);
        if (match) {
          const [origin, dest, start, end, preference] = match[1].split(',').map(s => s.trim());
          
          // Google Flights can parse natural language modifiers like "morning flights"
          const searchQuery = `Flights from ${origin} to ${dest} leaving ${start} returning ${end}`;
          const flightUrl = `https://www.google.com/travel/flights?q=${encodeURIComponent(searchQuery)}`;
          
          botMsg.link = flightUrl;
          botMsg.parts[0].text = botText.replace(/\[SEARCH_DATA:.*?\]/, "I've optimized your bundle! Click below for the best options.");
        }
      }
      setHistory(prev => [...prev, botMsg]);
    } catch (error) {
      setHistory(prev => [...prev, { role: "model", parts: [{ text: "Sorry, I hit turbulence connecting to the server. Please try again." }] }]);
    } finally {
      setIsTyping(false); // Turn off the loading indicator
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: 'auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <h2 style={{ textAlign: 'center', color: '#333' }}>✈️ SkyBound Concierge</h2>
      
      <div className="chat-box" style={{ height: '500px', overflowY: 'auto', border: '1px solid #e0e0e0', padding: '20px', borderRadius: '12px', marginBottom: '15px', backgroundColor: '#fafafa', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        
        {history.map((msg, i) => (
          <div key={i} style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ 
              maxWidth: '80%',
              background: msg.role === 'user' ? '#0a58ca' : '#ffffff', 
              color: msg.role === 'user' ? 'white' : '#333', 
              padding: '12px 16px', 
              borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              border: msg.role === 'user' ? 'none' : '1px solid #e0e0e0',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
              lineHeight: '1.5'
            }}>
              {msg.parts[0].text}
            </div>
            
            {msg.link && (
              <a href={msg.link} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', marginTop: '10px' }}>
                <button style={{ backgroundColor: '#198754', color: 'white', padding: '12px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 2px 4px rgba(25, 135, 84, 0.3)' }}>
                  <svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M6.428 1.151C6.708.591 7.213 0 8 0s1.292.592 1.572 1.151C9.861 1.73 10 2.431 10 3v3.691l5.17 2.585a1.5 1.5 0 0 1 .83 1.342V12a.5.5 0 0 1-.582.493l-5.507-.918-.375 2.253 1.318 1.318A.5.5 0 0 1 10.5 16h-5a.5.5 0 0 1-.354-.854l1.319-1.318-.376-2.253-5.507.918A.5.5 0 0 1 0 12v-1.382a1.5 1.5 0 0 1 .83-1.342L6 6.691V3c0-.568.14-1.271.428-1.849Z"/></svg>
                  Find Optimized Bundle
                </button>
              </a>
            )}
          </div>
        ))}

        {/* Loading Indicator */}
        {isTyping && (
          <div style={{ alignSelf: 'flex-start', color: '#666', fontStyle: 'italic', padding: '10px' }}>
            Concierge is checking routes...
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      <div style={{ display: 'flex', gap: '10px' }}>
        <input 
          style={{ flex: 1, padding: '14px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '16px' }}
          value={input} 
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()} 
          placeholder="e.g., I need a morning flight from SEA to BOM on June 13..."
          disabled={isTyping}
        />
        <button 
          onClick={sendMessage} 
          disabled={isTyping}
          style={{ padding: '14px 24px', cursor: isTyping ? 'not-allowed' : 'pointer', background: isTyping ? '#ccc' : '#0a58ca', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '16px' }}>
          Send
        </button>
      </div>
    </div>
  );
}

export default App;