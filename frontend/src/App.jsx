import { BrowserRouter as Router, Route, Switch, Link } from 'react-router-dom';
import { useDataManager } from './hooks/useDataManager';
import DataContext from './hooks/DataContext';
import { ChartControls, PressureChart, LoadCellChart, TemperatureChart } from './components/Charts';
import Controls from './components/Controls';
import ImportPage from './components/ImportPage';
import './App.css';

function App() {
  const dataManager = useDataManager();

  return (
    <DataContext.Provider value={dataManager}>
      <Router>
        <div className="app">
          <nav>
            <Link to="/">Home</Link>
            <Link to="/import">Import CSV</Link>
          </nav>
          <Switch>
            <Route exact path="/">
              <h1>Rocket Test Dashboard</h1>
              <Controls />
              <div className="ignition-delay">
                {dataManager.ignitionDelay !== null && (
                  <p>Ignition Delay: {dataManager.ignitionDelay.toFixed(6)} seconds</p>
                )}
              </div>
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
            </Route>
            <Route path="/import">
              <ImportPage />
            </Route>
          </Switch>
        </div>
      </Router>
    </DataContext.Provider>
  );
}

export default App;