#include "sensor_config.h"
#include <Arduino.h>
#include <WebSocketsServer.h>
#include <cstring>

extern WebSocketsServer webSocket;

// Initialize sensorConfigs with default values for all 15 sensors
SensorConfig sensorConfigs[SENSOR_COUNT] = {
    // Load cell (ADS1232) - 1 sensor
    {true, LOAD, ADS1232_ADC, 0, 0, "LoadCell1", 1.0f, 0.0f},

    // Pressure sensors (ADS1256) - 2 sensors
    {false, PRESSURE, ADS1256_ADC, 0, 0, "Pressure1", 1.0f, 0.0f},
    {false, PRESSURE, ADS1256_ADC, 1, 0, "Pressure2", 1.0f, 0.0f},

    // Temperature sensors (MAX31855) - 12 sensors
    {false, TEMPERATURE, MAX31855_ADC, 0, 0, "Temperature1", 1.0f, 0.0f, MAX31855_CHIP}, // C0 - MAX31855
    {false, TEMPERATURE, MAX31855_ADC, 1, 0, "Temperature2", 1.0f, 0.0f, MAX31855_CHIP}, // C1 - MAX31855
    {false, TEMPERATURE, MAX31855_ADC, 2, 0, "Temperature3", 1.0f, 0.0f, MAX6675_CHIP},  // C2 - MAX6675
    {false, TEMPERATURE, MAX31855_ADC, 3, 0, "Temperature4", 1.0f, 0.0f, MAX6675_CHIP}}; // C3 - MAX6675

// Load sensor configuration from SPIFFS
void loadSensorConfig()
{
    File file = SPIFFS.open("/sensorConfig.json", "r");
    if (!file)
    {
        Serial.println("No config file found, using defaults");
        return;
    }
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, file);
    if (!error)
    {
        JsonArray arr = doc["config"].as<JsonArray>();
        for (size_t i = 0; i < arr.size() && i < SENSOR_COUNT; i++)
        {
            sensorConfigs[i].enabled = arr[i]["enabled"] | sensorConfigs[i].enabled;
            sensorConfigs[i].type = static_cast<SensorType>(arr[i]["type"] | (int)sensorConfigs[i].type);
            sensorConfigs[i].adcType = static_cast<ADCType>(arr[i]["adcType"] | (int)sensorConfigs[i].adcType);

            if (arr[i]["name"].is<const char *>())
            {
                strncpy(sensorConfigs[i].name, arr[i]["name"].as<const char *>(), sizeof(sensorConfigs[i].name) - 1);
                sensorConfigs[i].name[sizeof(sensorConfigs[i].name) - 1] = '\0';
            }
            sensorConfigs[i].adcChannel = arr[i]["adcChannel"] | sensorConfigs[i].adcChannel;
            sensorConfigs[i].chipSelect = arr[i]["chipSelect"] | sensorConfigs[i].chipSelect;
            sensorConfigs[i].conversionFactor = arr[i]["conversionFactor"] | sensorConfigs[i].conversionFactor;
            sensorConfigs[i].offset = arr[i]["offset"] | sensorConfigs[i].offset;
        }
        Serial.println("Loaded sensor config");
    }
    else
    {
        Serial.println("Failed to parse config file");
    }
    file.close();
}

// Save sensor configuration to SPIFFS
void saveSensorConfig(const JsonArray &arr)
{
    File file = SPIFFS.open("/sensorConfig.json", "w");
    if (!file)
        return;

    JsonDocument doc;
    JsonArray configArr = doc["config"].to<JsonArray>();

    for (size_t i = 0; i < SENSOR_COUNT; i++)
    {
        JsonObject sensorObj = configArr.add<JsonObject>();
        sensorObj["enabled"] = sensorConfigs[i].enabled;
        sensorObj["type"] = sensorConfigs[i].type;
        sensorObj["adcType"] = sensorConfigs[i].adcType;
        sensorObj["name"] = sensorConfigs[i].name;
        sensorObj["adcChannel"] = sensorConfigs[i].adcChannel;
        sensorObj["chipSelect"] = sensorConfigs[i].chipSelect;
        sensorObj["conversionFactor"] = sensorConfigs[i].conversionFactor;
        sensorObj["offset"] = sensorConfigs[i].offset;
    }

    serializeJson(doc, file);
    file.close();
}

// Send sensor configuration to client
void sendSensorConfig(uint8_t clientNum)
{
    JsonDocument doc;
    doc["type"] = "sensor_config";
    JsonArray configArr = doc["config"].to<JsonArray>();

    for (size_t i = 0; i < SENSOR_COUNT; i++)
    {
        JsonObject sensorObj = configArr.add<JsonObject>();
        sensorObj["name"] = sensorConfigs[i].name;
        sensorObj["enabled"] = sensorConfigs[i].enabled;
        sensorObj["type"] = sensorConfigs[i].type;
        sensorObj["adcType"] = sensorConfigs[i].adcType;
        sensorObj["adcChannel"] = sensorConfigs[i].adcChannel;
        sensorObj["chipSelect"] = sensorConfigs[i].chipSelect;
        sensorObj["conversionFactor"] = sensorConfigs[i].conversionFactor;
        sensorObj["offset"] = sensorConfigs[i].offset;
    }

    String json;
    serializeJson(doc, json);
    webSocket.sendTXT(clientNum, json);
}

// Handle update sensor configuration from client
void handleUpdateConfig(uint8_t clientNum, JsonObject &data)
{
    if (!data["config"].is<JsonArray>())
        return;
    JsonArray arr = data["config"].as<JsonArray>();
    for (size_t i = 0; i < arr.size() && i < SENSOR_COUNT; i++)
    {
        sensorConfigs[i].enabled = arr[i]["enabled"];
        sensorConfigs[i].type = static_cast<SensorType>(arr[i]["type"]);
        sensorConfigs[i].adcType = static_cast<ADCType>(arr[i]["adcType"]);

        if (arr[i]["name"].is<const char *>())
        {
            strncpy(sensorConfigs[i].name, arr[i]["name"].as<const char *>(), sizeof(sensorConfigs[i].name) - 1);
            sensorConfigs[i].name[sizeof(sensorConfigs[i].name) - 1] = '\0';
        }
        sensorConfigs[i].adcChannel = arr[i]["adcChannel"];
        sensorConfigs[i].chipSelect = arr[i]["chipSelect"];
        sensorConfigs[i].conversionFactor = arr[i]["conversionFactor"];
        sensorConfigs[i].offset = arr[i]["offset"];
    }
    saveSensorConfig(arr);
    sendSensorConfig(clientNum);
}