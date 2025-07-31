#ifndef SENSOR_CONFIG_H
#define SENSOR_CONFIG_H

#include <ArduinoJson.h>
#include <SPIFFS.h>

// Maximum number of sensors - 1 load cell + 2 pressure + 12 temperature
constexpr size_t SENSOR_COUNT = 15;
constexpr size_t LOAD_CELL_COUNT = 1;
constexpr size_t PRESSURE_SENSOR_COUNT = 2;
constexpr size_t TEMPERATURE_SENSOR_COUNT = 2;

// Sensor types
enum SensorType
{
    LOAD = 0,
    PRESSURE = 1,
    TEMPERATURE = 2
};

// ADC types for different sensor categories
enum ADCType
{
    ADS1232_ADC = 0, // For load cell
    ADS1256_ADC = 1, // For pressure sensors
    MAX31855_ADC = 2 // For temperature sensors
};

// Sensor configuration structure
struct SensorConfig
{
    bool enabled;
    SensorType type;
    ADCType adcType;
    uint8_t adcChannel;     // Channel on the specific ADC
    uint8_t chipSelect;     // CS pin for MAX31855 (only used for temperature sensors)
    char name[50];          // Name of the sensor
    float conversionFactor; // For converting to actual units
    float offset;           // For calibration offset
};

// External declaration of sensorConfigs array
extern SensorConfig sensorConfigs[SENSOR_COUNT];

// Function declarations
void loadSensorConfig();
void saveSensorConfig(const JsonArray &arr);
void sendSensorConfig(uint8_t clientNum);
void handleUpdateConfig(uint8_t clientNum, JsonObject &data);

#endif // SENSOR_CONFIG_H