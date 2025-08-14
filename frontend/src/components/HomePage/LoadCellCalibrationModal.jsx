/* eslint-disable react/prop-types */
import { useState, useEffect } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Button, VStack, Text, Alert, AlertIcon, Box, Progress,
  useToast, HStack, NumberInput, NumberInputField, FormControl, FormLabel,
  Select, RadioGroup, Radio
} from '@chakra-ui/react';
import { socket } from '../../websocket';

const LoadCellCalibrationModal = ({ isOpen, onClose, sensorConfig, onSave }) => {
  const [calibrationStep, setCalibrationStep] = useState('idle'); // idle, taring, setting_known_weight, calibrating
  const [tareValue, setTareValue] = useState(0);
  const [knownWeight, setKnownWeight] = useState(100); // Default 100
  const [weightUnit, setWeightUnit] = useState('kg'); // 'kg' or 'g'
  const [rawReadings, setRawReadings] = useState([]);
  const [isReceivingData, setIsReceivingData] = useState(false);
  const [calibrationFactor, setCalibrationFactor] = useState(1.0);
  const toast = useToast();

  // Find load cell sensor
  const loadCellSensor = sensorConfig?.find(sensor => sensor.type === 0 && sensor.enabled);

  useEffect(() => {
    if (!socket || !isOpen) return;

    const handleMessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'calibration_sample' && isReceivingData) {
          setRawReadings(prev => [...prev, message.raw].slice(-50));
        }
        else if (message.type === 'tare_complete') {
          setCalibrationStep('setting_known_weight');
          setIsReceivingData(false);
          setTareValue(message.tare);
          toast({
            title: 'Tare Complete',
            description: `Tare: ${message.tare.toFixed(2)}`,
            status: 'success',
            duration: 3000,
            isClosable: true
          });
        }
        else if (message.type === 'calibration_complete') {
          setCalibrationStep('idle');
          setIsReceivingData(false);
          setCalibrationFactor(message.scale);
          toast({
            title: 'Calibration Complete',
            description: `Scale: ${message.scale.toFixed(7)}`,
            status: 'success',
            duration: 4000,
            isClosable: true
          });

          if (loadCellSensor) {
            const updatedConfig = sensorConfig.map(sensor => {
              if (sensor.type === 0 && sensor.enabled) {
                return {
                  ...sensor,
                  conversionFactor: message.scale,
                  offset: message.offset // already = -tare*scale
                };
              }
              return sensor;
            });
            onSave(updatedConfig);
          }
        }
        else if (message.type === 'calibration_error') {
          setCalibrationStep('idle');
          setIsReceivingData(false);
          toast({
            title: 'Calibration Error',
            description: message.message,
            status: 'error',
            duration: 4000,
            isClosable: true
          });
        }
      } catch {
        // ignore non-json
      }
    };

    socket.addEventListener('message', handleMessage);
    return () => socket.removeEventListener('message', handleMessage);
  }, [socket, isOpen, isReceivingData, loadCellSensor, sensorConfig, onSave, toast]);

  const startTare = () => {
    if (!loadCellSensor) {
      toast({
        title: 'No Load Cell Found',
        description: 'Please enable a load cell sensor in the configuration first.',
        status: 'error',
        duration: 3000,
        isClosable: true
      });
      return;
    }
    setCalibrationStep('taring');
    setRawReadings([]);
    setIsReceivingData(true);
    socket.send(JSON.stringify({ type: 'start_tare' }));
  };

  const startCalibration = () => {
    if (tareValue === 0 || calibrationStep !== 'setting_known_weight') return;
    
    // Convert weight to kg if needed (backend expects kg)
    const knownWeightInKg = weightUnit === 'g' ? knownWeight / 1000 : knownWeight;
    
    setCalibrationStep('calibrating');
    setRawReadings([]);
    setIsReceivingData(true);
    socket.send(JSON.stringify({ 
      type: 'start_calibration', 
      knownWeight: knownWeightInKg 
    }));
  };

  const resetCalibration = () => {
    setCalibrationStep('idle');
    setTareValue(0);
    setRawReadings([]);
    setIsReceivingData(false);
    setCalibrationFactor(1.0);
  };

  const getCurrentReading = () => {
    if (rawReadings.length === 0) return 0;
    return rawReadings[rawReadings.length - 1];
  };

  const getAverageReading = () => {
    if (rawReadings.length === 0) return 0;
    return rawReadings.reduce((sum, val) => sum + val, 0) / rawReadings.length;
  };

  // Get display value with proper defaults based on unit
  const getDisplayWeight = () => {
    return knownWeight || (weightUnit === 'kg' ? 1 : 1000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" closeOnOverlayClick={false}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader bg="orange.500" color="white" borderTopRadius="md">
          Load Cell Calibration
        </ModalHeader>
        
        <ModalBody>
          <VStack spacing={6} py={4}>
            {!loadCellSensor && (
              <Alert status="warning" borderRadius="md">
                <AlertIcon />
                <Box>
                  <Text fontWeight="bold">No Load Cell Configured</Text>
                  <Text fontSize="sm">
                    Please enable and configure a load cell sensor before calibrating.
                  </Text>
                </Box>
              </Alert>
            )}

            {loadCellSensor && (
              <>
                <Alert status="info" borderRadius="md">
                  <AlertIcon />
                  <Box>
                    <Text fontWeight="bold">Calibration Process</Text>
                    <Text fontSize="sm">
                      1. Remove all weight from the load cell and tare
                      <br />
                      2. Place a known weight and calibrate
                      <br />
                      3. The values will be saved to sensor configuration
                    </Text>
                  </Box>
                </Alert>

                {/* Current readings display */}
                <Box w="full" p={4} bg="gray.50" borderRadius="md">
                  <VStack spacing={2}>
                    <Text fontWeight="bold">Current Reading: {getCurrentReading().toFixed(2)}</Text>
                    {rawReadings.length > 0 && (
                      <Text fontSize="sm">Average (last {rawReadings.length} readings): {getAverageReading().toFixed(2)}</Text>
                    )}
                    {isReceivingData && (
                      <Progress value={100} size="sm" colorScheme="blue" isIndeterminate w="full" />
                    )}
                  </VStack>
                </Box>

                {/* Step 1: Tare */}
                <Box w="full" p={4} borderWidth="1px" borderRadius="md" 
                     bg={calibrationStep === 'taring' ? "blue.50" : "white"}>
                  <VStack spacing={3}>
                    <Text fontWeight="bold">Step 1: Tare (Zero Point)</Text>
                    <Text fontSize="sm" textAlign="center">
                      Remove all weight from the load cell, then click Tare
                    </Text>
                    {tareValue !== 0 && (
                      <Text color="green.600" fontWeight="bold">
                        Tare Value: {tareValue.toFixed(2)}
                      </Text>
                    )}
                    <Button 
                      colorScheme="blue" 
                      onClick={startTare}
                      isLoading={calibrationStep === 'taring'}
                      loadingText="Taring..."
                      isDisabled={calibrationStep !== 'idle' && calibrationStep !== 'setting_known_weight'}
                    >
                      Start Tare
                    </Button>
                  </VStack>
                </Box>

                {/* Step 2: Known Weight */}
                {(calibrationStep === 'setting_known_weight' || calibrationStep === 'calibrating' || calibrationFactor !== 1.0) && (
                  <Box w="full" p={4} borderWidth="1px" borderRadius="md"
                       bg={calibrationStep === 'calibrating' ? "orange.50" : "white"}>
                    <VStack spacing={4}>
                      <Text fontWeight="bold">Step 2: Calibration with Known Weight</Text>
                      
                      {/* Weight Unit Selection */}
                      <FormControl>
                        <FormLabel>Weight Unit</FormLabel>
                        <RadioGroup 
                          value={weightUnit} 
                          onChange={setWeightUnit}
                          colorScheme="blue"
                        >
                          <HStack spacing={6}>
                            <Radio value="kg">Kilograms (kg)</Radio>
                            <Radio value="g">Grams (g)</Radio>
                          </HStack>
                        </RadioGroup>
                      </FormControl>

                      {/* Known Weight Input */}
                      <FormControl>
                        <FormLabel>Known Weight ({weightUnit})</FormLabel>
                        <NumberInput 
                          value={getDisplayWeight()}
                          onChange={(_, value) => setKnownWeight(value)}
                          min={weightUnit === 'kg' ? 0.001 : 1}
                          max={weightUnit === 'kg' ? 1000 : 1000000}
                          precision={weightUnit === 'kg' ? 3 : 0}
                          step={weightUnit === 'kg' ? 0.1 : 10}
                        >
                          <NumberInputField placeholder={`Enter weight in ${weightUnit}`} />
                        </NumberInput>
                      </FormControl>

                      <Text fontSize="sm" textAlign="center" color="gray.600">
                        Place the known weight ({getDisplayWeight()}{weightUnit}) on the load cell, then click Calibrate
                        {weightUnit === 'g' && (
                          <Text fontSize="xs" color="blue.600" mt={1}>
                            (Will be converted to {(getDisplayWeight() / 1000).toFixed(3)} kg for calibration)
                          </Text>
                        )}
                      </Text>

                      {calibrationFactor !== 1.0 && (
                        <Text color="green.600" fontWeight="bold">
                          Calibration Factor: {calibrationFactor.toFixed(7)}
                        </Text>
                      )}
                      <Button 
                        colorScheme="orange" 
                        onClick={startCalibration}
                        isLoading={calibrationStep === 'calibrating'}
                        loadingText="Calibrating..."
                        isDisabled={calibrationStep !== 'setting_known_weight' || tareValue === 0 || !getDisplayWeight()}
                      >
                        Start Calibration
                      </Button>
                    </VStack>
                  </Box>
                )}

                {/* Reset button */}
                <Button 
                  colorScheme="gray" 
                  variant="outline"
                  onClick={resetCalibration}
                  isDisabled={isReceivingData}
                >
                  Reset Calibration
                </Button>
              </>
            )}
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button 
            onClick={onClose}
            isDisabled={isReceivingData}
          >
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default LoadCellCalibrationModal;