import { useEffect, useState } from 'react';
import { contextApi, type ContextEntity, type ContextRelation } from '../services/api';
import { Network, Search, Filter, Layers } from 'lucide-react';
import './ContextGraph.css';

function ContextGraph() {
  const [entities, setEntities] = useState<ContextEntity[]>([]);
  const [relations, setRelations] = useState<ContextRelation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntity, setSelectedEntity] = useState<ContextEntity | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadGraph();
  }, []);

  const loadGraph = async () => {
    try {
      setLoading(true);
      const response = await contextApi.getGraph();
      setEntities(response.data.data.entities);
      setRelations(response.data.data.relations);
    } catch (error) {
      console.error('Error loading context graph:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEntityClick = async (entity: ContextEntity) => {
    setSelectedEntity(entity);
  };

  const getEntityColor = (type: string) => {
    const colors: Record<string, string> = {
      'Person': '#6366f1',
      'Place': '#10b981',
      'Event': '#f59e0b',
      'Document': '#ef4444',
      'Task': '#8b5cf6',
      'Commitment': '#ec4899',
      'Object': '#6b7280',
      'Preference': '#3b82f6',
    };
    return colors[type] || '#6b7280';
  };

  const getRelationColor = (type: string) => {
    const colors: Record<string, string> = {
      'DEPENDS_ON': '#ef4444',
      'REQUIRES': '#f59e0b',
      'KNOWS': '#6366f1',
      'LOCATED_AT': '#10b981',
      'MENTIONED_IN': '#6b7280',
    };
    return colors[type] || '#6b7280';
  };

  const filteredEntities = entities.filter(entity => {
    const matchesType = filter === 'all' || entity.type === filter;
    const matchesSearch = !searchQuery || 
      entity.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entity.type.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const entityTypes = Array.from(new Set(entities.map(e => e.type)));
  const relationTypes = Array.from(new Set(relations.map(r => r.type)));

  if (loading) {
    return (
      <div className="context-graph-page">
        <div className="graph-header">
          <div className="skeleton" style={{ width: '200px', height: '40px' }}></div>
        </div>
        <div className="graph-content">
          <div className="skeleton" style={{ width: '100%', height: '500px' }}></div>
        </div>
      </div>
    );
  }

  return (
    <div className="context-graph-page">
      <div className="graph-header">
        <div>
          <h1>Context Graph</h1>
          <p className="subtitle">
            {entities.length} entities • {relations.length} relations
          </p>
        </div>

        <div className="graph-controls">
          <div className="search-box">
            <Search size={18} />
            <input 
              type="text"
              placeholder="Search entities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select 
            className="filter-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All Types</option>
            {entityTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="graph-content">
        <div className="graph-visualization">
          <div className="visualization-placeholder">
            <Network size={64} />
            <h3>Interactive Graph Visualization</h3>
            <p>
              Full interactive graph visualization would use libraries like D3.js, vis.js, or Cytoscape.js
            </p>
            <div className="visualization-features">
              <div className="feature-item">
                <Layers size={20} />
                <span>Force-directed layout</span>
              </div>
              <div className="feature-item">
                <Filter size={20} />
                <span>Node filtering & clustering</span>
              </div>
              <div className="feature-item">
                <Search size={20} />
                <span>Path finding</span>
              </div>
            </div>
          </div>
        </div>

        <div className="graph-sidebar">
          {selectedEntity ? (
            <div className="entity-detail">
              <div className="entity-detail-header">
                <div 
                  className="entity-detail-icon"
                  style={{ backgroundColor: getEntityColor(selectedEntity.type) }}
                >
                  {selectedEntity.type[0]}
                </div>
                <div>
                  <div className="entity-detail-type">{selectedEntity.type}</div>
                  <h3 className="entity-detail-title">{selectedEntity.title}</h3>
                </div>
              </div>

              <div className="entity-detail-section">
                <h4>Properties</h4>
                <div className="properties-list">
                  {Object.entries(selectedEntity.properties).map(([key, value]) => (
                    <div key={key} className="property-item">
                      <div className="property-key">{key}</div>
                      <div className="property-value">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="entity-detail-section">
                <h4>Relationships</h4>
                <div className="relationships-list">
                  {relations
                    .filter(r => r.sourceId === selectedEntity.id || r.targetId === selectedEntity.id)
                    .map(relation => {
                      const otherEntityId = relation.sourceId === selectedEntity.id 
                        ? relation.targetId 
                        : relation.sourceId;
                      const otherEntity = entities.find(e => e.id === otherEntityId);
                      
                      return (
                        <div key={relation.id} className="relationship-item">
                          <div 
                            className="relationship-type"
                            style={{ borderColor: getRelationColor(relation.type) }}
                          >
                            {relation.type.replace(/_/g, ' ')}
                          </div>
                          <div className="relationship-target">
                            {otherEntity?.title || 'Unknown'}
                          </div>
                          <div className="relationship-confidence">
                            {Math.round(relation.confidence * 100)}%
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              <div className="entity-detail-meta">
                <div className="meta-item">
                  <span className="meta-label">Created</span>
                  <span className="meta-value">
                    {new Date(selectedEntity.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Updated</span>
                  <span className="meta-value">
                    {new Date(selectedEntity.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="entity-list">
              <h3>Entities ({filteredEntities.length})</h3>
              <div className="entities-scroll">
                {filteredEntities.map(entity => (
                  <div 
                    key={entity.id}
                    className="entity-card"
                    onClick={() => handleEntityClick(entity)}
                  >
                    <div 
                      className="entity-card-icon"
                      style={{ backgroundColor: getEntityColor(entity.type) }}
                    >
                      {entity.type[0]}
                    </div>
                    <div className="entity-card-content">
                      <div className="entity-card-type">{entity.type}</div>
                      <div className="entity-card-title">{entity.title}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="graph-legend">
        <div className="legend-section">
          <h4>Entity Types</h4>
          <div className="legend-items">
            {entityTypes.map(type => (
              <div key={type} className="legend-item">
                <div 
                  className="legend-color"
                  style={{ backgroundColor: getEntityColor(type) }}
                ></div>
                <span>{type}</span>
                <span className="legend-count">
                  ({entities.filter(e => e.type === type).length})
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="legend-section">
          <h4>Relation Types</h4>
          <div className="legend-items">
            {relationTypes.map(type => (
              <div key={type} className="legend-item">
                <div 
                  className="legend-color"
                  style={{ backgroundColor: getRelationColor(type) }}
                ></div>
                <span>{type.replace(/_/g, ' ')}</span>
                <span className="legend-count">
                  ({relations.filter(r => r.type === type).length})
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ContextGraph;
