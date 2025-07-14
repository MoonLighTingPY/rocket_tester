#ifndef SETUP_FUNCTIONS_H
#define SETUP_FUNCTIONS_H

class Setup
{
public:
  static void pins();
  static void adc();
  static void spiffs();
  static void webServices();
  static void ota();
  static void ethernet();
};

#endif