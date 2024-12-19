import { PressureChart, TemperatureChart, ThrustChart } from './components/Charts';
import StartButton from './components/StartButton';
import './App.css';

function App() {
  return (
    <>
      <div>
        <StartButton />
      </div>
      <PressureChart />
      <TemperatureChart />
      <ThrustChart />
    </>
  );
}

export default App;