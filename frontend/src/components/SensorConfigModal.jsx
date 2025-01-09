/* eslint-disable react/prop-types */
import { useState, useEffect } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Button, FormControl, FormLabel, Input, Checkbox, VStack, SimpleGrid,
  Box, Text, Divider, FormErrorMessage, Badge, HStack, Select, Tooltip, InputGroup, InputRightAddon,
  ButtonGroup
} from '@chakra-ui/react';
import { InfoIcon } from '@chakra-ui/icons';

const SensorConfigModal = ({ isOpen, onClose, sensorConfig, onSave }) => {
  const [localConfig, setLocalConfig] = useState(sensorConfig || []);
  const [editableValues, setEditableValues] = useState({});
  const [errors, setErrors] = useState({});
  const [presets, setPresets] = useState(() => {
    // Load presets from localStorage on init
    const saved = localStorage.getItem('sensorConfigPresets');
    return saved ? JSON.parse(saved) : {};
  });
  const [presetName, setPresetName] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('');


  useEffect(() => {
    if (sensorConfig && Array.isArray(sensorConfig) && sensorConfig.length > 0) {
      setLocalConfig([...sensorConfig]);
      const initialValues = {};
      sensorConfig.forEach((sensor, index) => {
        initialValues[`${index}-conversionFactor`] = sensor.conversionFactor?.toString() ?? '0.00';
        initialValues[`${index}-offset`] = sensor.offset?.toString() ?? '0.00';
      });
      setEditableValues(initialValues);
      setErrors({}); // Clear errors when modal reopens
    }
  }, [sensorConfig]);

  const deepClone = (obj) => JSON.parse(JSON.stringify(obj));


    // Add preset management functions
    const loadPreset = (presetName) => {
      if (!presets[presetName]) return;

      const preset = deepClone(presets[presetName]); // Deep clone the preset
      setLocalConfig(preset);
      
      const newEditableValues = {};
      preset.forEach((sensor, index) => {
        newEditableValues[`${index}-conversionFactor`] = sensor.conversionFactor?.toString() ?? '0.00';
        newEditableValues[`${index}-offset`] = sensor.offset?.toString() ?? '0.00';
      });
      
      setEditableValues(newEditableValues); // Replace entirely instead of merging
      setErrors({});
    };


    const saveAsPreset = () => {
      if (!presetName.trim()) {
        setErrors(prev => ({ ...prev, preset: { type: 'error', message: 'Preset name is required' } }));
        return;
      }
    
      // Create a deep copy of the current configuration
      const configToSave = localConfig.map((sensor, index) => ({
        ...deepClone(sensor),
        conversionFactor: parseFloat(editableValues[`${index}-conversionFactor`]),
        offset: parseFloat(editableValues[`${index}-offset`])
      }));
    
      const newPresets = {
        ...deepClone(presets),
        [presetName]: configToSave
      };
    
      setPresets(newPresets);
      localStorage.setItem('sensorConfigPresets', JSON.stringify(newPresets));
      
      // Select the newly created preset
      setSelectedPreset(presetName);
      
      setPresetName('');
      setErrors(prev => ({ 
        ...prev, 
        preset: { type: 'success', message: 'Preset created successfully' } 
      }));
    };

  const deletePreset = (presetName) => {
    const newPresets = { ...presets };
    delete newPresets[presetName];
    setPresets(newPresets);
    localStorage.setItem('sensorConfigPresets', JSON.stringify(newPresets));
    if (selectedPreset === presetName) {
      setSelectedPreset('');
    }
  };

  const validateField = (field, value, sensorName, index) => {
    // Early return if missing required params
    if (index === undefined || !localConfig[index]) {
      return `Invalid sensor reference`;
    }
  
    const sensor = localConfig[index];
  
    if (field === 'conversionFactor') {
      if (value.trim() === '') return `${sensorName}: Conversion factor cannot be empty`;
      if (isNaN(value)) return `${sensorName}: Conversion factor must be a number`;
      if (parseFloat(value) === 0) return `${sensorName}: Conversion factor cannot be zero`;
    }
  
    if (field === 'offset') {
      if (value.trim() === '') return `${sensorName}: Offset cannot be empty`;
      if (isNaN(value)) return `${sensorName}: Offset must be a number`;
    }
  
    if (field === 'adcChannel') {
      // Basic validation
      if (value === '') return `${sensorName}: ADC channel cannot be empty`;
      const channel = parseInt(value);
      if (isNaN(channel)) return `${sensorName}: ADC channel must be a number`;
      if (channel < 0 || channel > 7) return `${sensorName}: ADC channel must be between 0 and 7`;
      
      // Only check for duplicates if the sensor is enabled
      if (sensor.enabled) {
        const duplicateSensor = localConfig.find((s, i) => 
          i !== index && // Not the same sensor
          s.enabled && // Other sensor is enabled
          s.adcChannel === channel // Same channel number
        );
        
        if (duplicateSensor) {
          return `${sensorName}: ADC channel ${channel} is already used by ${duplicateSensor.name}`;
        }
      }
    }
    return null;
  };

  const updatePreset = () => {
    if (!selectedPreset) return;
  
    // Create updated config with current values
    const updatedConfig = localConfig.map((sensor, index) => ({
      ...deepClone(sensor),
      conversionFactor: parseFloat(editableValues[`${index}-conversionFactor`]),
      offset: parseFloat(editableValues[`${index}-offset`])
    }));
  
    const newPresets = {
      ...deepClone(presets),
      [selectedPreset]: updatedConfig // Override existing preset
    };
  
    setPresets(newPresets);
    localStorage.setItem('sensorConfigPresets', JSON.stringify(newPresets));
    
    // Show success message
    setErrors(prev => ({ 
      ...prev, 
      preset: { type: 'success', message: 'Preset updated successfully' }
    }));
  };

  const handleChange = (index, field, value) => {
    const sensor = localConfig[index];
    
    if (field === 'enabled') {
      const updated = [...localConfig];
      updated[index][field] = !updated[index][field];
      setLocalConfig(updated);
    } else if (field === 'adcChannel') {
      const error = validateField(field, value, sensor.name, index); // Pass index
      setErrors(prev => ({
        ...prev,
        [`${index}-${field}`]: error
      }));
      const updated = [...localConfig];
      updated[index][field] = value;
      setLocalConfig(updated);
    } else if (field === 'conversionFactor' || field === 'offset') {
      const error = validateField(field, value, sensor.name, index); // Pass index
      setErrors(prev => ({
        ...prev,
        [`${index}-${field}`]: error
      }));
      setEditableValues(prev => ({
        ...prev,
        [`${index}-${field}`]: value
      }));
    }
  };

  const handleSave = () => {
    let hasErrors = false;
    const newErrors = {};
  
    localConfig.forEach((sensor, index) => {
      if (!sensor) return; // Skip invalid sensors
  
      // Validate each field
      const fields = ['adcChannel', 'conversionFactor', 'offset'];
      fields.forEach(field => {
        const value = field === 'adcChannel' 
          ? sensor[field] 
          : editableValues[`${index}-${field}`];
        
        const error = validateField(field, value, sensor.name, index);
        if (error) {
          hasErrors = true;
          newErrors[`${index}-${field}`] = error;
        }
      });
    });
  
    if (hasErrors) {
      setErrors(newErrors);
      return;
    }
  
    // If no errors, proceed with save
    const finalConfig = localConfig.map((sensor, index) => ({
      ...sensor,
      conversionFactor: parseFloat(editableValues[`${index}-conversionFactor`]),
      offset: parseFloat(editableValues[`${index}-offset`])
    }));
  
    onSave(finalConfig);
    onClose();
  };

  // Group sensors by type
  const groupedSensors = localConfig.reduce((groups, sensor) => {
    const type = sensor.type;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(sensor);
    return groups;
  }, {});

  // Sensor type labels
  const typeLabels = {
    0: 'Load Cells',
    1: 'Pressure Sensors',
    2: 'Temperature Sensors'
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="6xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent maxW={{ base: "90%", md: "80%", lg: "70%" }} maxH="90vh">
        <ModalHeader>Sensor Configuration</ModalHeader>
        <ModalBody 
  display="flex" 
  flexDir="column" 
  maxH="calc(90vh - 150px)" // Adjust for header and footer height
  overflowY="auto" // Enable vertical scrolling
  css={{
    '&::-webkit-scrollbar': {
      width: '8px',
    },
    '&::-webkit-scrollbar-track': {
      background: '#f1f1f1',
      borderRadius: '4px',
    },
    '&::-webkit-scrollbar-thumb': {
      background: '#cbd5e0',
      borderRadius: '4px',
      '&:hover': {
        background: '#a0aec0'
      }
    }
  }}
>
        <VStack spacing={4} align="stretch" minH="0">

            {Object.entries(groupedSensors).map(([type, sensors]) => (
              <Box key={type}>
                <Text fontSize="lg" fontWeight="bold" mb={2}>
                  {typeLabels[type]}
                </Text>
                <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={3} mb={4}>
                  {sensors.map((sensor) => {
                    const originalIndex = localConfig.findIndex(s => s.name === sensor.name);
                    return (
                      <Box key={sensor.name} p={3} borderWidth="1px" borderRadius="lg" bg="white">
                        <FormControl>
                          <HStack justify="space-between" mb={2}>
                            <FormLabel fontWeight="bold" mb={0}>{sensor.name}</FormLabel>
                            <Badge 
                              colorScheme={sensor.enabled ? "green" : "red"}
                              variant="solid"
                              borderRadius="full"
                              px={2}
                            >
                              {sensor.enabled ? "Enabled" : "Disabled"}
                            </Badge>
                          </HStack>
                          <Checkbox
                            isChecked={sensor.enabled}
                            onChange={() => handleChange(originalIndex, 'enabled')}
                            mb={2}
                            colorScheme={sensor.enabled ? "green" : "red"}
                          >
                            Enable Sensor
                          </Checkbox>
                          <VStack spacing={2}>
                          <FormControl isInvalid={errors[`${originalIndex}-adcChannel`]}>
                            <Tooltip label="Hardware channel number on the ADS1256 ADC (0-7). Each enabled sensor must have a unique channel.">
                              <FormLabel fontSize="sm" mb={1}>
                                ADC Channel <InfoIcon ml={1} boxSize={3} />
                              </FormLabel>
                            </Tooltip>
                            <Input
                              type="number"
                              value={sensor.adcChannel}
                              min={0}
                              max={7}
                              size="sm"
                              onChange={(e) => handleChange(originalIndex, 'adcChannel', e.target.value)}
                              isDisabled={!sensor.enabled}
                              bg={!sensor.enabled ? "gray.100" : "white"}
                            />
                            <FormErrorMessage>{errors[`${originalIndex}-adcChannel`]}</FormErrorMessage>
                          </FormControl>
  
                          <FormControl isInvalid={errors[`${originalIndex}-conversionFactor`]}>
                            <Tooltip label="Factor to convert the ADC reading of the sensor to the real unit. Factor euqals to how many units are represented by 1V. For example, a load cell with 2mV/V sensitivity will have a conversion factor of 0.002.">
                              <FormLabel fontSize="sm" mb={1}>
                                Conversion Factor <InfoIcon ml={1} boxSize={3} />
                              </FormLabel>
                            </Tooltip>
                            <InputGroup size="sm">
                              <Input
                                type="text"
                                value={editableValues[`${originalIndex}-conversionFactor`]}
                                onChange={(e) => handleChange(originalIndex, 'conversionFactor', e.target.value)}
                                isDisabled={!sensor.enabled}
                                bg={!sensor.enabled ? "gray.100" : "white"}
                              />
                              <InputRightAddon>
                                {sensor.type === 0 ? 'kg/V' : sensor.type === 1 ? 'bar/V' : '°C/V'}
                              </InputRightAddon>
                            </InputGroup>
                            <FormErrorMessage>{errors[`${originalIndex}-conversionFactor`]}</FormErrorMessage>
                          </FormControl>

                          <FormControl isInvalid={errors[`${originalIndex}-offset`]}>
                            <Tooltip label="Calibration offset in V to adjust for sensor bias. Added to the converted reading. For example, if sensor reads 0.5V when it should be 0, the offset is -0.5.">
                              <FormLabel fontSize="sm" mb={1}>
                                Offset <InfoIcon ml={1} boxSize={3} />
                              </FormLabel>
                            </Tooltip>
                            <InputGroup size="sm">
                              <Input
                                type="text"
                                value={editableValues[`${originalIndex}-offset`]}
                                onChange={(e) => handleChange(originalIndex, 'offset', e.target.value)}
                                isDisabled={!sensor.enabled}
                                bg={!sensor.enabled ? "gray.100" : "white"}
                              />
                              <InputRightAddon>
                                {sensor.type === 0 ? 'kg' : sensor.type === 1 ? 'bar' : '°C'}
                              </InputRightAddon>
                            </InputGroup>
                            <FormErrorMessage>{errors[`${originalIndex}-offset`]}</FormErrorMessage>
                          </FormControl>
                          </VStack>
                        </FormControl>
                      </Box>
                    );
                  })}
                </SimpleGrid>
                {type < Object.keys(groupedSensors).length - 1 && <Divider />}
              </Box>
            ))}
          </VStack>
        </ModalBody>
<ModalFooter justifyContent="space-between" alignItems="center" borderTopWidth={1} pt={4}>
  {/* Preset Management Section - Left Side */}
  <HStack spacing={4} flex={1} maxW="60%">
    <FormControl isInvalid={errors.preset?.type === 'error'} maxW="200px">
      <Select
        size="md"
        value={selectedPreset}
        onChange={(e) => setSelectedPreset(e.target.value)}
        placeholder={Object.keys(presets).length === 0 ? "No presets" : "Create preset"}
      >
        {Object.keys(presets).map(name => (
          <option key={name} value={name}>{name}</option>
        ))}
      </Select>
      {errors.preset?.type === 'error' && (
        <FormErrorMessage>{errors.preset.message}</FormErrorMessage>
      )}
      {errors.preset?.type === 'success' && (
        <Text color="green.500" fontSize="sm">{errors.preset.message}</Text>
      )}
    </FormControl>

    {selectedPreset ? (
      // Show these buttons only when a preset is selected
      <ButtonGroup size="md" isAttached variant="outline">
        <Button
          colorScheme="blue"
          onClick={() => loadPreset(selectedPreset)}
        >
          Load
        </Button>
        <Button
          colorScheme="green"
          onClick={updatePreset}
        >
          Update
        </Button>
        <Button
          colorScheme="red"
          onClick={() => deletePreset(selectedPreset)}
        >
          Delete
        </Button>
      </ButtonGroup>
    ) : (
      // Show save new preset section when no preset is selected
      <>
        <FormControl isInvalid={errors.preset?.type === 'error'}>
          <Input
            size="md"
            placeholder="New preset name"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
          />
        </FormControl>
        <Button
          size="md"
          colorScheme="green"
          onClick={saveAsPreset}
          isDisabled={!presetName.trim()}
        >
          Save New
        </Button>
      </>
    )}
  </HStack>

  {/* Modal Actions - Right Side */}
  <HStack spacing={4}>
    <Button onClick={onClose}>Cancel</Button>
    <Button colorScheme="blue" onClick={handleSave}>Save</Button>
  </HStack>
</ModalFooter>
  </ModalContent>
</Modal>
  );
};

export default SensorConfigModal;