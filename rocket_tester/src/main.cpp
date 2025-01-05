#include <Arduino.h>
#include <WiFi.h>
#include <SPIFFS.h>
#include <ESPAsyncWebServer.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <CircularBuffer.hpp>
#include <ESPmDNS.h>
#include "secret.h"

#include <ADS1256.h>
#include <SPI.h>

// Define ADS1256 parameters
const float ADS_CLOCK_MHZ = 7.68; // Crystal frequency
const float ADS_VREF = 2.5;       // Voltage reference
const bool ADS_USE_RESET = false; // If reset pin is tied to 3.3V

// DRDY: GPIO 17
// RST: GPIO 16
// CS: GPIO 5
// MOSI/MISO/SCK: Default SPI pins

// Create ADS1256 instance
// ADS1256 adc(ADS_CLOCK_MHZ, ADS_VREF, ADS_USE_RESET);


// Network credentials
const char* ssid = WIFI_SSID;
const char* password = WIFI_PASS;
const char* hostname = "esp32-rockettester";

// Web server and WebSocket setup
AsyncWebServer server(80);
WebSocketsServer webSocket = WebSocketsServer(81);

// Pin definitions
const int ENGINE_OUT_PIN = 26;
const int ENGINE_IN_PIN = 27;
const int PYRO_PIN = 25;

// Global variables
bool isReading = false;
bool ingitedWire = false;
bool engineStarted = false;
unsigned long readingsStartTime = 0;
unsigned long ingitionStartTime = 0;
unsigned long engineStartTime = 0;
unsigned long dataCounter = 0;
const float SAMPLE_PERIOD = 1.0/1000.0;  // ~1.16ms per sample at 860Hz
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
    const char* name;
    float conversionFactor;  // For converting voltage to actual units
    float offset;            // For calibration offset
};

// Array of sensor configurations
constexpr size_t SENSOR_COUNT = 8;
SensorConfig sensorConfigs[SENSOR_COUNT] = {
    {true, LOAD, 0, "LoadCell1", 0.3025, 0},           // Channel 0: Load Cell conversionFactor = 600 kg / 2.5V = 0.3025 kg/V
    {false, LOAD, 1, "LoadCell2", 0.3025, 0},          // Channel 1: Load Cell 2 conversionFactor = 600 kg / 2.5V = 0.3025 kg/V
    {false, PRESSURE, 2, "Pressure1", 240.0, -16.0 },  // Channel 2: Pressure Sensor 2 conversionFactor = 600 bar / 2.5V = 240 bar/V
    {false, PRESSURE, 3, "Pressure2", 240.0, -16.0 },  // Channel 3: Pressure Sensor 3 conversionFactor = 600 bar / 2.5V = 240 bar/V
    {false, PRESSURE, 4, "Pressure3", 240.0, -16.0 },  // Channel 4: Pressure Sensor 4 conversionFactor = 600 bar / 2.5V = 240 bar/V
    {false, TEMPERATURE, 5, "Temperature1", 320.0, 0}, // Channel 5: Temperature Sensor 1 conversionFactor = 800 deg C / 2.5V = 320 deg C/V
    {false, TEMPERATURE, 6, "Temperature2", 320.0, 0}, // Channel 6: Temperature Sensor 2 conversionFactor = 800 deg C / 2.5V = 320 deg C/V
    {false, TEMPERATURE, 7, "Temperature3", 320.0, 0}  // Channel 7: Temperature Sensor 3 conversionFactor = 800 deg C / 2.5V = 320 deg C/V
};

// Updated sensor data structure
struct SensorData {
    float values[SENSOR_COUNT];  // Fixed-size array for sensor values
    unsigned long readingsTimestamp;
    unsigned long ignitionTimestamp; 
    unsigned long engineTimestamp;

    SensorData() : readingsTimestamp(0), ignitionTimestamp(0), engineTimestamp(0) {
        for(int i = 0; i < SENSOR_COUNT; i++) {
            values[i] = 0.0f;
        }
    }
};

