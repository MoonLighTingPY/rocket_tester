/* eslint-disable react/prop-types */
import { useState, useEffect } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Button, FormControl, FormLabel, Input, Checkbox, VStack, SimpleGrid,
  Box, Text, Divider, FormErrorMessage, Badge, HStack, Select, Tooltip, InputGroup, InputRightAddon,
  ButtonGroup, useToast, NumberInput, NumberInputField, FormHelperText
} from '@chakra-ui/react';
import { InfoIcon } from '@chakra-ui/icons';
import { FaCalculator } from 'react-icons/fa';

const SENSOR_TYPE = {
  LOAD: 0,
  PRESSURE: 1,
  TEMPERATURE: 2
};

const ADC_TYPE = {
  ADS1232: 0,
  ADS1256: 1,
  MAX31855: 2
};

// Map sensor type -> adc type (current backend design couples them)
const SENSOR_TYPE_TO_ADC_TYPE = {
  [SENSOR_TYPE.LOAD]: ADC_TYPE.ADS1232,
  [SENSOR_TYPE.PRESSURE]: ADC_TYPE.ADS1256,
  [SENSOR_TYPE.TEMPERATURE]: ADC_TYPE.MAX31855
};

// Max channel indices per adc type (frontend enforced)
const ADC_CHANNEL_LIMITS = {
  [ADC_TYPE.ADS1232]: 0,      // single channel (load cell)
  [ADC_TYPE.ADS1256]: 7,      // 0..7
  [ADC_TYPE.MAX31855]: 3      // 0..3 (4 thermocouples via mux)
};

