import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, 
  Calendar as CalendarIcon, 
  CheckSquare, 
  MessageSquare, 
  Search,
  Sparkles,
  Shield,
  Settings,
  Clock,
  Navigation,
  Users,
  FileText,
  Brain,
  SlidersHorizontal,
  Menu,
  X
} from 'lucide-react';
import { stateApi } from '../services/api';
import OnboardingModal from './OnboardingModal';
import ReliabilityModal from './ReliabilityModal';
import './Layout.css';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [focusMode, setFocusMode] = useState('NORMAL');
  const [quickSearch, setQuickSearch] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showReliability, setShowReliability] = useState(false);

  useEffect(() => {
    // Check if onboarding completed
    const completed = localStorage.getItem('lifeos_onboarding_completed');
    if (!completed) {
      setShowOnboarding(true);
    }

    // Load focus mode
    stateApi.getFocusMode().then(res => {
      if (res.data?.mode) setFocusMode(res.data.mode);
    }).catch(() => {});
  }, []);

  const handleFocusChange = async (mode: string) => {
    setFocusMode(mode);
    try {
      await stateApi.setFocusMode(mode);
    } catch {}
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickSearch.trim()) {
      navigate(`/ask?q=${encodeURIComponent(quickSearch.trim())}`);
      setQuickSearch('');
    }
  };

  const mainNav = [
    { path: '/', label: 'Home (Now)', icon: <Home size={20} /> },
    { path: '/calendar', label: 'Calendar', icon: <CalendarIcon size={20} /> },
    { path: '/tasks', label: 'Tasks', icon: <CheckSquare size={20} /> },
    { path: '/ask', label: 'Ask LifeOS', icon: <MessageSquare size={20} /> },
  ];

  const moreNav = [
    { path: '/memory', label: 'Memory (What LifeOS knows)', icon: <Brain size={18} /> },
    { path: '/timeline', label: 'Timeline History', icon: <Clock size={18} /> },
    { path: '/location', label: 'Location & Places', icon: <Navigation size={18} /> },
    { path: '/people', label: 'People & Contacts', icon: <Users size={18} /> },
    { path: '/documents', label: 'Documents', icon: <FileText size={18} /> },
    { path: '/privacy', label: 'Privacy Center', icon: <Shield size={18} /> },
    { path: '/settings', label: 'Settings', icon: <Settings size={18} /> },
  ];

  return (
    <div className="app-container">
      {/* Top Header Bar */}
      <header className="top-header">
        <div className="header-left">
          <button 
            className="sidebar-toggle" 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle Navigation"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="logo" onClick={() => navigate('/')}>
            <div className="logo-badge">L</div>
            <span className="logo-title">LifeOS</span>
            <span className="version-pill">v1.0</span>
          </div>
        </div>

        {/* Global Ask Search Bar */}
        <form className="header-search-form" onSubmit={handleSearchSubmit}>
          <Search size={16} className="search-icon" />
          <input 
            type="text" 
            placeholder="Ask LifeOS anything... (e.g. 'When should I leave for my appointment?')" 
            value={quickSearch}
            onChange={e => setQuickSearch(e.target.value)}
          />
          <button type="submit" className="search-submit-btn">Ask</button>
        </form>

        <div className="header-right">
          {/* Focus Mode Selector */}
          <div className="focus-mode-wrapper">
            <SlidersHorizontal size={15} />
            <select value={focusMode} onChange={e => handleFocusChange(e.target.value)}>
              <option value="NORMAL">Normal Focus</option>
              <option value="WORK">💼 Work Focus</option>
              <option value="DRIVING">🚗 Driving Mode</option>
              <option value="MEETING">👥 In Meeting</option>
              <option value="SLEEP">🌙 Quiet Hours</option>
              <option value="TRAVEL">✈️ Travel Focus</option>
            </select>
          </div>

          {/* Reliability Health Indicator */}
          <button className="reliability-pill" onClick={() => setShowReliability(true)}>
            <div className="status-dot-pulse" />
            <span>🟢 Active</span>
          </button>

          {/* Tour/Help */}
          <button className="tour-btn" onClick={() => setShowOnboarding(true)} title="Product Tour & Settings">
            <Sparkles size={16} />
          </button>
        </div>
      </header>

      <div className="layout-body">
        {/* Simplified Sidebar */}
        <aside className={`app-sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
          <div className="nav-section-title">{sidebarOpen ? 'PRIMARY' : '—'}</div>
          <nav className="nav-group">
            {mainNav.map(item => (
              <Link 
                key={item.path} 
                to={item.path} 
                className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
                title={item.label}
              >
                <span className="icon">{item.icon}</span>
                {sidebarOpen && <span className="label">{item.label}</span>}
              </Link>
            ))}
          </nav>

          <div className="nav-section-title">{sidebarOpen ? 'MORE & PRIVACY' : '—'}</div>
          <div className="more-accordion">
            {moreNav.map(item => (
              <Link 
                key={item.path} 
                to={item.path} 
                className={`nav-link sub ${location.pathname === item.path ? 'active' : ''}`}
                title={item.label}
              >
                <span className="icon">{item.icon}</span>
                {sidebarOpen && <span className="label">{item.label}</span>}
              </Link>
            ))}
          </div>

          <div className="sidebar-bottom-card">
            {sidebarOpen && (
              <div className="privacy-badge-card" onClick={() => navigate('/privacy')}>
                <Shield size={16} className="text-success" />
                <div>
                  <strong>Local-First Privacy</strong>
                  <p>Data stored safely on device</p>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="main-content-scroll">
          {children}
        </main>
      </div>

      {/* Modals */}
      <OnboardingModal isOpen={showOnboarding} onClose={() => setShowOnboarding(false)} />
      <ReliabilityModal isOpen={showReliability} onClose={() => setShowReliability(false)} />
    </div>
  );
}
export default Layout;
