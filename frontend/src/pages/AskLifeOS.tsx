import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Send, Sparkles, Calendar, FileText, CheckSquare } from 'lucide-react';
import { askApi } from '../services/api';
import './AskLifeOS.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  items?: any[];
  suggestionChips?: string[];
  timestamp: string;
}

export function AskLifeOS() {
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hello! I'm **LifeOS**. I understand your calendar, locations, notifications, and tasks. What would you like to know about your day?",
      suggestionChips: [
        "When should I leave for my appointment?",
        "What do I need to do tomorrow?",
        "What documents do I need?",
        "Who am I meeting this week?"
      ],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  ]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const initialQ = params.get('q');
    if (initialQ) {
      handleAsk(initialQ);
    }
  }, [location.search]);

  const handleAsk = async (textToAsk: string) => {
    if (!textToAsk.trim() || loading) return;

    const userMsg: Message = {
      role: 'user',
      content: textToAsk,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setQuery('');
    setLoading(true);

    try {
      const res = await askApi.ask(textToAsk);
      if (res.data?.data) {
        const assistantMsg: Message = {
          role: 'assistant',
          content: res.data.data.answer,
          items: res.data.data.items,
          suggestionChips: res.data.data.suggestionChips,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages(prev => [...prev, assistantMsg]);
      }
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Sorry, I had trouble answering that. Please try another question.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ask-page">
      <div className="ask-header">
        <div className="ask-title">
          <Sparkles className="sparkle-icon" size={24} />
          <div>
            <h2>Ask LifeOS</h2>
            <p>Conversational assistant powered by your contextual knowledge graph</p>
          </div>
        </div>
      </div>

      <div className="chat-thread">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-bubble ${msg.role}`}>
            <div className="bubble-header">
              <span className="sender">{msg.role === 'assistant' ? '🤖 LifeOS' : '👤 You'}</span>
              <span className="time">{msg.timestamp}</span>
            </div>

            <div className="bubble-text" dangerouslySetInnerHTML={{ 
              __html: msg.content
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n/g, '<br/>') 
            }} />

            {/* Attached structured items */}
            {msg.items && msg.items.length > 0 && (
              <div className="attached-cards-row">
                {msg.items.map((item, idx) => (
                  <div key={idx} className="attached-card">
                    {item.type === 'event' && <Calendar size={16} className="text-primary" />}
                    {item.type === 'doc' && <FileText size={16} className="text-success" />}
                    {item.type === 'task' && <CheckSquare size={16} className="text-warning" />}
                    <div>
                      <strong>{item.title}</strong>
                      {item.time && <span> · {item.time}</span>}
                      {item.tag && <span className="item-tag">{item.tag}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Suggested Chips */}
            {msg.suggestionChips && msg.suggestionChips.length > 0 && (
              <div className="chips-row">
                {msg.suggestionChips.map((chip, idx) => (
                  <button key={idx} className="chip-btn" onClick={() => handleAsk(chip)}>
                    {chip}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="chat-bubble assistant loading">
            <div className="typing-dots">
              <span /><span /><span />
            </div>
          </div>
        )}
      </div>

      {/* Input Box */}
      <form className="ask-input-box" onSubmit={e => { e.preventDefault(); handleAsk(query); }}>
        <input 
          type="text" 
          placeholder="Ask anything about your day, travel times, documents, or tasks..." 
          value={query}
          onChange={e => setQuery(e.target.value)}
          disabled={loading}
        />
        <button type="submit" className="send-btn" disabled={loading || !query.trim()}>
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
export default AskLifeOS;
