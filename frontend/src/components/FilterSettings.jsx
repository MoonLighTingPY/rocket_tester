import { VStack, FormControl, FormLabel, NumberInput, NumberInputField } from '@chakra-ui/react';

const FilterSettings = ({ filterType, kalmanSettings, setKalmanSettings, gaussianSettings, setGaussianSettings }) => {
  const handleKalmanChange = (field, value) => {
    if (value === '' || !isNaN(value)) {
      setKalmanSettings(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleGaussianChange = (value) => {
    if (value === '' || !isNaN(value)) {
      setGaussianSettings(prev => ({
        ...prev,
        kernelSize: value
      }));
    }
  };

  return (
    <>
      {filterType === 'kalman' && (
        <VStack spacing={4}>
          <FormControl>
            <FormLabel>Q Value</FormLabel>
            <NumberInput step={0.0001} min={0} value={kalmanSettings.Q}>
              <NumberInputField
                value={kalmanSettings.Q}
                onChange={(e) => handleKalmanChange('Q', e.target.value)}
              />
            </NumberInput>
          </FormControl>
          <FormControl>
            <FormLabel>R Value</FormLabel>
            <NumberInput step={0.01} min={0} value={kalmanSettings.R}>
              <NumberInputField
                value={kalmanSettings.R}
                onChange={(e) => handleKalmanChange('R', e.target.value)}
              />
            </NumberInput>
          </FormControl>
        </VStack>
      )}

      {filterType === 'gaussian' && (
        <FormControl>
          <FormLabel>Kernel Size</FormLabel>
          <NumberInput step={2} min={3} value={gaussianSettings.kernelSize}>
            <NumberInputField
              value={gaussianSettings.kernelSize}
              onChange={(e) => handleGaussianChange(e.target.value)}
            />
          </NumberInput>
        </FormControl>
      )}
    </>
  );
};

export default FilterSettings;