#include <Arduino.h>
#include <WiFi.h>
#include <SPIFFS.h>
#include <ESPAsyncWebServer.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <CircularBuffer.hpp>
#include <ESPmDNS.h>
#include <WiFiUdp.h>
#include <ArduinoOTA.h>
#include <ETH.h>
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
// SCLK  18  // Default SPI pins for VSPI
// MISO  19
// MOSI  23

// Create ADS1256 instance
ADS1256 adc(ADS_CLOCK_MHZ, ADS_VREF, ADS_USE_RESET);


// Network credentials
const char* ssid = WIFI_SSID;
const char* password = WIFI_PASS;
const char* hostname = "esp32-rockettester";

// Web server and WebSocket setup
AsyncWebServer server(80);
WebSocketsServer webSocket = WebSocketsServer(81);

// Pin definitions
const int ENGINE_OUT_PIN = 99;
const int ENGINE_IN_PIN = 99;
const int PYRO_PIN = 99;

// Global variables
bool isReading = false;
bool ingitedWire = false;
bool engineStarted = false;
unsigned long readingsStartTime = 0;
unsigned long ingitionStartTime = 0;
unsigned long engineStartTime = 0;
size_t dataCounter = 0;
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
    {true, LOAD, 0, "LoadCell1", 240.0, 0},           // Channel 0: Load Cell conversionFactor = 600 kg / 2.5V = 240.0 kg/V
    {false, LOAD, 1, "LoadCell2", 240.0, 0},          // Channel 1: Load Cell 2 conversionFactor = 600 kg / 2.5V = 240.0 kg/V
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

struct BufferStats {
    uint32_t overruns;
    uint32_t samplesProcessed;
    float sampleRate;
};

BufferStats stats = {0, 0, 0};

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
void clearDataBuffer() {
    portENTER_CRITICAL(&bufferMux);
    while (!dataBuffer.isEmpty()) {
        dataBuffer.pop();
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
                    if (sensorConfigs[i].name) {
                        free((void*)sensorConfigs[i].name);
                    }
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
    const TickType_t xFrequency = pdMS_TO_TICKS(10);

        while (true) {
        if (isReading) {
            uint32_t currentTime = micros();
            data.readingsTimestamp = currentTime - readingsStartTime;
            data.ignitionTimestamp = ingitedWire ? (currentTime - ingitionStartTime) : 0;

            // Read all enabled channels in sequence
            bool hasData = false;
            for (uint8_t i = 0; i < SENSOR_COUNT; i++) {
                if (sensorConfigs[i].enabled) {
                    // Quick non-blocking DRDY check
                    if (adc.isDRDY()) {
                        float voltage = adc.readCurrentChannel();
                        data.values[i] = voltage * sensorConfigs[i].conversionFactor + sensorConfigs[i].offset;
                        hasData = true;
                        
                        // Setup next channel
                        adc.setChannel(sensorConfigs[i].adcChannel);
                        adc.waitDRDY();
                    }
                } else {
                    data.values[i] = 1.0f;
                }
            }

            // Push data if we got readings
            if (hasData) {
                portENTER_CRITICAL(&bufferMux);
                if (!dataBuffer.isFull()) {
                    dataBuffer.push(data);
                }
                portEXIT_CRITICAL(&bufferMux);
            }
        }

        // Use proper RTOS timing
        vTaskDelayUntil(&xLastWakeTime, xFrequency);
    }
}

// WebSocket communication task
void webSocketTask(void *parameter) {
    TickType_t xLastWakeTime = xTaskGetTickCount();
    const TickType_t xFrequency = pdMS_TO_TICKS(1);
    
    while (true) {
        vTaskDelayUntil(&xLastWakeTime, xFrequency);
        webSocket.loop();
        ArduinoOTA.handle();



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
                    }
                }
            }
            portEXIT_CRITICAL(&bufferMux);

            if (array.size() >= 0) {
                doc["type"] = "test_data";
                String jsonString;
                serializeJson(doc, jsonString);
                webSocket.broadcastTXT(jsonString);
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
        if (dataBuffer.isFull()) {
            stats.overruns++;
        } else {
            stats.samplesProcessed++;
            stats.sampleRate = stats.samplesProcessed / ((micros() - readingsStartTime) / 1e6);
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
            clearDataBuffer();
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
                clearDataBuffer();
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

                clearDataBuffer(); // Clear the buffer when stopping the readings so that the next test starts with an empty buffer and no old data lmaooo
                JsonDocument doc;
                doc.clear(); // Good practice to clear the document before reuse
                doc["type"] = "time_difference";
                doc["value"] = engineStartTime - ingitionStartTime;
                String jsonString;
                serializeJson(doc, jsonString);
                webSocket.broadcastTXT(jsonString);
                // Send buffer stats (temporarily, for testing purposes)
                JsonDocument doc2;
                doc2.clear();
                doc2["type"] = "buffer_stats";
                doc2["overruns"] = stats.overruns;
                doc2["samplesProcessed"] = stats.samplesProcessed;
                doc2["sampleRate"] = stats.sampleRate;
                String jsonString2;
                serializeJson(doc2, jsonString2);
                webSocket.broadcastTXT(jsonString2);
            }

            break;
        }
    }
}


