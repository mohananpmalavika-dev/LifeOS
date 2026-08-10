import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Timeline from './pages/Timeline';
import Interventions from './pages/Interventions';
import ContextGraph from './pages/ContextGraph';
import Tasks from './pages/Tasks';
import People from './pages/People';
import Places from './pages/Places';
import Documents from './pages/Documents';
import Insights from './pages/Insights';
import Privacy from './pages/Privacy';
import Settings from './pages/Settings';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/interventions" element={<Interventions />} />
          <Route path="/context" element={<ContextGraph />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/people" element={<People />} />
          <Route path="/places" element={<Places />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
