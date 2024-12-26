import { 
  Box, 
  Heading, 
  Table, 
  Thead, 
  Tbody, 
  Tr, 
  Th, 
  Td, 
  TableContainer,
  Badge
} from '@chakra-ui/react';

const AnalysisResults = ({ analysisResults }) => {
  if (!analysisResults) return null;

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
          {analysisResults.integrationStartPoint}
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
          {analysisResults.integrationEndPoint}
        </Badge>
      </Heading>

      <TableContainer 
        whiteSpace="normal" 
        maxWidth="100%" 
        overflowX="auto"
        boxShadow="sm"
        borderRadius="lg"
      >
        <Table 
          variant="striped" 
          colorScheme="blue"
          size={{ base: "sm", md: "md" }}
        >
          <Thead bg="blue.50">
            <Tr>
              <Th fontSize="md" color="gray.700">Parameter</Th>
              <Th fontSize="md" color="gray.700" isNumeric>Value</Th>
            </Tr>
          </Thead>
          <Tbody>
            <Tr>
              <Td fontWeight="medium">Integration Start Time</Td>
              <Td isNumeric>{analysisResults.integrationStartTime?.toFixed(6)} s</Td>
            </Tr>
            <Tr>
              <Td fontWeight="medium">Integration End Time</Td>
              <Td isNumeric>{analysisResults.engineEndTime?.toFixed(6)} s</Td>
            </Tr>
            <Tr>
              <Td fontWeight="medium">Total Duration</Td>
              <Td isNumeric>{analysisResults.duration.toFixed(6)} s</Td>
            </Tr>
            {/* Pressure Data */}
            <Tr>
              <Td fontWeight="medium">Avg Pressure 1</Td>
              <Td isNumeric>{analysisResults.avgPressure1.toFixed(2)} bar</Td>
            </Tr>
            <Tr>
              <Td fontWeight="medium">Avg Pressure 2</Td>
              <Td isNumeric>{analysisResults.avgPressure2.toFixed(2)} bar</Td>
            </Tr>
            {/* Load and Temperature */}
            <Tr>
              <Td fontWeight="medium">Avg Load</Td>
              <Td isNumeric>{analysisResults.avgLoad.toFixed(2)} kg</Td>
            </Tr>
            <Tr>
              <Td fontWeight="medium">Avg Temperature</Td>
              <Td isNumeric>{analysisResults.avgTemperature.toFixed(2)} °C</Td>
            </Tr>
            {/* Integrals */}
            <Tr>
              <Td fontWeight="medium">Partial Pressure 1 Integral</Td>
              <Td isNumeric>{analysisResults.partialPressureIntegral1?.toFixed(2)} bar·s</Td>
            </Tr>
            <Tr>
              <Td fontWeight="medium">Partial Pressure 2 Integral</Td>
              <Td isNumeric>{analysisResults.partialPressureIntegral2?.toFixed(2)} bar·s</Td>
            </Tr>
            <Tr>
              <Td fontWeight="medium">Partial Load Integral</Td>
              <Td isNumeric>{analysisResults.partialLoadIntegral?.toFixed(2)} kg·s</Td>
            </Tr>
            <Tr>
              <Td fontWeight="medium">Partial Temperature Integral</Td>
              <Td isNumeric>{analysisResults.partialTemperatureIntegral?.toFixed(2)} °C·s</Td>
            </Tr>
            <Tr>
              <Td fontWeight="medium">Full Pressure 1 Integral</Td>
              <Td isNumeric>{analysisResults.fullPressureIntegral1?.toFixed(2)} bar·s</Td>
            </Tr>
            <Tr>
              <Td fontWeight="medium">Full Pressure 2 Integral</Td>
              <Td isNumeric>{analysisResults.fullPressureIntegral2?.toFixed(2)} bar·s</Td>
            </Tr>
            <Tr>
              <Td fontWeight="medium">Full Load Integral</Td>
              <Td isNumeric>{analysisResults.fullLoadIntegral?.toFixed(2)} kg·s</Td>
            </Tr>
            <Tr>
              <Td fontWeight="medium">Full Temperature Integral</Td>
              <Td isNumeric>{analysisResults.fullTemperatureIntegral?.toFixed(2)} °C·s</Td>
            </Tr>
          </Tbody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default AnalysisResults;