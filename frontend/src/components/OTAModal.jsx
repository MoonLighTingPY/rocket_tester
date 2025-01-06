/* eslint-disable react/prop-types */
import { useState } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Button, FormControl, FormLabel, Input, VStack, Progress, Text,
  useToast
} from '@chakra-ui/react';

const OTAModal = ({ isOpen, onClose }) => {
    const [firmwareFile, setFirmwareFile] = useState(null);
    const [spiffsFile, setSpiffsFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentOperation, setCurrentOperation] = useState('');
    const toast = useToast();
  
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
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>OTA Update</ModalHeader>
          <ModalBody>
            <VStack spacing={4}>
              <FormControl>
                <FormLabel>Firmware (.bin)</FormLabel>
                <Input
                  type="file"
                  accept=".bin"
                  onChange={(e) => setFirmwareFile(e.target.files[0])}
                />
              </FormControl>
              
              <FormControl>
                <FormLabel>SPIFFS Image (.bin)</FormLabel>
                <Input
                  type="file"
                  accept=".bin"
                  onChange={(e) => setSpiffsFile(e.target.files[0])}
                />
              </FormControl>
  
              {uploading && (
                <>
                  <Text>{currentOperation}</Text>
                  <Progress
                    value={progress}
                    size="sm"
                    width="100%"
                    colorScheme="blue"
                    hasStripe
                    isAnimated
                  />
                  <Text>{progress.toFixed(1)}%</Text>
                </>
              )}
            </VStack>
          </ModalBody>
  
          <ModalFooter>
            <Button mr={3} onClick={onClose} isDisabled={uploading}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={handleUpload}
              isLoading={uploading}
              loadingText={currentOperation}
              isDisabled={(!firmwareFile && !spiffsFile) || uploading}
            >
              Upload
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    );
  };

export default OTAModal;