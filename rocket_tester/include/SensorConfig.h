#ifndef SENSOR_CONFIG_H
#define SENSOR_CONFIG_H

#include <ArduinoJson.h>
#include <SPIFFS.h>

// Maximum number of sensors
constexpr size_t SENSOR_COUNT = 8;

// Sensor types
enum SensorType {
    LOAD = 0,
    PRESSURE = 1,
    TEMPERATURE = 2
};

// Sensor configuration structure
struct SensorConfig {
    bool enabled;
    SensorType type;
    uint8_t adcChannel;
    char name[50]; // Name of the sensor
    float conversionFactor;  // For converting voltage to actual units . Represents units per 1V. For example, if loadcell reads 250kg at 2.5V, conversion factor is 100kg/V
    float offset;            // For calibration offset
};

// External declaration of sensorConfigs array defined in SensorConfig.cpp
extern SensorConfig sensorConfigs[SENSOR_COUNT];

// Function declarations
void loadSensorConfig();
void saveSensorConfig(const JsonArray& arr);
void sendSensorConfig(uint8_t clientNum);
void handleUpdateConfig(uint8_t clientNum, JsonObject& data);

#endif // SENSOR_CONFIG_H