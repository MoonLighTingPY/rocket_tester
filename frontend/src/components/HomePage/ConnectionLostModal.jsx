import {
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    Text,
    VStack
  } from '@chakra-ui/react';
  
  const ConnectionLostModal = ({ isOpen, onClose, onExport }) => {
    return (
      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader color="red.500">Connection Lost</ModalHeader>
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <Text>
                Connection to the device has been lost during the test. It is recommended to save all received data before continuing.
              </Text>
              <Text fontWeight="bold">
                Would you like to export the data now?
              </Text>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="gray" mr={3} onClick={onClose}>
              Close
            </Button>
            <Button colorScheme="blue" onClick={onExport}>
              Export Data
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    );
  };
  
  export default ConnectionLostModal;