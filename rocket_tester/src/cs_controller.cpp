// cs_controller.cpp
#include "cs_controller.h"

CSController::CSController(HardwareSerial *serialPort)
    : serial(serialPort), currentActiveCS(-1)
{
}

void CSController::begin(unsigned long baudRate)
{
    // Serial should already be initialized by setup function
    delay(100); // Give Arduino time to initialize

    // Send initial deselect command
    deselectAll();
    Serial.println("CS Controller initialized (one-way communication)");
}

bool CSController::selectCS(int csIndex)
{
    if (csIndex < 0 || csIndex >= 12)
    { // Assuming max 12 CS pins
        Serial.printf("Invalid CS index: %d\n", csIndex);
        return false;
    }

    String command = "CS" + String(csIndex);
    serial->println(command);
    currentActiveCS = csIndex;

    return true;
}

void CSController::deselectAll()
{
    serial->println("CSOFF");
    currentActiveCS = -1;
}

int CSController::getCurrentActiveCS() const
{
    return currentActiveCS;
}