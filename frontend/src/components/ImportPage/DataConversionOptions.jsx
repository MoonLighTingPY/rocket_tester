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
          
          <Box w="full" p={4} borderWidth="1px" borderRadius="md">
            <VStack spacing={4} align="stretch">
              {/* Conversion Factor Section */}
              <FormControl>
                <FormLabel fontWeight="bold">Conversion Factor</FormLabel>
      
                <RadioGroup 
                  value={conversionType} 
                  onChange={setConversionType}
                  colorScheme="blue"
                  mb={3}
                >
                  <HStack spacing={5}>
                    <Radio value="manual">Manual Entry</Radio>
                    <Radio value="range">Calculate from Range</Radio>
                  </HStack>
                </RadioGroup>
      
                {conversionType === 'manual' ? (
                  <NumberInput 
                    value={manualSettings.conversionFactor}
                    onChange={(_, value) => setManualSettings(prev => ({ ...prev, conversionFactor: value }))}
                    step={0.1}
                    precision={4}
                  >
                    <NumberInputField />
                  </NumberInput>
                ) : (
                  <VStack spacing={3} align="stretch">
                    <HStack spacing={6}>
                      <FormControl>
                        <FormLabel size="sm">Voltage Range (V)</FormLabel>
                        <HStack>
                          <NumberInput 
                            value={rangeSettings.voltageMin}
                            onChange={(_, value) => setRangeSettings(prev => ({ ...prev, voltageMin: value }))}
                            step={0.1}
                            precision={2}
                            min={0}
                            size="sm"
                          >
                            <NumberInputField placeholder="Min" />
                          </NumberInput>
                          <Text>to</Text>
                          <NumberInput 
                            value={rangeSettings.voltageMax}
                            onChange={(_, value) => setRangeSettings(prev => ({ ...prev, voltageMax: value }))}
                            step={0.1}
                            precision={2}
                            min={0}
                            size="sm"
                          >
                            <NumberInputField placeholder="Max" />
                          </NumberInput>
                        </HStack>
                        <FormHelperText>Typically 0-2.5V</FormHelperText>
                      </FormControl>
            
                      <FormControl>
                        <FormLabel size="sm">Sensor Range</FormLabel>
                        <HStack>
                          <NumberInput 
                            value={rangeSettings.sensorMin}
                            onChange={(_, value) => setRangeSettings(prev => ({ ...prev, sensorMin: value }))}
                            precision={1}
                            size="sm"
                          >
                            <NumberInputField placeholder="Min" />
                          </NumberInput>
                          <Text>to</Text>
                          <NumberInput 
                            value={rangeSettings.sensorMax}
                            onChange={(_, value) => setRangeSettings(prev => ({ ...prev, sensorMax: value }))}
                            precision={1}
                            size="sm"
                          >
                            <NumberInputField placeholder="Max" />
                          </NumberInput>
                        </HStack>
                        <FormHelperText>Typical ranges: 0-600 bar, 0-400 kg, 0-600 °C</FormHelperText>
                      </FormControl>
                    </HStack>
          
                    <HStack>
                      <Button 
                        leftIcon={<Icon as={FaCalculator} />}
                        colorScheme="teal" 
                        onClick={calculateFactor}
                        size="sm"
                      >
              Calculate Factor
                      </Button>
            
                      <NumberInput 
                        value={calculatedFactor !== null ? calculatedFactor : manualSettings.conversionFactor}
                        isReadOnly
                        precision={4}
                        size="sm"
                        flex={1}
                      >
                        <NumberInputField />
                      </NumberInput>
                    </HStack>
                  </VStack>
                )}
                <FormHelperText>Multiply readings by this value</FormHelperText>
              </FormControl>
    
              {/* Offset Section - Always visible */}
              <FormControl>
                <FormLabel fontWeight="bold">Offset</FormLabel>
                <NumberInput 
                  value={manualSettings.offset}
                  onChange={(_, value) => setManualSettings(prev => ({ ...prev, offset: value }))}
                  precision={4}
                >
                  <NumberInputField />
                </NumberInput>
                <FormHelperText>Add this value after applying the conversion factor</FormHelperText>
              </FormControl>
            </VStack>
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