import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Calendar from './pages/Calendar';
import Tasks from './pages/Tasks';
import AskLifeOS from './pages/AskLifeOS';
import Memory from './pages/Memory';
import Timeline from './pages/Timeline';
import Location from './pages/Location';
import People from './pages/People';
import Places from './pages/Places';
import Documents from './pages/Documents';
import Privacy from './pages/Privacy';
import Settings from './pages/Settings';
import DecisionDebugger from './pages/DecisionDebugger';
import Insights from './pages/Insights';
import ContextGraph from './pages/ContextGraph';
import Interventions from './pages/Interventions';
import { NotificationIntelligence } from './pages/NotificationIntelligence';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/ask" element={<AskLifeOS />} />
          <Route path="/memory" element={<Memory />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/location" element={<Location />} />
          <Route path="/people" element={<People />} />
          <Route path="/places" element={<Places />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/decision-debugger" element={<DecisionDebugger />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/context" element={<ContextGraph />} />
          <Route path="/interventions" element={<Interventions />} />
          <Route path="/notification-intelligence" element={<NotificationIntelligence />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
