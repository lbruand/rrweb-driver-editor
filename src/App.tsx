import { RrwebPlayer } from './components/RrwebPlayer';
import './App.css';

function App() {
  return (
    <div className="app">
      <RrwebPlayer recordingUrl="/recording_jupyterlite.json" />
    </div>
  );
}

export default App;