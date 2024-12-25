import { HStack, Text, Box, Heading } from '@chakra-ui/react';
import PropTypes from 'prop-types';

const Statistics = ({ data }) => {
  const calculateStats = (values) => {
    const filteredValues = values.filter(v => v !== undefined && !isNaN(v));
    if (filteredValues.length === 0) return { max: 0, min: 0, avg: 0 };
    
    return {
      max: Math.max(...filteredValues),
      min: Math.min(...filteredValues),
      avg: filteredValues.reduce((a, b) => a + b, 0) / filteredValues.length
    };
  };

  const pressure1Stats = calculateStats(
    data.map(point => point.p1 || point['Pressure1 (bar)'])
  );

  const pressure2Stats = calculateStats(
    data.map(point => point.p2 || point['Pressure2 (bar)'])
  );
  
  const loadStats = calculateStats(
    data.map(point => point.l || point['Load (kg)'])
  );
  
  const tempStats = calculateStats(
    data.map(point => point.tp || point['Temperature (°C)'])
  );

  return (
    <Box p={4} bg="white" shadow="sm" rounded="lg" w="full">
      <Heading size="sm" mb={4}>Test Statistics</Heading>
      <HStack align="start" spacing={4}>
        <Box>
          <Text fontWeight="bold">Pressure (bar), sensor 1</Text>
          <Text>Max: {pressure1Stats.max.toFixed(2)}</Text>
          <Text>Min: {pressure1Stats.min.toFixed(2)}</Text>
          <Text>Avg: {pressure1Stats.avg.toFixed(2)}</Text>
        </Box>
        <Box>
          <Text fontWeight="bold">Pressure (bar), sensor 2</Text>
          <Text>Max: {pressure2Stats.max.toFixed(2)}</Text>
          <Text>Min: {pressure2Stats.min.toFixed(2)}</Text>
          <Text>Avg: {pressure2Stats.avg.toFixed(2)}</Text>
        </Box>
        <Box>
          <Text fontWeight="bold">Load (kg)</Text>
          <Text>Max: {loadStats.max.toFixed(2)}</Text>
          <Text>Min: {loadStats.min.toFixed(2)}</Text>
          <Text>Avg: {loadStats.avg.toFixed(2)}</Text>
        </Box>
        <Box>
          <Text fontWeight="bold">Temperature (°C)</Text>
          <Text>Max: {tempStats.max.toFixed(2)}</Text>
          <Text>Min: {tempStats.min.toFixed(2)}</Text>
          <Text>Avg: {tempStats.avg.toFixed(2)}</Text>
        </Box>
      </HStack>
    </Box>
  );
};

Statistics.propTypes = {
  data: PropTypes.arrayOf(PropTypes.object).isRequired
};

export default Statistics;