void setupPins() {
    pinMode(ENGINE_OUT_PIN, OUTPUT);
    pinMode(ENGINE_IN_PIN, INPUT_PULLUP);
    pinMode(PYRO_PIN, OUTPUT);
    

    
    digitalWrite(ENGINE_OUT_PIN, HIGH);
    digitalWrite(PYRO_PIN, LOW);
    
    attachInterrupt(digitalPinToInterrupt(ENGINE_IN_PIN), engineStartISR, FALLING);
}

void setupADC() {
    Serial.println("Setting up ADC");
    // Moved this from ADC1256.cpp. I fucking hate this library. It's 4 o'clock in the morning
    // The author of this library is a professional cock sucker and a balls licker. He should be executed with an A50 gun
    // And burn in hell afterwards while his ass cheeks melt from the devilous back shots
    SPI.begin();
    Serial.println("Spi initialized");
    SPI.beginTransaction(SPISettings(7680000, MSBFIRST, SPI_MODE1));
    Serial.println("SPi settings set");

    Serial.println("Calling adc.begin()");
    adc.begin(ADS1256_DRATE_1000SPS, ADS1256_GAIN_1, false);
    Serial.println("Suncess!");
    // Reset all channels
    for (uint8_t i = 0; i < SENSOR_COUNT; i++) {
        if (sensorConfigs[i].enabled) {
            adc.setChannel(sensorConfigs[i].adcChannel);
            delayMicroseconds(100);
        }
    }
    
    // Calibrate ADC
    adc.sendCommand(ADS1256_CMD_SELFCAL);
    delayMicroseconds(100);
     // Send RDATAC command to enable continuous read mode
    adc.waitDRDY();
    
    adc.sendCommand(ADS1256_CMD_RDATAC);
    delayMicroseconds(100);
    adc.waitDRDY();

    // Start with first channel
    if (sensorConfigs[0].enabled) {
        adc.setChannel(sensorConfigs[0].adcChannel);
    }
}


