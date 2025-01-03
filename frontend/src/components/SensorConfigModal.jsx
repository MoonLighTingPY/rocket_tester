/* eslint-disable react/prop-types */
import { useState, useEffect } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Button, FormControl, FormLabel, Input, Checkbox, VStack, SimpleGrid,
  Box, Text, Divider
} from '@chakra-ui/react';

const SensorConfigModal = ({ isOpen, onClose, sensorConfig, onSave }) => {
  const [localConfig, setLocalConfig] = useState(sensorConfig || []);

  useEffect(() => {
    if (sensorConfig && Array.isArray(sensorConfig) && sensorConfig.length > 0) {
      setLocalConfig([...sensorConfig]);
    }
  }, [sensorConfig]);

  const handleChange = (index, field, value) => {
    const updated = [...localConfig];
    if (field === 'enabled') {
      updated[index][field] = !updated[index][field];
    } else if (field === 'adcChannel') {
      const channelNum = Math.min(Math.max(parseInt(value) || 0, 0), 7);
      updated[index][field] = channelNum;
    } else {
      updated[index][field] = value;
    }
    setLocalConfig(updated);
  };

  const handleSave = () => {
    onSave(localConfig);
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
    <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        size="6xl"
        scrollBehavior="inside" // Add this to make modal content scrollable
        >
        <ModalOverlay />
        <ModalContent 
            maxW={{ base: "90%", md: "80%", lg: "70%" }}
            maxH="90vh" // Limit height to 90% of viewport height
        >
            <ModalHeader>Sensor Configuration</ModalHeader>
            <ModalBody overflow="auto"> {/* Make body scrollable */}
            <VStack spacing={4} align="stretch">
                {Object.entries(groupedSensors).map(([type, sensors]) => (
                <Box key={type}>
                    <Text fontSize="lg" fontWeight="bold" mb={2}>
                    {typeLabels[type]}
                    </Text>
                    <SimpleGrid 
                    columns={{ base: 1, md: 2, lg: 3 }} 
                    spacing={3}
                    mb={4}
                    >
                    {sensors.map((sensor) => {
                        const originalIndex = localConfig.findIndex(s => s.name === sensor.name);
                        return (
                        <Box 
                            key={sensor.name} 
                            p={3} // Reduce padding
                            borderWidth="1px" 
                            borderRadius="lg"
                            bg="white"
                        >
                            <FormControl>
                            <FormLabel fontWeight="bold" mb={1}>{sensor.name}</FormLabel>
                            <Checkbox
                                isChecked={sensor.enabled}
                                onChange={() => handleChange(originalIndex, 'enabled')}
                                mb={2}
                            >
                                Enabled
                            </Checkbox>
                            <VStack spacing={2}>
                                <FormControl>
                                <FormLabel fontSize="sm" mb={1}>ADC Channel (0-7)</FormLabel>
                                <Input
                                    type="number"
                                    value={sensor.adcChannel}
                                    min={0}
                                    max={7}
                                    size="sm"
                                    onChange={(e) =>
                                    handleChange(originalIndex, 'adcChannel', e.target.value)
                                    }
                                />
                                </FormControl>
                                <FormControl>
                                <FormLabel fontSize="sm" mb={1}>Conversion Factor</FormLabel>
                                <Input
                                    type="number"
                                    value={sensor.conversionFactor || ''}
                                    size="sm"
                                    onChange={(e) =>
                                    handleChange(originalIndex, 'conversionFactor', parseFloat(e.target.value))
                                    }
                                />
                                </FormControl>
                                <FormControl>
                                <FormLabel fontSize="sm" mb={1}>Offset</FormLabel>
                                <Input
                                    type="number"
                                    value={sensor.offset || ''}
                                    size="sm"
                                    onChange={(e) =>
                                    handleChange(originalIndex, 'offset', parseFloat(e.target.value))
                                    }
                                />
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
            <ModalFooter>
            <Button onClick={onClose} mr={3}>Cancel</Button>
            <Button colorScheme="blue" onClick={handleSave}>Save</Button>
            </ModalFooter>
        </ModalContent>
        </Modal>
  );
};

export default SensorConfigModal;