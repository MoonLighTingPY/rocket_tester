#ifndef SETUP_FUNCTIONS_H
#define SETUP_FUNCTIONS_H

class Setup
{
public:
  static void pins();
  static void adcs();
  static void spiffs();
  static void webServices();
  static void ota();
  static void ethernet();
};

#endif