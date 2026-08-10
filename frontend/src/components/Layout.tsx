import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  Clock, 
  Bell, 
  Network, 
  CheckSquare, 
  Users, 
  MapPin, 
  FileText, 
  BarChart3, 
  Shield, 
  Settings,
  Menu,
  X,
  Calendar as CalendarIcon,
  Navigation
} from 'lucide-react';
import './Layout.css';

interface LayoutProps {
  children: ReactNode;
}

interface NavItem {
  path: string;
  label: string;
  icon: ReactNode;
}

const navItems: NavItem[] = [
  { path: '/', label: 'Home', icon: <Home size={20} /> },
  { path: '/timeline', label: 'Timeline', icon: <Clock size={20} /> },
  { path: '/calendar', label: 'Calendar', icon: <CalendarIcon size={20} /> },
  { path: '/location', label: 'Location', icon: <Navigation size={20} /> },
  { path: '/interventions', label: 'Interventions', icon: <Bell size={20} /> },
  { path: '/context', label: 'Context Graph', icon: <Network size={20} /> },
  { path: '/tasks', label: 'Tasks', icon: <CheckSquare size={20} /> },
  { path: '/people', label: 'People', icon: <Users size={20} /> },
  { path: '/places', label: 'Places', icon: <MapPin size={20} /> },
  { path: '/documents', label: 'Documents', icon: <FileText size={20} /> },
  { path: '/insights', label: 'Insights', icon: <BarChart3 size={20} /> },
  { path: '/privacy', label: 'Privacy', icon: <Shield size={20} /> },
  { path: '/settings', label: 'Settings', icon: <Settings size={20} /> },
];

function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon">L</div>
            {sidebarOpen && <span className="logo-text">LifeOS</span>}
          </div>
          <button 
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              title={item.label}
            >
              <span className="nav-icon">{item.icon}</span>
              {sidebarOpen && <span className="nav-label">{item.label}</span>}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="context-engine-status">
            <div className={`status-indicator ${sidebarOpen ? '' : 'compact'}`}>
              <div className="status-dot active"></div>
              {sidebarOpen && (
                <div className="status-text">
                  <div className="status-label">Context Engine</div>
                  <div className="status-value">Active</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className={`main-content ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
        {children}
      </main>
    </div>
  );
}

export default Layout;
