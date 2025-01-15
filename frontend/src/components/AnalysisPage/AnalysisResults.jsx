/* eslint-disable react/prop-types */
import { Heading, Text, Box, Table, Thead, Tbody, Tr, Th, Td, Badge } from '@chakra-ui/react';

// Display the results computed in AnalysisPage
const AnalysisResults = ({ analysisResults }) => {
  if (!analysisResults) return null;

  const {
    partialIntegrationStartPoint,
    partialIntegrationEndPoint,
    partialIntegrationStartTime,
    partialIntegrationEndTime,
    partialIntegralDuration,
    fullIntegralDuration,
    ignitionDelay,
    integrals,
    stats
  } = analysisResults;

  // Helper to format float values
  const fmt = (num) => (typeof num === 'number' ? num.toFixed(3) : num);

  return (
    <Box>
      <Heading 
        size="lg" 
        mb={6} 
        color="blue.600" 
        textAlign="center"
      >
        Analysis Results 
        <Badge
          ml={3}
          colorScheme="gray"
        >
          From
        </Badge>
        <Badge 
          ml={3} 
          colorScheme="green"
        >
          {`${partialIntegrationStartPoint} (${partialIntegrationStartTime})`}
        </Badge>
        <Badge
          ml={3}
          colorScheme="gray"
        >
          To
        </Badge>
        <Badge 
          ml={3} 
          colorScheme="green"
        >
          {`${partialIntegrationEndPoint} (${partialIntegrationEndTime})`}
        </Badge>
      </Heading>

      <Table size="sm" mt={4}>
        <Thead>
          <Tr>
            <Th>Parameter</Th>
            <Th isNumeric>Value</Th>
          </Tr>
        </Thead>
        <Tbody>
          <Tr>
            <Td>Partial Integral Duration</Td>
            <Td isNumeric>{fmt(partialIntegralDuration)} s</Td>
          </Tr>
          <Tr>
            <Td>Full Integral Duration</Td>
            <Td isNumeric>{fmt(fullIntegralDuration)} s</Td>
          </Tr>
          <Tr>
            <Td>Ignition Delay (Real ignition Timestamp)</Td>
            <Td isNumeric>{fmt(ignitionDelay)} s</Td>
          </Tr>
        </Tbody>
      </Table>

      {/* Display integrals */}
      <Heading size="sm" mt={4}>Partial Integrals</Heading>
      {Object.entries(integrals.partial).map(([sensorType, sensorArray]) => (
        <Box key={`partial-${sensorType}`} mt={3}>
          <Text fontWeight="bold">{sensorType.toUpperCase()}</Text>
          <Table size="sm" mt={1}>
            <Thead>
              <Tr>
                <Th>Sensor</Th>
                <Th isNumeric>Integral</Th>
              </Tr>
            </Thead>
            <Tbody>
              {sensorArray.map((sensor) => (
                <Tr key={`partial-${sensor.name}`}>
                  <Td>{sensor.name}</Td>
                  <Td isNumeric>{fmt(sensor.value)}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      ))}

      <Heading size="sm" mt={4}>Full Integrals</Heading>
      {Object.entries(integrals.full).map(([sensorType, sensorArray]) => (
        <Box key={`full-${sensorType}`} mt={3}>
          <Text fontWeight="bold">{sensorType.toUpperCase()}</Text>
          <Table size="sm" mt={1}>
            <Thead>
              <Tr>
                <Th>Sensor</Th>
                <Th isNumeric>Integral</Th>
              </Tr>
            </Thead>
            <Tbody>
              {sensorArray.map((sensor) => (
                <Tr key={`full-${sensor.name}`}>
                  <Td>{sensor.name}</Td>
                  <Td isNumeric>{fmt(sensor.value)}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      ))}

      {/* Display stats */}
      <Heading size="sm" mt={6}>Sensor Statistics</Heading>
      <Text mt={2} fontSize="sm">
      (The statistics are computed only in bounds of the partial integral)
      </Text>
      {Object.entries(stats).map(([sensorType, sensorArray]) => (
        <Box key={`stats-${sensorType}`} mt={3}>
          <Text fontWeight="bold">{sensorType.toUpperCase()}</Text>
          <Table size="sm" mt={1}>
            <Thead>
              <Tr>
                <Th>Sensor</Th>
                <Th isNumeric>Min</Th>
                <Th isNumeric>Max</Th>
                <Th isNumeric>Average</Th>
              </Tr>
            </Thead>
            <Tbody>
              {sensorArray.map((sensor) => (
                <Tr key={`stats-${sensor.name}`}>
                  <Td>{sensor.name}</Td>
                  <Td isNumeric>{fmt(sensor.min)}</Td>
                  <Td isNumeric>{fmt(sensor.max)}</Td>
                  <Td isNumeric>{fmt(sensor.avg)}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      ))}
    </Box>
  );
};

export default AnalysisResults;