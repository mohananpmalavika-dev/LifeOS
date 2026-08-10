import { useEffect, useState } from 'react';
import { entitiesApi, type ContextEntity } from '../services/api';
import { FileText, Search, File, Eye } from 'lucide-react';
import './Documents.css';

function Documents() {
  const [documents, setDocuments] = useState<ContextEntity[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<ContextEntity | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const response = await entitiesApi.getDocuments();
      setDocuments(response.data.data);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentClick = async (document: ContextEntity) => {
    try {
      const response = await entitiesApi.getById(document.id);
      setSelectedDocument(response.data.data.entity);
    } catch (error) {
      console.error('Error loading document details:', error);
    }
  };

  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="documents-page">
        <div className="documents-header">
          <div className="skeleton" style={{ width: '200px', height: '40px' }}></div>
        </div>
        <div className="documents-content">
          <div className="skeleton" style={{ width: '100%', height: '400px' }}></div>
        </div>
      </div>
    );
  }

  return (
    <div className="documents-page">
      <div className="documents-header">
        <div>
          <h1>Documents</h1>
          <p className="subtitle">{documents.length} documents in your context</p>
        </div>

        <div className="search-box">
          <Search size={18} />
          <input 
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="documents-content">
        <div className="documents-grid">
          {filteredDocuments.length === 0 ? (
            <div className="empty-documents">
              <FileText size={48} />
              <h3>No documents found</h3>
              <p>Documents will appear here from OCR and file imports</p>
            </div>
          ) : (
            filteredDocuments.map(document => (
              <div 
                key={document.id}
                className="document-card"
                onClick={() => handleDocumentClick(document)}
              >
                <div className="document-icon">
                  <File size={24} />
                </div>
                <div className="document-info">
                  <h3 className="document-name">{document.title}</h3>
                  <div className="document-meta">
                    <span className="document-type">Document</span>
                    {document.properties.inferredFrom && (
                      <span className="document-source">
                        From event {String(document.properties.inferredFrom).substring(0, 8)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {selectedDocument && (
          <div className="document-detail-modal" onClick={() => setSelectedDocument(null)}>
            <div className="document-detail-card" onClick={e => e.stopPropagation()}>
              <div className="document-detail-header">
                <div className="document-detail-icon">
                  <Eye size={32} />
                </div>
                <div>
                  <h2>{selectedDocument.title}</h2>
                  <p className="document-detail-type">Document</p>
                </div>
              </div>

              <div className="document-detail-section">
                <h4><FileText size={16} /> Properties</h4>
                <div className="properties-grid">
                  {Object.entries(selectedDocument.properties).map(([key, value]) => (
                    <div key={key} className="property-row">
                      <span className="property-key">{key}:</span>
                      <span className="property-value">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="document-detail-section">
                <h4>Timeline</h4>
                <div className="timeline-info">
                  <div className="timeline-item">
                    <span>Created:</span>
                    <span>{new Date(selectedDocument.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="timeline-item">
                    <span>Last updated:</span>
                    <span>{new Date(selectedDocument.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <button 
                className="close-detail-btn"
                onClick={() => setSelectedDocument(null)}
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

export default Documents;
