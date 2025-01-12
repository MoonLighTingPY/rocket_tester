/* eslint-disable react/prop-types */
import { 
  VStack, HStack, Box, Heading,
  FormControl, FormLabel, RadioGroup, Radio,
  NumberInput, NumberInputField, Select, Button,
  SimpleGrid, 
} from '@chakra-ui/react';

const AnalysisControls = ({ settings, setSettings, handleFileUpload, runAnalysis, data }) => {
const handleNumberInputChange = (field, value) => {
  if (value === '' || isNaN(value)) {
    setSettings(prev => ({
      ...prev,
      [field]: ''
    }));
  } else {
    setSettings(prev => ({
      ...prev,
      [field]: parseFloat(value)
    }));
  }
};

return (
  <Box 
    bg="white" 
    shadow="lg" 
    rounded="xl" 
    p={8} 
    w="full" 
    maxW="800px" 
    mx="auto"
  >
    <VStack spacing={8} align="stretch">
      <Heading size="lg" color="blue.600" textAlign="center">
        Analysis Settings
      </Heading>

      <FormControl mb={6}>
        <FormLabel fontWeight="bold">Upload Filtered Data CSV</FormLabel>
        <Box
          p={4}
          border="2px dashed"
          borderColor="gray.200"
          borderRadius="md"
          _hover={{ borderColor: "blue.400" }}
        >
          <input 
            type="file" 
            accept=".csv" 
            onChange={handleFileUpload}
            style={{
              width: '100%',
              cursor: 'pointer'
            }}
          />
        </Box>
      </FormControl>

      <SimpleGrid columns={2} spacing={8}>
        {/* Start Settings */}
        <VStack align="stretch" spacing={4}>
          <FormControl>
            <FormLabel>Integration Start Point</FormLabel>
            <Select 
              value={settings.integrationStart}
              onChange={e => setSettings(prev => ({ ...prev, integrationStart: e.target.value }))}
            >
              <option value="button">Ignition Button Press (First timestamp)</option>
              <option value="pressure">Pressure/Load Rise Threshold</option>
              <option value="ignition">Real Ignition Moment</option>
            </Select>
          </FormControl>

          {settings.integrationStart === 'pressure' && (
            <>
              <FormControl>
                <FormLabel fontWeight="bold">Rise Criterion</FormLabel>
                <RadioGroup 
                  value={settings.startCriterion}
                  onChange={value => setSettings(prev => ({ ...prev, startCriterion: value }))}
                >
                  <HStack spacing={4}>
                    <Radio value="pressure" colorScheme="blue">Pressure</Radio>
                    <Radio value="load" colorScheme="blue">Load</Radio>
                  </HStack>
                </RadioGroup>
              </FormControl>

              <FormControl>
                <FormLabel>
                  {settings.startCriterion === 'pressure' 
                    ? 'Start Pressure Threshold (bar)' 
                    : 'Start Load Threshold (kg)'}
                </FormLabel>
                <NumberInput 
                  value={settings.startCriterion === 'pressure' 
                    ? settings.ignitionPressureThreshold 
                    : settings.ignitionLoadThreshold}
                  onChange={(_, value) => handleNumberInputChange(
                    settings.startCriterion === 'pressure' 
                      ? 'ignitionPressureThreshold' 
                      : 'ignitionLoadThreshold', 
                    value
                  )}
                >
                  <NumberInputField />
                </NumberInput>
              </FormControl>
            </>
          )}
        </VStack>

        {/* End Settings */}
        <VStack align="stretch" spacing={4}>
          <FormControl>
            <FormLabel>Integration End Point</FormLabel>
            <Select 
              value={settings.integrationEnd}
              onChange={e => setSettings(prev => ({ ...prev, integrationEnd: e.target.value }))}
            >
              <option value="threshold">Pressure/Load Drop Threshold</option>
              <option value="button">End Button Press (Last Timestamp)</option>
            </Select>
          </FormControl>

          {settings.integrationEnd === 'threshold' && (
            <>
              <FormControl>
                <FormLabel fontWeight="bold">Drop Criterion</FormLabel>
                <RadioGroup 
                  value={settings.endCriterion}
                  onChange={value => setSettings(prev => ({ ...prev, endCriterion: value }))}
                >
                  <HStack>
                    <Radio value="pressure">Pressure</Radio>
                    <Radio value="load">Load</Radio>
                  </HStack>
                </RadioGroup>
              </FormControl>

              <FormControl>
                <FormLabel>
                  {settings.endCriterion === 'pressure' 
                    ? 'End Pressure Threshold (bar)' 
                    : 'End Load Threshold (kg)'}
                </FormLabel>
                <NumberInput 
                  value={settings.endCriterion === 'pressure' 
                    ? settings.endPressureThreshold 
                    : settings.endLoadThreshold}
                  onChange={(_, value) => handleNumberInputChange(
                    settings.endCriterion === 'pressure' 
                      ? 'endPressureThreshold' 
                      : 'endLoadThreshold', 
                    value
                  )}
                >
                  <NumberInputField />
                </NumberInput>
              </FormControl>
            </>
          )}
        </VStack>
      </SimpleGrid>

      <Button
        colorScheme="blue"
        size="lg"
        w="full"
        onClick={runAnalysis}
        isDisabled={!data.length}
        _hover={{ transform: 'translateY(-2px)' }}
        transition="all 0.2s"
      >
        Calculate Results
      </Button>
    </VStack>
  </Box>
);
};

export default AnalysisControls;