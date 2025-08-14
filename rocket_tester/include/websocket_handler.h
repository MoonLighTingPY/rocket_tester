#ifndef WEBSOCKET_HANDLER_H
#define WEBSOCKET_HANDLER_H

#include <Arduino.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>
#include <ADS1232.h> // ensure ADS1232 type is visible

// Calibration states
enum CalState
{
    CAL_IDLE,
    CAL_TARE,
    CAL_WAIT_KNOWN,
    CAL_CALIBRATING
};

struct CalibrationCtx
{
    CalState state = CAL_IDLE;
    uint64_t phaseStart = 0;
    uint64_t lastSample = 0;
    double sum = 0;
    size_t samples = 0;
    float tare = 0;
    float knownWeight = 0;
    int loadCellIndex = -1;
};

// externs (defined in a single .cpp)
extern CalibrationCtx calibration;
extern ADS1232 ads1232;

void webSocketEvent(uint8_t num, WStype_t type, uint8_t *payload, size_t length);

#endif // WEBSOCKET_HANDLER_H