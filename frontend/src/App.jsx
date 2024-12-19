import { ChartControls, PressureChart, LoadCellChart, TemperatureChart } from './components/Charts';
import Controls from './components/Controls';
import './App.css';

function App() {
  return (
    <div className="app">
      <h1>Rocket Test Dashboard</h1>
      <Controls />
      <ChartControls />
      <div className="charts">
        <div className="chart">
          <h2>Pressure Sensors</h2>
          <PressureChart />
        </div>
        <div className="chart">
          <h2>Load Cell</h2>
          <LoadCellChart />
        </div>
        <div className="chart">
          <h2>Temperature</h2>
          <TemperatureChart />
        </div>
      </div>
    </div>
  );
}

export default App;