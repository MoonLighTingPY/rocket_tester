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
import ReadingContext from '../hooks/ReadingContext';

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

const MAX_POINTS = 1000;

const decimateData = (dataArray) => {
  if (dataArray.length <= MAX_POINTS) return dataArray;
  const ratio = Math.ceil(dataArray.length / MAX_POINTS);
  const result = [];
  for (let i = 0; i < dataArray.length; i += ratio) {
    result.push(dataArray[i]);
  }
  return result;
};

const Chart = forwardRef(({ xAxis, yAxis, labels, colors, title }, ref) => {
  const preIgnitionChartRef = useRef();
  const { ignitionDelay, testData } = useContext(DataContext);
  const { isReading } = useContext(ReadingContext);

  const splitData = () => {
    const preIgnitionData = [];
    const postIgnitionData = [];

    xAxis.forEach((x, i) => {
      const dataPoint = {
        x,
        y: yAxis.map((series) => series[i]),
      };
      const isPostIgnition = testData[i]?.ignitionT > 0;
      if (!isPostIgnition) {
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
      data: data.map((point) => ({
        x: point.x,
        y: useYIndex ? point.y[index] : point.y,
      })),
      borderColor: colors[index],
      pointRadius: 0,
    })),
  });

  useEffect(() => {
    if (ref?.current) {
      ref.current.update();
    }
    if (preIgnitionChartRef.current) {
      preIgnitionChartRef.current.update();
    }
  }, [xAxis, yAxis, ref]);

  const { preIgnitionData, postIgnitionData } = splitData();

  const decimatedPreIgnition = isReading ? decimateData(preIgnitionData) : preIgnitionData;
  const decimatedPostIgnition = isReading ? decimateData(postIgnitionData) : postIgnitionData;

  const hasPreIgnitionData = decimatedPreIgnition.length > 0;
  const hasPostIgnitionData = decimatedPostIgnition.length > 0;

  const preIgnitionOptions = {
    ...chartOptions(title + ' (Pre-ignition)', null),
    aspectRatio: 0.8,
    plugins: {
      ...chartOptions(title, null).plugins,
      legend: { display: false },
    },
  };

  return (
    <Box w="100%">
      <Box 
        display={{ base: 'block', md: 'flex' }} 
        w="100%"
        gap={2}
      >
        {hasPreIgnitionData && (
          <Box
            w={{ base: '100%', md: '30%' }}
            mb={{ base: 2, md: 0 }}
          >
            <Line
              ref={preIgnitionChartRef}
              options={preIgnitionOptions}
              data={createChartData(decimatedPreIgnition)}
            />
          </Box>
        )}
        {hasPostIgnitionData && (
          <Box w={{ base: '100%', md: '70%' }}>
            <Line
              ref={ref}
              options={chartOptions(title + ' (Post-ignition)', ignitionDelay)}
              data={createChartData(decimatedPostIgnition)}
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
  title: PropTypes.string,
};

Chart.defaultProps = {
  title: '',
};

export default Chart;