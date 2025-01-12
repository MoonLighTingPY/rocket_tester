#include "SensorConfig.h"
#include <Arduino.h>
#include <WebSocketsServer.h>
#include <cstring> // for strncpy

extern WebSocketsServer webSocket; // Defined in main.cpp, used to send sensor configuration to clients

// Initialize sensorConfigs with default values
SensorConfig sensorConfigs[SENSOR_COUNT] = {
    {true, LOAD, 0, "LoadCell1", 240.0f, 0.0f},
    {false, LOAD, 1, "LoadCell2", 240.0f, 0.0f},
    {false, PRESSURE, 2, "Pressure1", 240.0f, -16.0f},
    {false, PRESSURE, 3, "Pressure2", 240.0f, -16.0f},
    {false, PRESSURE, 4, "Pressure3", 240.0f, -16.0f},
    {false, TEMPERATURE, 5, "Temperature1", 320.0f, 0.0f},
    {false, TEMPERATURE, 6, "Temperature2", 320.0f, 0.0f},
    {false, TEMPERATURE, 7, "Temperature3", 320.0f, 0.0f}
};

// Load sensor configuration from SPIFFS
void loadSensorConfig() {
    File file = SPIFFS.open("/sensorConfig.json", "r");
    if (!file) {
        Serial.println("No config file found, using defaults");
        return;
    }
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, file);
    if (!error) {
        JsonArray arr = doc["config"].as<JsonArray>();
        for (size_t i = 0; i < arr.size() && i < SENSOR_COUNT; i++) {
            sensorConfigs[i].enabled = arr[i]["enabled"] | sensorConfigs[i].enabled;
            sensorConfigs[i].type = static_cast<SensorType>(arr[i]["type"] | (int)sensorConfigs[i].type);
            // Only update name if it exists in config
            if (arr[i]["name"].is<const char*>()) {
                strncpy(sensorConfigs[i].name, arr[i]["name"].as<const char*>(), sizeof(sensorConfigs[i].name) - 1);
                sensorConfigs[i].name[sizeof(sensorConfigs[i].name) - 1] = '\0'; // Ensure null-termination
            }
            sensorConfigs[i].adcChannel = arr[i]["adcChannel"] | sensorConfigs[i].adcChannel;
            sensorConfigs[i].conversionFactor = arr[i]["conversionFactor"] | sensorConfigs[i].conversionFactor;
            sensorConfigs[i].offset = arr[i]["offset"] | sensorConfigs[i].offset;
        }
        Serial.println("Loaded sensor config");
    } else {
        Serial.println("Failed to parse config file");
    }
    file.close();
}

// Save sensor recieved configuration from the client to SPIFFS
void saveSensorConfig(const JsonArray& arr) {
    File file = SPIFFS.open("/sensorConfig.json", "w");
    if (!file) return;

    JsonDocument doc;
    JsonArray configArr = doc["config"].to<JsonArray>();

    for (size_t i = 0; i < SENSOR_COUNT; i++) {
        JsonObject sensorObj = configArr.add<JsonObject>();
        sensorObj["enabled"] = sensorConfigs[i].enabled;
        sensorObj["type"] = sensorConfigs[i].type;
        sensorObj["name"] = sensorConfigs[i].name;
        sensorObj["adcChannel"] = sensorConfigs[i].adcChannel;
        sensorObj["conversionFactor"] = sensorConfigs[i].conversionFactor;
        sensorObj["offset"] = sensorConfigs[i].offset;
    }

    serializeJson(doc, file);
    file.close();
}

// Send sensor configuration to client
void sendSensorConfig(uint8_t clientNum) {
    JsonDocument doc;
    doc["type"] = "sensor_config";
    JsonArray configArr = doc["config"].to<JsonArray>();

    for (size_t i = 0; i < SENSOR_COUNT; i++) {
        JsonObject sensorObj = configArr.add<JsonObject>();
        sensorObj["name"] = sensorConfigs[i].name;
        sensorObj["enabled"] = sensorConfigs[i].enabled;
        sensorObj["type"] = sensorConfigs[i].type;
        sensorObj["adcChannel"] = sensorConfigs[i].adcChannel;
        sensorObj["conversionFactor"] = sensorConfigs[i].conversionFactor;
        sensorObj["offset"] = sensorConfigs[i].offset;
    }

    String json;
    serializeJson(doc, json);
    webSocket.sendTXT(clientNum, json);
}

// Handle update sensor configuration from client
void handleUpdateConfig(uint8_t clientNum, JsonObject& data) {
    if (!data["config"].is<JsonArray>()) return;
    JsonArray arr = data["config"].as<JsonArray>();
    for (size_t i = 0; i < arr.size() && i < SENSOR_COUNT; i++) {
        sensorConfigs[i].enabled = arr[i]["enabled"];
        sensorConfigs[i].type = static_cast<SensorType>(arr[i]["type"]);
        // Update name
        if (arr[i]["name"].is<const char*>()) {
            strncpy(sensorConfigs[i].name, arr[i]["name"].as<const char*>(), sizeof(sensorConfigs[i].name) - 1);
            sensorConfigs[i].name[sizeof(sensorConfigs[i].name) - 1] = '\0';
        }
        sensorConfigs[i].adcChannel = arr[i]["adcChannel"];
        sensorConfigs[i].conversionFactor = arr[i]["conversionFactor"];
        sensorConfigs[i].offset = arr[i]["offset"];
    }
    saveSensorConfig(arr);
    // Send back updated config
    sendSensorConfig(clientNum);
}