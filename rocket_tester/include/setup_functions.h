#ifndef SETUP_FUNCTIONS_H
#define SETUP_FUNCTIONS_H

#include <Arduino.h>

class Setup
{
public:
  static void pins();
  static void adcs();
  static void spiffs();
  static void webServices();
  static void ota();
  static bool ethernet();
};

// Declare the multiplexer helper function
void setMultiplexerChannel(uint8_t channel);

#endif