// Circular buffer to store sensor data
constexpr size_t BUFFER_SIZE = 1500; // Reduced from 2000 to 1000
CircularBuffer<SensorData, BUFFER_SIZE> dataBuffer;


// Task handles
TaskHandle_t sensorTaskHandle = NULL;
TaskHandle_t webSocketTaskHandle = NULL;


// Mutex for buffer access
portMUX_TYPE bufferMux = portMUX_INITIALIZER_UNLOCKED;

void IRAM_ATTR engineStartISR() {
    if (ingitedWire && !engineStarted) {
        engineStartTime = micros();
        engineStarted = true;
    }
}

// Function to clear the buffer
void clearBuffer() {
    portENTER_CRITICAL(&bufferMux);
    while (!dataBuffer.isEmpty()) {
        dataBuffer.shift();
    }
    portEXIT_CRITICAL(&bufferMux);
}


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
            sensorConfigs[i].type = (SensorType)(arr[i]["type"] | (int)sensorConfigs[i].type);
            // Only update name if it exists in config
            if (arr[i]["name"].is<const char*>()) {
                // Allocate memory for the new name string
                const char* newName = arr[i]["name"].as<const char*>();
                if (newName) {
                    sensorConfigs[i].name = strdup(newName);
                }
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

// Save sensor config to SPIFFS
void saveSensorConfig(const JsonArray& arr) {
  File file = SPIFFS.open("/sensorConfig.json", "w");
  if (!file) return;
  
  JsonDocument doc;
  JsonArray configArr = doc["config"].to<JsonArray>();
  
  for (size_t i = 0; i < SENSOR_COUNT; i++) {
    JsonObject sensorObj = configArr.add<JsonObject>();
    sensorObj["enabled"] = sensorConfigs[i].enabled;
    sensorObj["type"] = (int)sensorConfigs[i].type;
    sensorObj["name"] = sensorConfigs[i].name;
    sensorObj["adcChannel"] = sensorConfigs[i].adcChannel;
    sensorObj["conversionFactor"] = sensorConfigs[i].conversionFactor;
    sensorObj["offset"] = sensorConfigs[i].offset;
  }
  
  serializeJson(doc, file);
  file.close();
}

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

void handleUpdateConfig(uint8_t clientNum, JsonObject& data) {
    if (!data["config"].is<JsonArray>()) return;

    JsonArray arr = data["config"].as<JsonArray>();
    portENTER_CRITICAL(&bufferMux);
    for (size_t i = 0; i < arr.size() && i < SENSOR_COUNT; i++) {
        sensorConfigs[i].enabled = arr[i]["enabled"];
        sensorConfigs[i].type = (SensorType)(int)arr[i]["type"];
        // Free old name if it exists
        if (sensorConfigs[i].name) {
            free((void*)sensorConfigs[i].name);
        }
        // Allocate and copy new name
        const char* newName = arr[i]["name"].as<const char*>();
        if (newName) {
            sensorConfigs[i].name = strdup(newName);
        }
        sensorConfigs[i].adcChannel = arr[i]["adcChannel"];
        sensorConfigs[i].conversionFactor = arr[i]["conversionFactor"];
        sensorConfigs[i].offset = arr[i]["offset"];
    }
    portEXIT_CRITICAL(&bufferMux);

    saveSensorConfig(arr);

    // Send back updated config
    sendSensorConfig(clientNum);
}


// High-speed sensor reading task
void sensorTask(void *parameter) {
    SensorData data;
    TickType_t xLastWakeTime = xTaskGetTickCount();
    const TickType_t xFrequency = pdMS_TO_TICKS(1);
    
    while (true) {
        vTaskDelayUntil(&xLastWakeTime, xFrequency);
        
        if (isReading) {
            portENTER_CRITICAL(&bufferMux);
            uint32_t currentTime = micros();
            data.readingsTimestamp = currentTime - readingsStartTime;
            data.ignitionTimestamp = ingitedWire ? (currentTime - ingitionStartTime) : 0;
            
            // Read enabled sensors more efficiently
            bool firstChannel = true;
            for (size_t i = 0; i < SENSOR_COUNT; i++) {
                const SensorConfig& sensor = sensorConfigs[i];
                if (sensor.enabled) {
                    // adc.waitDRDY(); // Wait for previous conversion
                    
                    if (!firstChannel) {
                        // Read previous channel's conversion
                        // float voltage = adc.readCurrentChannel();
                        float voltage = dataCounter; // Temporary, to test data streaming
                        data.values[i-1] = voltage * sensorConfigs[i-1].conversionFactor + sensorConfigs[i-1].offset;
                    }
                    
                    // Set next channel
                    // adc.setChannel(sensor.adcChannel);
                    firstChannel = false;
                } else {
                    data.values[i] = 0.0f;
                }
            }
            
            // Read the last enabled channel
            if (!firstChannel) {
                // adc.waitDRDY();
                // float voltage = adc.readCurrentChannel();
                float voltage = dataCounter; // Temporary, to test data streaming   
                // Find last enabled sensor
                for (int i = SENSOR_COUNT-1; i >= 0; i--) {
                    if (sensorConfigs[i].enabled) {
                        data.values[i] = voltage * sensorConfigs[i].conversionFactor + sensorConfigs[i].offset;
                        break;
                    }
                }
            }

            if (!dataBuffer.isFull()) {
                dataBuffer.push(data);
            }
            portEXIT_CRITICAL(&bufferMux);
        }
    }
}

// WebSocket communication task
void webSocketTask(void *parameter) {
    TickType_t xLastWakeTime = xTaskGetTickCount();
    const TickType_t xFrequency = pdMS_TO_TICKS(1);
    size_t dataCounter = 0; // Temporary, to test data streaming
    
    while (true) {
        vTaskDelayUntil(&xLastWakeTime, xFrequency);
        webSocket.loop();

        if (isReading && !dataBuffer.isEmpty()) {
            JsonDocument doc;
            JsonArray array = doc["data"].to<JsonArray>();

            portENTER_CRITICAL(&bufferMux);
            while (!dataBuffer.isEmpty()) {
                SensorData data = dataBuffer.shift();
                JsonObject reading = array.add<JsonObject>();

                reading["t1"] = data.readingsTimestamp;
                reading["t2"] = data.ignitionTimestamp;

                // Add only enabled sensors to JSON with their names
                for (size_t i = 0; i < SENSOR_COUNT; i++) {
                    const SensorConfig& sensor = sensorConfigs[i];
                    if (sensor.enabled) {
                        reading[sensor.name] = data.values[i];
                        if (sensor.type == LOAD) { // Temporary, to test data streaming
                            reading[sensor.name] = dataCounter; // Temporary, to test data streaming
                        } // Temporary, to test data streaming
                    }
                }
                dataCounter++; // Temporary, to test data streaming
            }
            portEXIT_CRITICAL(&bufferMux);

            if (array.size() >= 0) {
                doc["type"] = "test_data";
                String jsonString;
                serializeJson(doc, jsonString);
                webSocket.broadcastTXT(jsonString);
                dataCounter++;
            }
        }

        // Check for engine start with precise timing
        if (ingitedWire && !engineStarted) {
            uint32_t currentTime = micros();
            if ((currentTime - ingitionStartTime) >= 150000) {
                portENTER_CRITICAL(&bufferMux);
                engineStartTime = currentTime; // Capture precise time
                engineStarted = true;
                portEXIT_CRITICAL(&bufferMux);
            }
        }
    }
}

void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
    switch(type) {
        case WStype_CONNECTED: {
            Serial.printf("WebSocket client #%u connected\n", num);
            // Send initial config automatically on connect
            sendSensorConfig(num);
            break;
        }
        case WStype_DISCONNECTED: {
            Serial.printf("WebSocket client #%u disconnected\n", num);
            isReading = false;
            ingitedWire = false;
            engineStarted = false;
            dataCounter = 0;
            digitalWrite(PYRO_PIN, LOW);
            break;
        }
            
        case WStype_TEXT: {
            String message = String((char*)payload);
            JsonDocument doc;
            auto err = deserializeJson(doc, payload, length);
            if(!err) {
                if(doc["type"] == "get_config") {
                    sendSensorConfig(num);
                }
                else if(doc["type"] == "update_config") {
                    JsonObject obj = doc.as<JsonObject>();
                    handleUpdateConfig(num, obj);
                }
            }

            
            if (message == "start_readings") {
                isReading = true;
                dataCounter = 0;
                readingsStartTime = micros();
            }
            else if (message == "start_ignition") {
                ingitedWire = true;
                engineStarted = false;
                ingitionStartTime = micros();
                digitalWrite(PYRO_PIN, HIGH);


            }
            else if (message == "end_test") {
                isReading = false;
                ingitedWire = false;
                engineStarted = false;
                dataCounter = 0;
                digitalWrite(PYRO_PIN, LOW);

                clearBuffer(); // Clear the buffer when stopping the readings so that the next test starts with an empty buffer and no old data lmaooo
                JsonDocument doc;
                doc.clear(); // Good practice to clear the document before reuse
                doc["type"] = "time_difference";
                doc["value"] = engineStartTime - ingitionStartTime;
                String jsonString;
                serializeJson(doc, jsonString);
                webSocket.broadcastTXT(jsonString);
            }

            break;
        }
    }
}

