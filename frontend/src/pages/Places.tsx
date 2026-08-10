import { useEffect, useState } from 'react';
import { entitiesApi, type ContextEntity } from '../services/api';
import { MapPin, Search, Navigation, Map } from 'lucide-react';
import './Places.css';

function Places() {
  const [places, setPlaces] = useState<ContextEntity[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<ContextEntity | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadPlaces();
  }, []);

  const loadPlaces = async () => {
    try {
      setLoading(true);
      const response = await entitiesApi.getPlaces();
      setPlaces(response.data.data);
    } catch (error) {
      console.error('Error loading places:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceClick = async (place: ContextEntity) => {
    try {
      const response = await entitiesApi.getById(place.id);
      setSelectedPlace(response.data.data.entity);
    } catch (error) {
      console.error('Error loading place details:', error);
    }
  };

  const filteredPlaces = places.filter(place =>
    place.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="places-page">
        <div className="places-header">
          <div className="skeleton" style={{ width: '200px', height: '40px' }}></div>
        </div>
        <div className="places-content">
          <div className="skeleton" style={{ width: '100%', height: '400px' }}></div>
        </div>
      </div>
    );
  }

  return (
    <div className="places-page">
      <div className="places-header">
        <div>
          <h1>Places</h1>
          <p className="subtitle">{places.length} locations in your context</p>
        </div>

        <div className="search-box">
          <Search size={18} />
          <input 
            type="text"
            placeholder="Search places..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="places-content">
        <div className="places-grid">
          {filteredPlaces.length === 0 ? (
            <div className="empty-places">
              <MapPin size={48} />
              <h3>No places found</h3>
              <p>Places will appear here as you visit locations</p>
            </div>
          ) : (
            filteredPlaces.map(place => (
              <div 
                key={place.id}
                className="place-card"
                onClick={() => handlePlaceClick(place)}
              >
                <div className="place-icon">
                  <MapPin size={24} />
                </div>
                <div className="place-info">
                  <h3 className="place-name">{place.title}</h3>
                  <div className="place-meta">
                    <span className="place-type">Place</span>
                    {place.properties.inferredFrom && (
                      <span className="place-source">
                        From event {String(place.properties.inferredFrom).substring(0, 8)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {selectedPlace && (
          <div className="place-detail-modal" onClick={() => setSelectedPlace(null)}>
            <div className="place-detail-card" onClick={e => e.stopPropagation()}>
              <div className="place-detail-header">
                <div className="place-detail-icon">
                  <Navigation size={32} />
                </div>
                <div>
                  <h2>{selectedPlace.title}</h2>
                  <p className="place-detail-type">Place</p>
                </div>
              </div>

              <div className="place-detail-section">
                <h4><Map size={16} /> Properties</h4>
                <div className="properties-grid">
                  {Object.entries(selectedPlace.properties).map(([key, value]) => (
                    <div key={key} className="property-row">
                      <span className="property-key">{key}:</span>
                      <span className="property-value">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="place-detail-section">
                <h4>Timeline</h4>
                <div className="timeline-info">
                  <div className="timeline-item">
                    <span>First visited:</span>
                    <span>{new Date(selectedPlace.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="timeline-item">
                    <span>Last updated:</span>
                    <span>{new Date(selectedPlace.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <button 
                className="close-detail-btn"
                onClick={() => setSelectedPlace(null)}
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

export default Places;
