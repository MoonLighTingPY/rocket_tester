/* eslint-disable react/prop-types */
import { useState, useRef } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Button, FormControl, FormLabel, Input, VStack, Progress, Text,
  useToast, Alert, AlertIcon, Box, Icon, Divider
} from '@chakra-ui/react';
import { RepeatIcon } from '@chakra-ui/icons';
import { FaCloudUploadAlt } from 'react-icons/fa';

const OTAModal = ({ isOpen, onClose }) => {
    const [firmwareFile, setFirmwareFile] = useState(null);
    const [spiffsFile, setSpiffsFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentOperation, setCurrentOperation] = useState('');
    const toast = useToast();
    const firmwareInputRef = useRef(null);
    const spiffsInputRef = useRef(null);

    const handleClearSelection = (type) => {
        if (type === 'firmware') {
            setFirmwareFile(null);
            if (firmwareInputRef.current) {
                firmwareInputRef.current.value = '';
            }
        } else {
            setSpiffsFile(null);
            if (spiffsInputRef.current) {
                spiffsInputRef.current.value = '';
            }
        }
    };

    const handleFileSelect = (type, file) => {
        if (type === 'firmware') {
          if (spiffsFile) {
            toast({
              title: 'Only one file at a time',
              description: 'Please clear SPIFFS selection before selecting firmware',
              status: 'warning',
              duration: 5000,
              isClosable: true
            });
            return;
          }
          setFirmwareFile(file);
        } else {
          if (firmwareFile) {
            toast({
              title: 'Only one file at a time',
              description: 'Please clear firmware selection before selecting SPIFFS',
              status: 'warning',
              duration: 5000,
              isClosable: true
            });
            return;
          }
          setSpiffsFile(file);
        }
      };
  
    const uploadFile = async (file, endpoint, operation) => {
        const formData = new FormData();
        formData.append('file', file);
        
        const xhr = new XMLHttpRequest();
        
        return new Promise((resolve, reject) => {
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    setProgress(percentComplete);
                }
            };
    
            xhr.onload = () => {
                if (xhr.status === 200) {
                    toast({
                        title: 'Update Successful',
                        description: xhr.responseText,
                        status: 'success',
                        duration: 5000,
                        isClosable: true
                    });
                    resolve(xhr.responseText);
                } else {
                    reject(new Error(`${operation} upload failed: ${xhr.status} - ${xhr.responseText}`));
                }
            };
    
            xhr.onerror = () => {
                console.error('XHR Error:', xhr.statusText);
                reject(new Error(`${operation} upload failed: Network error`));
            };
    
            xhr.open('POST', `http://esp32-rockettester.local/${endpoint}`);
            xhr.send(formData);
        });
    };
    
    const handleUpload = async () => {
        try {
            setUploading(true);
            
            if (firmwareFile) {
                setCurrentOperation('Uploading firmware');
                setProgress(0);
                await uploadFile(firmwareFile, 'update', 'firmware');
                
                setCurrentOperation('Device is restarting...');
                await new Promise(resolve => setTimeout(resolve, 5000));
                window.location.reload(); // Reload after firmware update
            }
            
            if (spiffsFile) {
                setCurrentOperation('Uploading SPIFFS');
                setProgress(0);
                await uploadFile(spiffsFile, 'updatefs', 'spiffs');
                
                setCurrentOperation('Device is restarting...');
                await new Promise(resolve => setTimeout(resolve, 5000));
                window.location.reload(); // Reload after SPIFFS update
            }
    
            toast({
                title: 'Update Complete',
                description: 'All updates completed successfully. Device has restarted.',
                status: 'success',
                duration: 5000,
                isClosable: true
            });
            
            onClose();
        } catch (error) {
            toast({
                title: 'Update Failed',
                description: error.message,
                status: 'error',
                duration: 5000,
                isClosable: true
            });
        } finally {
            setUploading(false);
            setProgress(0);
            setCurrentOperation('');
        }
    };
  
    return (
        <Modal isOpen={isOpen} onClose={onClose} size="xl">
          <ModalOverlay backdropFilter="blur(4px)" />
          <ModalContent>
            <ModalHeader 
              bg="blue.500" 
              color="white" 
              borderTopRadius="md"
              display="flex"
              alignItems="center"
              gap={2}
            >
              <Icon as={FaCloudUploadAlt} w={6} h={6} />
              Over-The-Air Update
            </ModalHeader>
            
            <ModalBody>
              <VStack spacing={6} py={4}>
              <Alert status="info" borderRadius="md">
                  <AlertIcon />
                  <Box>
                    <Text fontWeight="bold">Automatic Update Process</Text>
                    <Text fontSize="sm">
                      The entire process will be handled automatically. It will upload the firmware or SPIFFS image to the board, reboot it and reload the web page after the update is complete.
                    </Text>
                  </Box>
                </Alert>
                

                <FormControl>
                    <FormLabel display="flex" alignItems="center" gap={2}>
                        <Text fontWeight="bold">Firmware (.bin)</Text>
                    </FormLabel>
                    <Input
                        ref={firmwareInputRef}  // Add ref
                        type="file"
                        accept=".bin"
                        onChange={(e) => handleFileSelect('firmware', e.target.files[0])}
                        p={1}
                        border="2px dashed"
                        borderColor={firmwareFile ? "green.200" : "blue.200"}
                        _hover={{ borderColor: firmwareFile ? "green.400" : "blue.400" }}
                        cursor={spiffsFile ? "not-allowed" : "pointer"}
                        disabled={spiffsFile !== null}
                    />
                    {firmwareFile && (
                        <Button 
                            size="sm" 
                            mt={2} 
                            onClick={() => handleClearSelection('firmware')}
                            colorScheme="red"
                            variant="outline"
                        >
                            Clear Selection
                        </Button>
                    )}
                </FormControl>

                <FormControl>
                    <FormLabel display="flex" alignItems="center" gap={2}>
                        <Text fontWeight="bold">SPIFFS Image (.bin)</Text>
                    </FormLabel>
                    <Input
                        ref={spiffsInputRef}
                        type="file"
                        accept=".bin"
                        onChange={(e) => handleFileSelect('spiffs', e.target.files[0])}
                        p={1}
                        border="2px dashed"
                        borderColor={spiffsFile ? "green.200" : "blue.200"}
                        _hover={{ borderColor: spiffsFile ? "green.400" : "blue.400" }}
                        cursor={firmwareFile ? "not-allowed" : "pointer"}
                        disabled={firmwareFile !== null}
                    />
                    {spiffsFile && (
                        <Button 
                            size="sm" 
                            mt={2} 
                            onClick={() => handleClearSelection('spiffs')}
                            colorScheme="red"
                            variant="outline"
                        >
                            Clear Selection
                        </Button>
                    )}
                </FormControl>
        
                {uploading ? (
                  <Box w="100%" p={4} borderRadius="md" bg="gray.50">
                    <Text 
                      fontWeight="bold" 
                      color="blue.600" 
                      mb={2}
                      display="flex"
                      alignItems="center"
                      gap={2}
                    >
                      <RepeatIcon animation="spin 2s linear infinite" />
                      {currentOperation}
                    </Text>
                    <Progress
                      value={progress}
                      size="lg"
                      width="100%"
                      colorScheme="blue"
                      hasStripe
                      isAnimated
                      borderRadius="full"
                      mb={2}
                    />
                    <Text textAlign="center" color="gray.600">
                      {progress.toFixed(1)}% Complete
                    </Text>
                  </Box>
                ) : (
                    
                <Alert status="warning" borderRadius="md">
                    <AlertIcon />
                    <Box>
                        <Text fontWeight="bold">Important</Text>
                        <Text fontSize="sm">
                        You can only upload one type of file at a time - either firmware OR SPIFFS image.
                        Clear your current selection before choosing a different file. Keep the device powered on, and do not interrupt the update process.
                        </Text>
                    </Box>
                </Alert>

                )}
              </VStack>
            </ModalBody>
  
            <Divider />
            
            <ModalFooter bg="gray.50" borderBottomRadius="md">
              <Button 
                mr={3} 
                onClick={onClose} 
                isDisabled={uploading}
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                colorScheme="blue"
                onClick={handleUpload}
                isLoading={uploading}
                loadingText={currentOperation}
                isDisabled={(!firmwareFile && !spiffsFile) || uploading}
                leftIcon={<FaCloudUploadAlt />}
                size="lg"
              >
                Start Update
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      );
  };
  
  export default OTAModal;