const SensorConfigModal = ({ isOpen, onClose, sensorConfig, onSave }) => {
  const [localConfig, setLocalConfig] = useState(sensorConfig || []);
  const [editableValues, setEditableValues] = useState({});
  const [errors, setErrors] = useState({});
  const [presets, setPresets] = useState(() => {
    const saved = localStorage.getItem('sensorConfigPresets');
    return saved ? JSON.parse(saved) : {};
  });
  const [presetName, setPresetName] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('');
  const [calculationModalOpen, setCalculationModalOpen] = useState(null);
  const [rangeSettings, setRangeSettings] = useState({
    voltageMin: 0,
    voltageMax: 2.5,
    sensorMin: 0,
    sensorMax: 100
  });
  const toast = useToast();

  const calculateFactor = (sensorIndex) => {
    const { voltageMin, voltageMax, sensorMin, sensorMax } = rangeSettings;
    if (voltageMax === voltageMin) {
      toast({
        title: 'Calculation Error',
        description: 'Voltage range cannot be zero',
        status: 'error',
        duration: 3000,
        isClosable: true
      });
      return;
    }
    const factor = (sensorMax - sensorMin) / (voltageMax - voltageMin);
    setEditableValues(prev => ({
      ...prev,
      [`${sensorIndex}-conversionFactor`]: factor.toFixed(4)
    }));
    setCalculationModalOpen(null);
    toast({
      title: 'Conversion factor calculated',
      description: `Factor: ${factor.toFixed(4)}`,
      status: 'success',
      duration: 3000,
      isClosable: true
    });
  };

  const renderCalculator = () => {
    if (calculationModalOpen === null) return null;
    const sensorIndex = calculationModalOpen;
    const sensor = localConfig[sensorIndex];
    if (!sensor) return null;

    let unitLabel = 'units';
    switch (sensor.type) {
      case SENSOR_TYPE.LOAD: unitLabel = 'kg'; break;
      case SENSOR_TYPE.PRESSURE: unitLabel = 'bar'; break;
      case SENSOR_TYPE.TEMPERATURE: unitLabel = '°C'; break;
    }

    return (
      <Box
        position="absolute"
        zIndex="modal"
        bg="white"
        p={4}
        borderRadius="md"
        boxShadow="lg"
        borderWidth="1px"
        maxW="400px"
      >
        <VStack spacing={3} align="stretch">
          <HStack justifyContent="space-between">
            <Text fontWeight="bold">Calculate Conversion Factor</Text>
            <Button size="sm" variant="ghost" onClick={() => setCalculationModalOpen(null)}>X</Button>
          </HStack>

          <FormControl>
            <FormLabel fontSize="sm">Voltage Range (V)</FormLabel>
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
              <FormLabel fontSize="sm">Sensor Range ({unitLabel})</FormLabel>
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
              <FormHelperText>
                {sensor.type === SENSOR_TYPE.LOAD
                  ? 'Typical: 0-400 kg'
                  : sensor.type === SENSOR_TYPE.PRESSURE
                    ? 'Typical: 0-600 bar'
                    : 'Typical: 0-600 °C'}
              </FormHelperText>
            </FormControl>

          <Button
            leftIcon={<FaCalculator />}
            colorScheme="blue"
            onClick={() => calculateFactor(sensorIndex)}
          >
            Calculate Factor
          </Button>
        </VStack>
      </Box>
    );
  };

  useEffect(() => {
    if (sensorConfig && Array.isArray(sensorConfig) && sensorConfig.length > 0) {
      const cloned = sensorConfig.map(s => ({ ...s }));
      setLocalConfig(cloned);
      const initialValues = {};
      cloned.forEach((sensor, index) => {
        initialValues[`${index}-name`] = sensor.name;
        initialValues[`${index}-type`] = sensor.type;
        initialValues[`${index}-adcChannel`] = sensor.adcChannel;
        initialValues[`${index}-conversionFactor`] = sensor.conversionFactor?.toString() ?? '0.00';
        initialValues[`${index}-offset`] = sensor.offset?.toString() ?? '0.00';
      });
      setEditableValues(initialValues);
      setErrors({});
    }
  }, [sensorConfig]);

  const deepClone = (o) => JSON.parse(JSON.stringify(o));

  const loadPreset = (presetName) => {
    if (!presets[presetName]) return;
    const preset = deepClone(presets[presetName]);
    setLocalConfig(preset);
    const newEditableValues = {};
    preset.forEach((sensor, index) => {
      newEditableValues[`${index}-name`] = sensor.name;
      newEditableValues[`${index}-type`] = sensor.type;
      newEditableValues[`${index}-adcChannel`] = sensor.adcChannel;
      newEditableValues[`${index}-conversionFactor`] = sensor.conversionFactor?.toString() ?? '0.00';
      newEditableValues[`${index}-offset`] = sensor.offset?.toString() ?? '0.00';
    });
    setEditableValues(newEditableValues);
    setErrors({});
  };

  const saveAsPreset = () => {
    if (!presetName.trim()) {
      setErrors(prev => ({ ...prev, preset: { type: 'error', message: 'Preset name is required' } }));
      return;
    }
    const configToSave = localConfig.map((sensor, index) => ({
      ...deepClone(sensor),
      name: editableValues[`${index}-name`] ?? sensor.name,
      type: editableValues[`${index}-type`] ?? sensor.type,
      adcType: SENSOR_TYPE_TO_ADC_TYPE[editableValues[`${index}-type`] ?? sensor.type],
      adcChannel: parseInt(editableValues[`${index}-adcChannel`]),
      conversionFactor: parseFloat(editableValues[`${index}-conversionFactor`]),
      offset: parseFloat(editableValues[`${index}-offset`])
    }));
    const newPresets = { ...deepClone(presets), [presetName]: configToSave };
    setPresets(newPresets);
    localStorage.setItem('sensorConfigPresets', JSON.stringify(newPresets));
    setSelectedPreset(presetName);
    setPresetName('');
    setErrors(prev => ({ ...prev, preset: { type: 'success', message: 'Preset created successfully' } }));
  };

  const deletePreset = (name) => {
    const np = { ...presets };
    delete np[name];
    setPresets(np);
    localStorage.setItem('sensorConfigPresets', JSON.stringify(np));
    if (selectedPreset === name) setSelectedPreset('');
  };

  const validateField = (field, value, sensorName, index) => {
    if (index === undefined || !localConfig[index]) return 'Invalid sensor reference';
    const sensor = localConfig[index];

    if (field === 'name') {
      if (!value.trim()) return 'Sensor name cannot be empty';
      const duplicate = localConfig.find((s, i) => i !== index && s.name === value.trim());
      if (duplicate) return 'This name is already used by another sensor';
      if (!/^[a-zA-Z0-9_]+$/.test(value)) return 'Name can only contain letters, numbers, and underscores';
    }

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
      if (value === '' || value === undefined) return `${sensorName}: ADC channel cannot be empty`;
      const channel = parseInt(value);
      if (isNaN(channel)) return `${sensorName}: ADC channel must be a number`;
      const limit = ADC_CHANNEL_LIMITS[sensor.adcType];
      if (channel < 0 || channel > limit) {
        return `${sensorName}: Channel must be between 0 and ${limit} for this ADC`;
      }
      if (sensor.enabled) {
        const duplicateSensor = localConfig.find((s, i) =>
          i !== index &&
          s.enabled &&
            s.adcType === sensor.adcType && // uniqueness only within same adcType
            parseInt(editableValues[`${i}-adcChannel`] ?? s.adcChannel) === channel
        );
        if (duplicateSensor) {
          return `${sensorName}: Channel ${channel} already used by ${duplicateSensor.name}`;
        }
      }
    }

    if (field === 'type') {
      if (![0, 1, 2].includes(parseInt(value))) return `${sensorName}: Invalid sensor type`;
    }

    return null;
  };

  const updatePreset = () => {
    if (!selectedPreset) return;
    const updatedConfig = localConfig.map((sensor, index) => ({
      ...deepClone(sensor),
      name: editableValues[`${index}-name`] ?? sensor.name,
      type: editableValues[`${index}-type`] ?? sensor.type,
      adcType: SENSOR_TYPE_TO_ADC_TYPE[editableValues[`${index}-type`] ?? sensor.type],
      adcChannel: parseInt(editableValues[`${index}-adcChannel`]),
      conversionFactor: parseFloat(editableValues[`${index}-conversionFactor`] ?? sensor.conversionFactor),
      offset: parseFloat(editableValues[`${index}-offset`] ?? sensor.offset)
    }));
    const newPresets = { ...deepClone(presets), [selectedPreset]: updatedConfig };
    setPresets(newPresets);
    localStorage.setItem('sensorConfigPresets', JSON.stringify(newPresets));
    setErrors(prev => ({ ...prev, preset: { type: 'success', message: 'Preset updated successfully' } }));
  };

  const handleChange = (index, field, value) => {
    const sensor = localConfig[index];
    if (!sensor) return;

    if (field === 'enabled') {
      const updated = [...localConfig];
      updated[index].enabled = !updated[index].enabled;
      setLocalConfig(updated);
      // revalidate channel on enable toggle
      const chVal = editableValues[`${index}-adcChannel`] ?? updated[index].adcChannel;
      const err = validateField('adcChannel', chVal, updated[index].name, index);
      setErrors(prev => ({ ...prev, [`${index}-adcChannel`]: err }));
      return;
    }

    if (field === 'type') {
      const newType = parseInt(value);
      const newAdcType = SENSOR_TYPE_TO_ADC_TYPE[newType];
      // adjust channel if out of range
      let currentChannel = parseInt(editableValues[`${index}-adcChannel`] ?? sensor.adcChannel);
      const limit = ADC_CHANNEL_LIMITS[newAdcType];
      if (isNaN(currentChannel) || currentChannel > limit) currentChannel = 0;
      const updated = [...localConfig];
      updated[index] = {
        ...updated[index],
        type: newType,
        adcType: newAdcType,
        adcChannel: currentChannel
      };
      setLocalConfig(updated);
      setEditableValues(prev => ({
        ...prev,
        [`${index}-type`]: newType,
        [`${index}-adcChannel`]: currentChannel
      }));
      const typeErr = validateField('type', newType, sensor.name, index);
      const chErr = validateField('adcChannel', currentChannel, sensor.name, index);
      setErrors(prev => ({
        ...prev,
        [`${index}-type`]: typeErr,
        [`${index}-adcChannel`]: chErr
      }));
      return;
    }

    if (field === 'adcChannel') {
      setEditableValues(prev => ({ ...prev, [`${index}-adcChannel`]: value }));
      const updated = [...localConfig];
      updated[index].adcChannel = value === '' ? value : parseInt(value);
      setLocalConfig(updated);
      const err = validateField('adcChannel', value, sensor.name, index);
      setErrors(prev => ({ ...prev, [`${index}-adcChannel`]: err }));
      return;
    }

    if (field === 'name' || field === 'conversionFactor' || field === 'offset') {
      setEditableValues(prev => ({ ...prev, [`${index}-${field}`]: value }));
      const err = validateField(field, value, sensor.name, index);
      setErrors(prev => ({ ...prev, [`${index}-${field}`]: err }));
    }
  };

  const handleSave = () => {
    let hasErrors = false;
    const newErrors = {};
    localConfig.forEach((sensor, index) => {
      if (!sensor) return;
      const fields = ['name', 'type', 'adcChannel', 'conversionFactor', 'offset'];
      fields.forEach(field => {
        const value = editableValues[`${index}-${field}`] ?? (field === 'adcChannel' ? sensor.adcChannel : sensor[field]);
        const err = validateField(field, value?.toString(), sensor.name, index);
        if (err) {
          hasErrors = true;
          newErrors[`${index}-${field}`] = err;
        }
      });
    });
    if (hasErrors) {
      setErrors(newErrors);
      return;
    }

    const finalConfig = localConfig.map((sensor, index) => ({
      ...sensor,
      name: editableValues[`${index}-name`] ?? sensor.name,
      type: editableValues[`${index}-type`] ?? sensor.type,
      adcType: SENSOR_TYPE_TO_ADC_TYPE[editableValues[`${index}-type`] ?? sensor.type],
      adcChannel: parseInt(editableValues[`${index}-adcChannel`]),
      conversionFactor: parseFloat(editableValues[`${index}-conversionFactor`]),
      offset: parseFloat(editableValues[`${index}-offset`])
    }));

    onSave(finalConfig);
    onClose();
  };

  const groupedSensors = localConfig.reduce((groups, sensor) => {
    (groups[sensor.type] = groups[sensor.type] || []).push(sensor);
    return groups;
  }, {});

  const typeLabels = {
    [SENSOR_TYPE.LOAD]: 'Load Cells',
    [SENSOR_TYPE.PRESSURE]: 'Pressure Sensors',
    [SENSOR_TYPE.TEMPERATURE]: 'Temperature Sensors'
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="6xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent maxW={{ base: '90%', md: '80%', lg: '70%' }} maxH="90vh" position="relative">
        {renderCalculator()}
        <ModalHeader>Sensor Configuration</ModalHeader>
        <ModalBody
          display="flex"
          flexDir="column"
          maxH="calc(90vh - 150px)"
          overflowY="auto"
        >
          <VStack spacing={4} align="stretch" minH="0">
            {Object.entries(groupedSensors).map(([type, sensors]) => (
              <Box key={type}>
                <Text fontSize="lg" fontWeight="bold" mb={2}>
                  {typeLabels[type]}
                </Text>
                <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={3} mb={4}>
                  {sensors.map(sensor => {
                    const originalIndex = localConfig.findIndex(s => s === sensor);
                    return (
                      <Box key={`${sensor.name}-${originalIndex}`} p={3} borderWidth="1px" borderRadius="lg" bg="white">
                        <FormControl>
                          <HStack mb={2} justifyContent="space-between">
                            <FormLabel fontWeight="bold" mb={0}>
                              {sensor.name}
                            </FormLabel>
                            <HStack>
                              <Checkbox
                                isChecked={sensor.enabled}
                                onChange={() => handleChange(originalIndex, 'enabled')}
                                colorScheme={sensor.enabled ? 'green' : 'red'}
                              />
                              <Badge
                                colorScheme={sensor.enabled ? 'green' : 'red'}
                                variant="solid"
                                borderRadius="full"
                                px={2}
                              >
                                {sensor.enabled ? 'Enabled' : 'Disabled'}
                              </Badge>
                            </HStack>
                          </HStack>

                          <VStack spacing={2}>
                            <FormControl isInvalid={errors[`${originalIndex}-name`]}>
                              <Tooltip label="Unique name used in charts & CSV headers.">
                                <FormLabel fontSize="sm" mb={1}>
                                  Sensor Name <InfoIcon ml={1} boxSize={3} />
                                </FormLabel>
                              </Tooltip>
                              <Input
                                type="text"
                                size="sm"
                                value={editableValues[`${originalIndex}-name`] ?? sensor.name}
                                onChange={e => handleChange(originalIndex, 'name', e.target.value)}
                                isDisabled={!sensor.enabled}
                                bg={!sensor.enabled ? 'gray.100' : 'white'}
                              />
                              <FormErrorMessage>{errors[`${originalIndex}-name`]}</FormErrorMessage>
                            </FormControl>

                            <FormControl isInvalid={errors[`${originalIndex}-type`]}>
                              <Tooltip label="Defines grouping & units. Changing adjusts underlying ADC type.">
                                <FormLabel fontSize="sm" mb={1}>
                                  Sensor Type <InfoIcon ml={1} boxSize={3} />
                                </FormLabel>
                              </Tooltip>
                              <Select
                                size="sm"
                                value={editableValues[`${originalIndex}-type`] ?? sensor.type}
                                onChange={e => handleChange(originalIndex, 'type', e.target.value)}
                                isDisabled={!sensor.enabled}
                                bg={!sensor.enabled ? 'gray.100' : 'white'}
                              >
                                <option value={SENSOR_TYPE.LOAD}>Load Cell</option>
                                <option value={SENSOR_TYPE.PRESSURE}>Pressure</option>
                                <option value={SENSOR_TYPE.TEMPERATURE}>Temperature</option>
                              </Select>
                              <FormErrorMessage>{errors[`${originalIndex}-type`]}</FormErrorMessage>
                            </FormControl>

                            <FormControl isInvalid={errors[`${originalIndex}-adcChannel`]}>
                              <Tooltip label="Hardware / logical channel on the associated ADC. Must be unique within the same ADC type.">
                                <FormLabel fontSize="sm" mb={1}>
                                  ADC Channel <InfoIcon ml={1} boxSize={3} />
                                </FormLabel>
                              </Tooltip>
                              <Input
                                type="number"
                                size="sm"
                                value={editableValues[`${originalIndex}-adcChannel`]}
                                min={0}
                                max={ADC_CHANNEL_LIMITS[sensor.adcType]}
                                onChange={e => handleChange(originalIndex, 'adcChannel', e.target.value)}
                                isDisabled={
                                  !sensor.enabled ||
                                  sensor.adcType === ADC_TYPE.ADS1232 /* fixed single channel */
                                }
                                bg={!sensor.enabled ? 'gray.100' : 'white'}
                              />
                              <FormErrorMessage>{errors[`${originalIndex}-adcChannel`]}</FormErrorMessage>
                            </FormControl>

                            <FormControl isInvalid={errors[`${originalIndex}-conversionFactor`]}>
                              <Tooltip label="Units per 1V. Example: 250kg at 2.5V => 100kg/V">
                                <FormLabel fontSize="sm" mb={1}>
                                  Conversion Factor <InfoIcon ml={1} boxSize={3} />
                                </FormLabel>
                              </Tooltip>
                              <HStack>
                                <InputGroup size="sm" flex={1}>
                                  <Input
                                    type="text"
                                    value={editableValues[`${originalIndex}-conversionFactor`]}
                                    onChange={e => handleChange(originalIndex, 'conversionFactor', e.target.value)}
                                    isDisabled={!sensor.enabled}
                                    bg={!sensor.enabled ? 'gray.100' : 'white'}
                                  />
                                  <InputRightAddon>
                                    {sensor.type === SENSOR_TYPE.LOAD
                                      ? 'kg/V'
                                      : sensor.type === SENSOR_TYPE.PRESSURE
                                        ? 'bar/V'
                                        : '°C/V'}
                                  </InputRightAddon>
                                </InputGroup>
                                <Button
                                  size="sm"
                                  colorScheme="teal"
                                  isDisabled={!sensor.enabled}
                                  onClick={() => {
                                    let sensorMax;
                                    switch (sensor.type) {
                                      case SENSOR_TYPE.LOAD: sensorMax = 400; break;
                                      case SENSOR_TYPE.PRESSURE: sensorMax = 600; break;
                                      case SENSOR_TYPE.TEMPERATURE: sensorMax = 600; break;
                                      default: sensorMax = 100;
                                    }
                                    setRangeSettings({
                                      voltageMin: 0,
                                      voltageMax: 2.5,
                                      sensorMin: 0,
                                      sensorMax
                                    });
                                    setCalculationModalOpen(originalIndex);
                                  }}
                                >
                                  <FaCalculator />
                                </Button>
                              </HStack>
                              <FormErrorMessage>{errors[`${originalIndex}-conversionFactor`]}</FormErrorMessage>
                            </FormControl>

                            <FormControl isInvalid={errors[`${originalIndex}-offset`]}>
                              <Tooltip label="Offset in real units to correct bias (reading at true zero).">
                                <FormLabel fontSize="sm" mb={1}>
                                  Offset <InfoIcon ml={1} boxSize={3} />
                                </FormLabel>
                              </Tooltip>
                              <InputGroup size="sm">
                                <Input
                                  type="text"
                                  value={editableValues[`${originalIndex}-offset`]}
                                  onChange={e => handleChange(originalIndex, 'offset', e.target.value)}
                                  isDisabled={!sensor.enabled}
                                  bg={!sensor.enabled ? 'gray.100' : 'white'}
                                />
                                <InputRightAddon>
                                  {sensor.type === SENSOR_TYPE.LOAD
                                    ? 'kg'
                                    : sensor.type === SENSOR_TYPE.PRESSURE
                                      ? 'bar'
                                      : '°C'}
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
          <HStack spacing={4} flex={1} maxW="60%">
            <FormControl isInvalid={errors.preset?.type === 'error'} maxW="200px">
              <Select
                size="md"
                value={selectedPreset}
                onChange={e => setSelectedPreset(e.target.value)}
                placeholder={Object.keys(presets).length === 0 ? 'No presets' : 'Create preset'}
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
              <ButtonGroup size="md" isAttached variant="outline">
                <Button colorScheme="blue" onClick={() => loadPreset(selectedPreset)}>Load</Button>
                <Button colorScheme="green" onClick={updatePreset}>Update</Button>
                <Button colorScheme="red" onClick={() => deletePreset(selectedPreset)}>Delete</Button>
              </ButtonGroup>
            ) : (
              <>
                <FormControl isInvalid={errors.preset?.type === 'error'}>
                  <Input
                    size="md"
                    placeholder="New preset name"
                    value={presetName}
                    onChange={e => setPresetName(e.target.value)}
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

          <HStack spacing={4}>
            <Button onClick={onClose}>Cancel</Button>
            <Button colorScheme="blue" onClick={handleSave}>Save Config</Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default SensorConfigModal;