void setupADC() {
    // Initialize ADC with desired data rate and gain
    // adc.begin(ADS1256_DRATE_1000SPS, ADS1256_GAIN_1, false);
    // Wait for ADC to be ready
    // adc.waitDRDY();
    Serial.println("ADS1256 initialized");
}

void setupPins() {
    pinMode(ENGINE_OUT_PIN, OUTPUT);
    pinMode(ENGINE_IN_PIN, INPUT_PULLUP);
    pinMode(PYRO_PIN, OUTPUT);
    
    digitalWrite(ENGINE_OUT_PIN, HIGH);
    digitalWrite(PYRO_PIN, LOW);
    
    attachInterrupt(digitalPinToInterrupt(ENGINE_IN_PIN), engineStartISR, FALLING);
}

void setupWiFi() {
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
        delay(1000);
        Serial.println("Connecting to WiFi...");
    }
    Serial.println(WiFi.localIP());

    if (!MDNS.begin(hostname)) {
        Serial.println("Error setting up MDNS responder!");
    } else {
        Serial.println("mDNS responder started");
        Serial.println("http://" + String(hostname) + ".local");
    }
}   

void setupSPIFFS() {
    if (!SPIFFS.begin(true)) {
        Serial.println("An Error has occurred while mounting SPIFFS");
        ESP.restart();
        return;
    }
    Serial.println("SPIFFS mounted successfully");
}

void setupWebServices() {
    server.on("/", HTTP_GET, [](AsyncWebServerRequest *request){
        request->send(SPIFFS, "/index.html", "text/html");
    });
    server.serveStatic("/assets", SPIFFS, "/assets");
    server.begin();

    webSocket.begin();
    webSocket.onEvent(webSocketEvent);
}

void setup() {
    Serial.begin(115200);

    setupSPIFFS();
    loadSensorConfig();
    setupADC();
    setupPins();
    setupWiFi();
    setupWebServices();

    // Create tasks on different cores
    xTaskCreatePinnedToCore(
        sensorTask,
        "SensorTask",
        10000,
        NULL,
        configMAX_PRIORITIES - 1,  // Highest priority for sensor readings
        &sensorTaskHandle,
        0  // Core 0
    );

    xTaskCreatePinnedToCore(
        webSocketTask,
        "WebSocketTask",
        10000,
        NULL,
        configMAX_PRIORITIES - 2,  // High but lower than sensor task
        &webSocketTaskHandle,
        1  // Core 1
    );
}

void loop() {
    vTaskDelete(NULL); // Delete setup and loop task
}