import { useState } from 'react'
import { GoogleGenerativeAI } from "@google/generative-ai"
import { flightConciergePrompt } from './instructions'

const genAI = new GoogleGenerativeAI("AIzaSyB9mCU6X1mBGpXBlvse6caVR_rZ7iYfM6M");
const model = genAI.getGenerativeModel({ 
  model: "gemini-1.5-flash",
  systemInstruction: flightConciergePrompt 
});

function App() {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState([]);
  const [chat] = useState(model.startChat({ history: [] }));

  const sendMessage = async () => {
    const userMsg = { role: "user", parts: [{ text: input }] };
    const result = await chat.sendMessage(input);
    const botText = await result.response.text();
    
    setHistory([...history, userMsg, { role: "model", parts: [{ text: botText }] }]);
    setInput("");
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: 'auto' }}>
      <h2>✈️ Flight Concierge</h2>
      <div className="chat-box" style={{ height: '400px', overflowY: 'scroll', border: '1px solid #ccc' }}>
        {history.map((msg, i) => <p key={i}><strong>{msg.role}:</strong> {msg.parts[0].text}</p>)}
      </div>
      <input value={input} onChange={(e) => setInput(e.target.value)} />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
}

export default App;