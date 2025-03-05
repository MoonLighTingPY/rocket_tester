/* eslint-disable react/prop-types */
// src/components/ImportPage/DataConversionOptions.jsx
import { useState } from 'react';
import {
  Box,
  FormControl,
  FormLabel,
  NumberInput,
  NumberInputField,
  HStack,
  VStack,
  Button,
  RadioGroup,
  Radio,
  Text,
  Select,
  useToast,
  Switch,
  FormHelperText,
  Icon,
} from '@chakra-ui/react';
import { FaCalculator } from 'react-icons/fa';

const DataConversionOptions = ({ 
  onApplyConversion, 
  filterTargets,
}) => {
  const toast = useToast();
  const [conversionType, setConversionType] = useState('manual');
  const [manualSettings, setManualSettings] = useState({
    conversionFactor: 1.0,
    offset: 0.0,
  });
  const [rangeSettings, setRangeSettings] = useState({
    voltageMin: 0,
    voltageMax: 2.5,
    sensorMin: 0,
    sensorMax: 100,
    sensorType: 'pressure', // Default to pressure
  });
  const [calculatedFactor, setCalculatedFactor] = useState(null);
  const [enableConversion, setEnableConversion] = useState(false);

  // Update default range max based on sensorType
  const updateRangeByType = (type) => {
    const ranges = {
      pressure: 600,
      load: 400,
      temperature: 600,
    };
    
    setRangeSettings(prev => ({
      ...prev,
      sensorType: type,
      sensorMax: ranges[type]
    }));
  };

  const calculateFactor = () => {
    const { voltageMin, voltageMax, sensorMin, sensorMax } = rangeSettings;
    if (voltageMax === voltageMin) {
      toast({
        title: "Calculation Error",
        description: "Voltage range cannot be zero",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    
    const factor = (sensorMax - sensorMin) / (voltageMax - voltageMin);
    setCalculatedFactor(factor);
    setManualSettings(prev => ({ ...prev, conversionFactor: factor }));
    
    toast({
      title: "Conversion factor calculated",
      description: `Factor: ${factor.toFixed(4)}`,
      status: "success",
      duration: 3000,
      isClosable: true,
    });
  };


  const handleApplyConversion = () => {
    const conversionData = {
      conversionFactor: parseFloat(manualSettings.conversionFactor),
      offset: parseFloat(manualSettings.offset),
      enableConversion: enableConversion
    };

    if (isNaN(conversionData.conversionFactor) || isNaN(conversionData.offset)) {
      toast({
        title: "Invalid values",
        description: "Please enter valid numbers for conversion factor and offset",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    onApplyConversion(conversionData);
  };

  return (
    <Box mt={4}>
      <HStack mb={4} align="center">
        <FormControl display="flex" alignItems="center">
          <FormLabel htmlFor="enable-conversion" mb="0" fontWeight="bold">
            Enable Data Conversion
          </FormLabel>
          <Switch 
            id="enable-conversion" 
            isChecked={enableConversion}
            onChange={(e) => setEnableConversion(e.target.checked)}
            colorScheme="teal"
          />
        </FormControl>
      </HStack>
      
      {enableConversion && (
        <VStack align="start" spacing={4}>
          <RadioGroup 
            value={conversionType} 
            onChange={setConversionType}
            colorScheme="blue"
          >
            <HStack spacing={5}>
              <Radio value="manual">Manual Entry</Radio>
              <Radio value="range">Calculate from Range</Radio>
            </HStack>
          </RadioGroup>
          
          <Box w="full" p={4} borderWidth="1px" borderRadius="md">
            {conversionType === 'manual' ? (
              <HStack spacing={6}>
                <FormControl>
                  <FormLabel>Conversion Factor</FormLabel>
                  <NumberInput 
                    value={manualSettings.conversionFactor}
                    onChange={(_, value) => setManualSettings(prev => ({ ...prev, conversionFactor: value }))}
                    step={0.1}
                    precision={4}
                  >
                    <NumberInputField />
                  </NumberInput>
                  <FormHelperText>Multiply readings by this value</FormHelperText>
                </FormControl>
                
                <FormControl>
                  <FormLabel>Offset</FormLabel>
                  <NumberInput 
                    value={manualSettings.offset}
                    onChange={(_, value) => setManualSettings(prev => ({ ...prev, offset: value }))}
                    precision={4}
                  >
                    <NumberInputField />
                  </NumberInput>
                  <FormHelperText>Add this value after multiplication</FormHelperText>
                </FormControl>
              </HStack>
            ) : (
              <VStack spacing={4} align="stretch">
                <FormControl>
                  <FormLabel>Sensor Type</FormLabel>
                  <Select 
                    value={rangeSettings.sensorType}
                    onChange={(e) => updateRangeByType(e.target.value)}
                  >
                    <option value="pressure">Pressure Sensor</option>
                    <option value="load">Load Cell</option>
                    <option value="temperature">Temperature Sensor</option>
                  </Select>
                </FormControl>
                
                <HStack spacing={6}>
                  <FormControl>
                    <FormLabel>Voltage Range (V)</FormLabel>
                    <HStack>
                      <NumberInput 
                        value={rangeSettings.voltageMin}
                        onChange={(_, value) => setRangeSettings(prev => ({ ...prev, voltageMin: value }))}
                        step={0.1}
                        precision={2}
                        min={0}
                      >
                        <NumberInputField placeholder="Min" />
                      </NumberInput>
                      <Text>to</Text>
                      <NumberInput 
                        value={rangeSettings.voltageMax}
                        onChange={(_, value) => setRangeSettings(prev => ({ ...prev, voltageMax: value }))}
                        defaultValue={2.5}
                        step={0.1}
                        precision={2}
                        min={0}
                      >
                        <NumberInputField placeholder="Max" />
                      </NumberInput>
                    </HStack>
                    <FormHelperText>Typically 0-2.5V for ADS1256</FormHelperText>
                  </FormControl>
                  
                  <FormControl>
                    <FormLabel>
                      {rangeSettings.sensorType === 'pressure' ? 'Pressure Range (bar)' : 
                        rangeSettings.sensorType === 'load' ? 'Load Range (kg)' : 
                          'Temperature Range (°C)'}
                    </FormLabel>
                    <HStack>
                      <NumberInput 
                        value={rangeSettings.sensorMin}
                        onChange={(_, value) => setRangeSettings(prev => ({ ...prev, sensorMin: value }))}
                        precision={1}
                      >
                        <NumberInputField placeholder="Min" />
                      </NumberInput>
                      <Text>to</Text>
                      <NumberInput 
                        value={rangeSettings.sensorMax}
                        onChange={(_, value) => setRangeSettings(prev => ({ ...prev, sensorMax: value }))}
                        precision={1}
                      >
                        <NumberInputField placeholder="Max" />
                      </NumberInput>
                    </HStack>
                    <FormHelperText>
                      {rangeSettings.sensorType === 'pressure' ? 'Typical range: 0-600 bar' : 
                        rangeSettings.sensorType === 'load' ? 'Typical range: 0-400 kg' : 
                          'Typical range: 0-600 °C'}
                    </FormHelperText>
                  </FormControl>
                </HStack>
                
                <HStack justify="space-between">
                  <Button 
                    leftIcon={<Icon as={FaCalculator} />}
                    colorScheme="teal" 
                    onClick={calculateFactor}
                    size="sm"
                  >
                    Calculate Factor
                  </Button>
                  
                  {calculatedFactor !== null && (
                    <Text fontWeight="bold">
                      Calculated Factor: {calculatedFactor.toFixed(4)}
                    </Text>
                  )}
                </HStack>
              </VStack>
            )}
          </Box>
          <HStack spacing={4}>
            <Button 
              colorScheme="blue" 
              size="lg"
              onClick={handleApplyConversion} 
              isDisabled={filterTargets.length === 0 || !enableConversion}
            >
            Apply Conversion to Selected Channels
            </Button>
          </HStack>
        </VStack>
      )}
    </Box>
  );
};

export default DataConversionOptions;