void setupWiFi() {
    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);
    WiFi.persistent(true);
    
    // Connect to WiFi first using DHCP
    WiFi.begin(ssid, password);
    unsigned long startAttemptTime = millis();
    
    while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < 10000) {
        delay(1000);
        Serial.println("Connecting to WiFi...");
    }

    if (WiFi.status() == WL_CONNECTED) {
        // Get router's subnet info
        IPAddress routerIP = WiFi.gatewayIP();
        IPAddress routerSubnet = WiFi.subnetMask();
        
        // Proposed static IP
        IPAddress desiredIP(192, 168, 0, 69);
        
        // Check if desired IP is in same subnet as router
        if ((routerIP & routerSubnet) == (desiredIP & routerSubnet)) {
            if (WiFi.config(desiredIP, routerIP, routerSubnet)) {
                Serial.println("Static IP configuration successful");
            } else {
                Serial.println("Failed to set static IP, staying with DHCP");
            }
        } else {
            Serial.println("Desired IP not in router's subnet, staying with DHCP");
        }
    } else {
        Serial.println("Failed to connect to WiFi, staying with DHCP");
    }

    delay(1000);

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
    DefaultHeaders::Instance().addHeader("Access-Control-Allow-Origin", "*");
    DefaultHeaders::Instance().addHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
    DefaultHeaders::Instance().addHeader("Access-Control-Allow-Headers", "Content-Type");
    

    server.on("/", HTTP_GET, [](AsyncWebServerRequest *request){
        request->send(SPIFFS, "/index.html", "text/html");
    });
    

    // Handle OPTIONS preflight requests
    server.onNotFound([](AsyncWebServerRequest *request) {
        if (request->method() == HTTP_OPTIONS) {
            request->send(200);
        } else {
            request->send(SPIFFS, "/index.html", "text/html");
        }
    });

     // Update firmware endpoint
    server.on("/update", HTTP_POST, [](AsyncWebServerRequest *request) {
        bool success = !Update.hasError();
        AsyncWebServerResponse *response = request->beginResponse(200, "text/plain", 
            success ? "Firmware update successful. Device will restart." : "Firmware update failed!");
        response->addHeader("Connection", "close");
        // Don't add CORS header here since it's already set globally
        request->send(response);
        if(success) {
            delay(1000);
            ESP.restart();
        }
    }, [](AsyncWebServerRequest *request, String filename, size_t index, uint8_t *data, size_t len, bool final) {
        if(!index) {
            Serial.println("Update Start");
            if(!Update.begin(UPDATE_SIZE_UNKNOWN, U_FLASH)) {
                Update.printError(Serial);
                return;
            }
        }

        if(Update.write(data, len) != len) {
            Update.printError(Serial);
            return;
        }

        if(final) {
            if(!Update.end(true)) {
                Update.printError(Serial);
            }
        }
    });

    // Update SPIFFS endpoint  
    server.on("/updatefs", HTTP_POST, [](AsyncWebServerRequest *request) {
        bool success = !Update.hasError();
        AsyncWebServerResponse *response = request->beginResponse(200, "text/plain", 
            success ? "SPIFFS update successful. Device will restart." : "SPIFFS update failed!");
        response->addHeader("Connection", "close");
        // Don't add CORS header here since it's already set globally
        request->send(response);
        if(success) {
            delay(1000);
            ESP.restart();
        }
    }, [](AsyncWebServerRequest *request, String filename, size_t index, uint8_t *data, size_t len, bool final) {
        if(!index) {
            Serial.println("SPIFFS Update Start");
            if(!Update.begin(UPDATE_SIZE_UNKNOWN, U_SPIFFS)) {
                Update.printError(Serial);
                return;
            }
        }

        if(Update.write(data, len) != len) {
            Update.printError(Serial);
            return;
        }

        if(final) {
            if(!Update.end(true)) {
                Update.printError(Serial);
            }
        }
    });

    server.serveStatic("/assets", SPIFFS, "/assets");
    server.begin();
    webSocket.begin();
    webSocket.onEvent(webSocketEvent);
}

void setupOTA() {
    ArduinoOTA.setHostname(hostname);  // Use existing hostname variable
    
    ArduinoOTA.onStart([]() {
        String type;
        if (ArduinoOTA.getCommand() == U_FLASH) {
            type = "sketch";
        } else {  // U_SPIFFS
            type = "filesystem";
            SPIFFS.end();  // Unmount SPIFFS
        }
        Serial.println("Start updating " + type);
    });
    
    ArduinoOTA.onEnd([]() {
        Serial.println("\nEnd");
    });
    
    ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
        Serial.printf("Progress: %u%%\r", (progress / (total / 100)));
    });
    
    ArduinoOTA.onError([](ota_error_t error) {
        Serial.printf("Error[%u]: ", error);
        if (error == OTA_AUTH_ERROR) Serial.println("Auth Failed");
        else if (error == OTA_BEGIN_ERROR) Serial.println("Begin Failed");
        else if (error == OTA_CONNECT_ERROR) Serial.println("Connect Failed");
        else if (error == OTA_RECEIVE_ERROR) Serial.println("Receive Failed");
        else if (error == OTA_END_ERROR) Serial.println("End Failed");
    });
    
    ArduinoOTA.begin();
    Serial.println("OTA ready");
}

void setup() {
    Serial.begin(115200);
    Serial.println("Rocket Tester ESP32");
    dacWrite(25, 193);
    dacWrite(26, 193);


    setupADC();
    // setupEthernet();


    setupSPIFFS();
    loadSensorConfig();
    setupPins();
    setupWiFi();
    setupWebServices();
    setupOTA();

    // Create tasks on different cores
    xTaskCreatePinnedToCore(
        sensorTask,
        "SensorTask",
        10000,
        NULL,
        7,  // Highest priority for sensor readings
        &sensorTaskHandle,
        0  // Core 0
    );

    xTaskCreatePinnedToCore(
        webSocketTask,
        "WebSocketTask",
        10000,
        NULL,
        6,  // High but lower than sensor task
        &webSocketTaskHandle,
        1  // Core 1
    );
}

void loop() {
    vTaskDelete(NULL); // Delete setup and loop task
}