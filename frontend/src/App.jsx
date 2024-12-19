import { useState } from 'react';
import Controls from './components/Controls';
import { PressureChart, LoadCellChart, TemperatureChart } from './components/Charts';
import './App.css';

function App() {
  const [data, setData] = useState({
    pressure: [],
    loadCell: [],
    temperature: []
  });

  return (
    <div className="app">
      <h1>Rocket Test Dashboard</h1>
      <Controls data={data} />
      <div className="charts">
        <div className="chart">
          <h2>Pressure Sensors</h2>
          <PressureChart data={data} setData={setData} />
        </div>
        <div className="chart">
          <h2>Load Cell</h2>
          <LoadCellChart data={data} setData={setData} />
        </div>
        <div className="chart">
          <h2>Temperature</h2>
          <TemperatureChart data={data} setData={setData} />
        </div>
      </div>
    </div>
  );
}

export default App;