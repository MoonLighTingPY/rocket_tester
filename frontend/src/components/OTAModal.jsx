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
  const toast = useToast();

  const handleUpload = async () => {
    try {
      setUploading(true);
      
      if (firmwareFile) {
        const formData = new FormData();
        formData.append('firmware', firmwareFile);
        
        const response = await fetch('http://esp32-rockettester.local/update', {
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) throw new Error('Firmware upload failed');
      }
      
      if (spiffsFile) {
        const formData = new FormData();
        formData.append('spiffs', spiffsFile);
        
        const response = await fetch('http://esp32-rockettester.local/updatefs', {
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) throw new Error('SPIFFS upload failed');
      }

      toast({
        title: 'Update successful',
        description: 'Device will restart automatically',
        status: 'success',
        duration: 5000
      });
      
      onClose();
    } catch (error) {
      toast({
        title: 'Update failed',
        description: error.message,
        status: 'error',
        duration: 5000
      });
    } finally {
      setUploading(false);
      setProgress(0);
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
                <Progress
                  value={progress}
                  size="sm"
                  width="100%"
                  colorScheme="blue"
                />
                <Text>{progress}%</Text>
              </>
            )}
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button mr={3} onClick={onClose}>Cancel</Button>
          <Button
            colorScheme="blue"
            onClick={handleUpload}
            isLoading={uploading}
            loadingText="Uploading"
            isDisabled={!firmwareFile && !spiffsFile}
          >
            Upload
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default OTAModal;