import { useEffect, useState } from 'react';
import { entitiesApi, type ContextEntity } from '../services/api';
import { Users, Search, MessageCircle, Calendar } from 'lucide-react';
import './People.css';

function People() {
  const [people, setPeople] = useState<ContextEntity[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<ContextEntity | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadPeople();
  }, []);

  const loadPeople = async () => {
    try {
      setLoading(true);
      const response = await entitiesApi.getPeople();
      setPeople(response.data.data);
    } catch (error) {
      console.error('Error loading people:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePersonClick = async (person: ContextEntity) => {
    try {
      const response = await entitiesApi.getById(person.id);
      setSelectedPerson(response.data.data.entity);
    } catch (error) {
      console.error('Error loading person details:', error);
    }
  };

  const filteredPeople = people.filter(person =>
    person.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="people-page">
        <div className="people-header">
          <div className="skeleton" style={{ width: '200px', height: '40px' }}></div>
        </div>
        <div className="people-content">
          <div className="skeleton" style={{ width: '100%', height: '400px' }}></div>
        </div>
      </div>
    );
  }

  return (
    <div className="people-page">
      <div className="people-header">
        <div>
          <h1>People</h1>
          <p className="subtitle">{people.length} people in your context</p>
        </div>

        <div className="search-box">
          <Search size={18} />
          <input 
            type="text"
            placeholder="Search people..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="people-content">
        <div className="people-grid">
          {filteredPeople.length === 0 ? (
            <div className="empty-people">
              <Users size={48} />
              <h3>No people found</h3>
              <p>People will appear here as they are mentioned in events</p>
            </div>
          ) : (
            filteredPeople.map(person => (
              <div 
                key={person.id}
                className="person-card"
                onClick={() => handlePersonClick(person)}
              >
                <div className="person-avatar">
                  {person.title.charAt(0).toUpperCase()}
                </div>
                <div className="person-info">
                  <h3 className="person-name">{person.title}</h3>
                  <div className="person-meta">
                    <span className="person-type">Person</span>
                    {person.properties.inferredFrom && (
                      <span className="person-source">
                        From event {String(person.properties.inferredFrom).substring(0, 8)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {selectedPerson && (
          <div className="person-detail-modal" onClick={() => setSelectedPerson(null)}>
            <div className="person-detail-card" onClick={e => e.stopPropagation()}>
              <div className="person-detail-header">
                <div className="person-detail-avatar">
                  {selectedPerson.title.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2>{selectedPerson.title}</h2>
                  <p className="person-detail-type">Person</p>
                </div>
              </div>

              <div className="person-detail-section">
                <h4><MessageCircle size={16} /> Properties</h4>
                <div className="properties-grid">
                  {Object.entries(selectedPerson.properties).map(([key, value]) => (
                    <div key={key} className="property-row">
                      <span className="property-key">{key}:</span>
                      <span className="property-value">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="person-detail-section">
                <h4><Calendar size={16} /> Timeline</h4>
                <div className="timeline-info">
                  <div className="timeline-item">
                    <span>First seen:</span>
                    <span>{new Date(selectedPerson.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="timeline-item">
                    <span>Last updated:</span>
                    <span>{new Date(selectedPerson.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <button 
                className="close-detail-btn"
                onClick={() => setSelectedPerson(null)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default People;
