// cs_controller.h
#ifndef CS_CONTROLLER_H
#define CS_CONTROLLER_H

#include <Arduino.h>
#include <HardwareSerial.h>

class CSController
{
private:
    HardwareSerial *serial;
    int currentActiveCS;

public:
    CSController(HardwareSerial *serialPort);
    void begin(unsigned long baudRate = 115200);
    bool selectCS(int csIndex);
    void deselectAll();
    int getCurrentActiveCS() const;
};

#endif