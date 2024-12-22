import { Line } from 'react-chartjs-2';
import { useRef, useEffect, useContext } from 'react';
import PropTypes from 'prop-types';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import annotationPlugin from 'chartjs-plugin-annotation';
import { chartOptions } from '../config/chartConfig';
import DataContext from '../hooks/DataContext';

// Register the necessary components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  zoomPlugin,
  annotationPlugin
);

const Chart = ({ xAxis, yAxis, labels, colors, title }) => {
    const chartRef = useRef();
    const { ignitionDelay } = useContext(DataContext);
  
    const data = {
      datasets: labels.map((label, index) => ({
        label,
        data: yAxis[index].map((y, i) => ({
          x: xAxis[i],
          y
        })),
        borderColor: colors[index],
        pointRadius: 0
      }))
    };

  
    useEffect(() => {
      if (chartRef.current) {
        chartRef.current.update(); // Updates the chart when data changes
      }
    }, [xAxis, yAxis]);

  return <Line ref={chartRef} options={chartOptions(title, ignitionDelay)} data={data} />
};

Chart.propTypes = {
  xAxis: PropTypes.arrayOf(PropTypes.number).isRequired,
  yAxis: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number)).isRequired,
  labels: PropTypes.arrayOf(PropTypes.string).isRequired,
  colors: PropTypes.arrayOf(PropTypes.string).isRequired,
  title: PropTypes.string
};

export default Chart;