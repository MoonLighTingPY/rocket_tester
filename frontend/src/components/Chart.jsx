import { Line } from 'react-chartjs-2';
import { useRef, useEffect, useContext, forwardRef } from 'react';
import PropTypes from 'prop-types';
import { Box } from '@chakra-ui/react';
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

const Chart = forwardRef(({ xAxis, yAxis, labels, colors, title }, ref) => {
  const preIgnitionChartRef = useRef();
  const { ignitionDelay, testData } = useContext(DataContext);

  // Split data into pre-ignition and post-ignition
  const splitData = () => {
    const preIgnitionData = [];
    const postIgnitionData = [];
    
    xAxis.forEach((x, i) => {
      const dataPoint = {
        x: x,
        y: yAxis.map(series => series[i])
      };
      
      // Check if ignition has occurred (ignitionT > 0)
      const isPostIgnition = testData[i]?.ignitionT > 0;
      
      if (!isPostIgnition) {
        // Use readingsT for pre-ignition data
        dataPoint.x = testData[i]?.readingsT;
        preIgnitionData.push(dataPoint);
      } else {
        postIgnitionData.push(dataPoint);
      }
    });
  
    return { preIgnitionData, postIgnitionData };
  };

  const createChartData = (data, useYIndex = true) => ({
    datasets: labels.map((label, index) => ({
      label,
      data: data.map(point => ({
        x: point.x,
        y: useYIndex ? point.y[index] : point.y
      })),
      borderColor: colors[index],
      pointRadius: 0
    }))
  });

  useEffect(() => {
    if (ref?.current) {
      ref.current.update();
    }
    if (preIgnitionChartRef.current) {
      preIgnitionChartRef.current.update();
    }
  }, [xAxis, yAxis]);


  const { preIgnitionData, postIgnitionData } = splitData();
  const hasPreIgnitionData = preIgnitionData.length > 0;
  const hasPostIgnitionData = postIgnitionData.length > 0;

  const preIgnitionOptions = {
    ...chartOptions(title + " (Pre-ignition)", null),
    aspectRatio: 0.8, // Make pre-ignition chart narrower
    plugins: {
      ...chartOptions(title, null).plugins,
      legend: {
        display: false // Hide legend in pre-ignition chart
      }
    }
  };

    return (
    <Box w="100%">
      <Box 
        display={{ base: 'block', md: 'flex' }} // Stack on mobile, row on desktop
        w="100%"
        gap={2}
      >
        {hasPreIgnitionData && (
          <Box 
            w={{ base: '100%', md: '30%' }} // Full width on mobile, 30% on desktop
            mb={{ base: 2, md: 0 }} // Margin bottom only on mobile
          >
            <Line 
              ref={preIgnitionChartRef}
              options={preIgnitionOptions}
              data={createChartData(preIgnitionData)}
            />
          </Box>
        )}
        {hasPostIgnitionData && (
          // Full width on mobile, 70% on desktop
          <Box w={{ base: '100%', md: '70%' }}> 
            <Line 
              ref={ref}
              options={chartOptions(title + " (Post-ignition)", ignitionDelay)}
              data={createChartData(postIgnitionData)}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
});

Chart.displayName = 'Chart';

Chart.propTypes = {
  xAxis: PropTypes.arrayOf(PropTypes.number).isRequired,
  yAxis: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number)).isRequired,
  labels: PropTypes.arrayOf(PropTypes.string).isRequired,
  colors: PropTypes.arrayOf(PropTypes.string).isRequired,
  title: PropTypes.string
};

export default Chart;