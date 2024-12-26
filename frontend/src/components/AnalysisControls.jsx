import { useState } from 'react';
import { 
    VStack, HStack, Box, Card, CardHeader, CardBody, Heading,
    FormControl, FormLabel, RadioGroup, Radio, Stack,
    NumberInput, NumberInputField, Select, Button,
    SimpleGrid, 
  } from '@chakra-ui/react';
const AnalysisControls = ({ settings, setSettings, handleFileUpload, runAnalysis, data }) => {
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

      <FormControl>
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

      <SimpleGrid columns={[1, null, 2]} spacing={6}>
          <FormControl>
            <FormLabel fontWeight="bold">Engine Start Criterion</FormLabel>
            <RadioGroup 
              value={settings.startCriterion}
              onChange={value => setSettings(prev => ({ ...prev, startCriterion: value }))}
            >
              <HStack spacing={4}>
                <Radio 
                  value="pressure"
                  colorScheme="blue"
                >
                  Pressure
                </Radio>
                <Radio 
                  value="load"
                  colorScheme="blue"
                >
                  Load
                </Radio>
              </HStack>
            </RadioGroup>
          </FormControl>

      {settings.startCriterion === 'pressure' ? (
        <FormControl>
          <FormLabel>Start Pressure Threshold (bar)</FormLabel>
          <NumberInput 
            value={settings.ignitionPressureThreshold}
            onChange={(_, value) => setSettings(prev => ({ ...prev, ignitionPressureThreshold: value }))}
          >
            <NumberInputField />
          </NumberInput>
        </FormControl>
      ) : (
        <FormControl>
          <FormLabel>Start Load Threshold (kg)</FormLabel>
          <NumberInput 
            value={settings.ignitionLoadThreshold}
            onChange={(_, value) => setSettings(prev => ({ ...prev, ignitionLoadThreshold: value }))}
          >
            <NumberInputField />
          </NumberInput>
        </FormControl>
      )}

      <FormControl>
        <FormLabel>Engine End Criterion</FormLabel>
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

      {settings.endCriterion === 'pressure' ? (
        <FormControl>
          <FormLabel>End Pressure Threshold (bar)</FormLabel>
          <NumberInput 
            value={settings.endPressureThreshold}
            onChange={(_, value) => setSettings(prev => ({ ...prev, endPressureThreshold: value }))}
          >
            <NumberInputField />
          </NumberInput>
        </FormControl>
      ) : (
        <FormControl>
          <FormLabel>End Load Threshold (kg)</FormLabel>
          <NumberInput 
            value={settings.endLoadThreshold}
            onChange={(_, value) => setSettings(prev => ({ ...prev, endLoadThreshold: value }))}
          >
            <NumberInputField />
          </NumberInput>
        </FormControl>
      )}

      <FormControl>
        <FormLabel>Integration Start Point</FormLabel>
        <Select 
          value={settings.integrationStart}
          onChange={e => setSettings(prev => ({ ...prev, integrationStart: e.target.value }))}
        >
          <option value="button">Ignition Button Press</option>
          <option value="pressure">Pressure/Load Rise Threshold</option>
          <option value="ignition">Real Ignition Moment</option>
        </Select>
      </FormControl>

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