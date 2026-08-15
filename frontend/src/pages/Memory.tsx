import { useState, useEffect } from 'react';
import { Brain, Users, MapPin, FileText, Repeat, Trash2 } from 'lucide-react';
import { memoryApi } from '../services/api';
import './Memory.css';

export function Memory() {
  const [memory, setMemory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'people' | 'places' | 'documents' | 'routines'>('all');

  useEffect(() => {
    loadMemory();
  }, []);

  const loadMemory = async () => {
    try {
      const res = await memoryApi.getAll();
      if (res.data?.data) {
        setMemory(res.data.data);
      }
    } catch (e) {
      console.error('Error loading memory:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleForget = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want LifeOS to forget "${name}"?`)) {
      try {
        await memoryApi.forget(id);
        loadMemory();
      } catch (e) {
        console.error('Error forgetting memory:', e);
      }
    }
  };

  if (loading || !memory) {
    return <div className="loading-state">Loading LifeOS Memory...</div>;
  }

  const allItems = [
    ...memory.people.map((p: any) => ({ ...p, icon: <Users size={16} /> })),
    ...memory.places.map((pl: any) => ({ ...pl, icon: <MapPin size={16} /> })),
    ...memory.documents.map((d: any) => ({ ...d, icon: <FileText size={16} /> })),
    ...memory.routines.map((r: any) => ({ ...r, icon: <Repeat size={16} /> })),
  ];

  const displayItems = activeTab === 'all' 
    ? allItems 
    : allItems.filter(item => item.category.toLowerCase() === activeTab);

  return (
    <div className="memory-page">
      <div className="memory-header">
        <div className="title-row">
          <Brain size={28} className="text-primary" />
          <div>
            <h2>What LifeOS Remembers</h2>
            <p>Transparent knowledge base of learned relationships, places, documents, and habits.</p>
          </div>
        </div>

        <div className="memory-tabs">
          {['all', 'people', 'places', 'documents', 'routines'].map(tab => (
            <button 
              key={tab} 
              className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab as any)}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="memory-grid">
        {displayItems.map((item, idx) => (
          <div key={idx} className="memory-card">
            <div className="card-top">
              <span className="cat-badge">{item.icon} {item.category}</span>
              <button 
                className="forget-btn" 
                onClick={() => handleForget(item.id, item.title)}
                title="Forget this fact"
              >
                <Trash2 size={15} /> Forget this
              </button>
            </div>

            <h4>{item.title}</h4>
            <p className="detail-text">{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
export default Memory;
