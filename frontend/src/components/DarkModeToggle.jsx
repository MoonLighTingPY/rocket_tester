// src/components/DarkModeToggle.jsx
import { useEffect, useState } from 'react';
import { Flex, Switch, Tooltip } from '@chakra-ui/react';
import { MoonIcon, SunIcon } from '@chakra-ui/icons';
import { enable, disable } from 'darkreader';

const DarkModeToggle = () => {
  const [isDarkMode, setIsDarkMode] = useState(
    localStorage.getItem('darkMode') === 'true' || false
  );
  
  useEffect(() => {
    // Initialize based on stored preference
    if (isDarkMode) {
      enable({
        brightness: 100,
        contrast: 100,
        sepia: 0
      });
    } else {
      disable();
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('darkMode', newMode);
    
    if (newMode) {
      enable({
        brightness: 100,
        contrast: 100,
        sepia: 0
      });
    } else {
      disable();
    }
  };


  return (
    <Tooltip label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
      <Flex 
        alignItems="center"
        justifyContent="center" 
        borderRadius="full" 
        bg={isDarkMode ? "gray.700" : "gray.100"} 
        p={1}
        pl={2}
        pr={2}
        cursor="pointer"
        onClick={toggleDarkMode}
        transition="all 0.2s"
        _hover={{ bg: isDarkMode ? "gray.600" : "gray.200" }}
        role="group"
        height="32px" // Fixed height for consistent alignment
      >
        <SunIcon color={isDarkMode ? "gray.400" : "yellow.500"} boxSize="16px" mr={2} />
        <Flex 
          onClick={(e) => {
            // Prevent the Switch component from capturing the click
            e.stopPropagation();
            toggleDarkMode();
          }}
          alignItems="center"
          justifyContent="center"
        >
          <Switch 
            isChecked={isDarkMode}
            colorScheme="blue"
            size="sm"
            pointerEvents="none"
          />
        </Flex>
        <MoonIcon color={isDarkMode ? "blue.300" : "gray.400"} boxSize="16px" ml={2} />
      </Flex>
    </Tooltip>
  );
};

export default DarkModeToggle;