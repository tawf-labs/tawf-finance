import { Routes, Route } from 'react-router-dom';
import { Navigation, Footer } from './components/layout';
import { Home, Earn } from './components/pages';

function App() {
  return (
    <div className="min-h-screen bg-tawf-sand">
      <Navigation />

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/earn" element={<Earn />} />
        </Routes>
      </main>

      <Footer />
    </div>
  );
}

export default App;
