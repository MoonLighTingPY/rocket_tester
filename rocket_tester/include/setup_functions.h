// Updated setup_functions.h with CS controller
#ifndef SETUP_FUNCTIONS_H
#define SETUP_FUNCTIONS_H

#include <Arduino.h>

class Setup
{
public:
  static void pins();             // Initialize GPIO pins
  static void initCSController(); // Initialize CS controller (Arduino Pro Micro)
  static void adcs();             // Initialize all ADCs
  static void spiffs();           // Initialize SPIFFS
  static void webServices();      // Initialize web server and websockets
  static void ota();              // Initialize OTA updates
  static bool ethernet();         // Initialize Ethernet connection
};

#endif