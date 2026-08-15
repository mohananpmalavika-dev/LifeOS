import { useState, useEffect } from 'react';
import { Brain, Users, MapPin, FileText, Repeat, Trash2, Edit3, X } from 'lucide-react';
import { memoryApi } from '../services/api';
import './Memory.css';

export function Memory() {
  const [memory, setMemory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'people' | 'places' | 'documents' | 'routines'>('all');
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDetail, setEditDetail] = useState('');
  const [editSemanticType, setEditSemanticType] = useState('WORK');

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

  const handleOpenEdit = (item: any) => {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditDetail(item.detail);
    setEditSemanticType(item.semanticType || 'WORK');
  };

  const handleSaveCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
      await memoryApi.update(editingItem.id, {
        title: editTitle,
        detail: editDetail,
        semanticType: editSemanticType,
      });
      setEditingItem(null);
      loadMemory();
    } catch (e) {
      console.error('Error saving correction:', e);
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

  const getOriginBadge = (origin?: string) => {
    switch (origin) {
      case 'USER_VERIFIED': return <span className="origin-badge verified">✓ User Verified</span>;
      case 'USER_SET': return <span className="origin-badge user">User Set</span>;
      default: return <span className="origin-badge learned">🧠 Learned Routine</span>;
    }
  };

  return (
    <div className="memory-page">
      <div className="memory-header">
        <div className="title-row">
          <Brain size={28} className="text-primary" />
          <div>
            <h2>What LifeOS Remembers</h2>
            <p>Transparent knowledge base. Correct inferred facts or remove anything you don't want remembered.</p>
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
              {getOriginBadge(item.origin)}
            </div>

            <h4>{item.title}</h4>
            <p className="detail-text">{item.detail}</p>

            <div className="card-bottom-actions">
              <button className="correct-btn" onClick={() => handleOpenEdit(item)}>
                <Edit3 size={13} /> Correct
              </button>
              <button 
                className="forget-btn" 
                onClick={() => handleForget(item.id, item.title)}
                title="Forget this fact"
              >
                <Trash2 size={13} /> Forget
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit / Correction Modal */}
      {editingItem && (
        <div className="modal-overlay" onClick={() => setEditingItem(null)}>
          <div className="edit-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Correct Fact: "{editingItem.title}"</h3>
              <button className="close-btn" onClick={() => setEditingItem(null)}><X size={18} /></button>
            </div>

            <form onSubmit={handleSaveCorrection}>
              <div className="input-group">
                <label>Name / Label</label>
                <input 
                  type="text" 
                  value={editTitle} 
                  onChange={e => setEditTitle(e.target.value)} 
                  required 
                />
              </div>

              {editingItem.category === 'Places' && (
                <div className="input-group">
                  <label>Place Type</label>
                  <select value={editSemanticType} onChange={e => setEditSemanticType(e.target.value)}>
                    <option value="WORK">💼 Work / Office</option>
                    <option value="HOME">🏠 Home</option>
                    <option value="HOSPITAL">🏥 Hospital / Clinic</option>
                    <option value="GYM">🏋️ Gym / Fitness</option>
                    <option value="SHOPPING_MALL">🛍️ Shopping / Market</option>
                    <option value="FAVORITE">⭐ Regular Spot</option>
                  </select>
                </div>
              )}

              <div className="input-group">
                <label>Relationship / Detail</label>
                <input 
                  type="text" 
                  value={editDetail} 
                  onChange={e => setEditDetail(e.target.value)} 
                  placeholder="e.g. Coworker, Doctor, Family" 
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setEditingItem(null)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Correction</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default Memory;
