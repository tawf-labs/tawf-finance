import { Navigation, Footer } from './components/layout';
import { Hero, Features, HowItWorks, Impact } from './components/sections';

function App() {
  return (
    <div className="min-h-screen bg-tawf-sand">
      <Navigation />

      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Impact />
      </main>

      <Footer />
    </div>
  );
}

export default App;
