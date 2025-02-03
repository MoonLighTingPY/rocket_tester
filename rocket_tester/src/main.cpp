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
#include "Secret.h"
#include "SensorConfig.h"
#include <ADS1256.h>
#include <SPI.h>

// ESP32 Dev Module
// DRDY: GPIO 17
// RST: GPIO 16
// CS: GPIO 5
// SCLK  18  // Default SPI pins for VSPI
// MISO  19
// MOSI  23


// ADS1256 setup (set custom spi pins in ADS1256.cpp init if using WT-32_ETH01)
ADS1256 adc(39, 15, 0, 14, 2.4937); //DRDY, RESET, SYNC(PDWN), CS, VREF(float). 

// Network credentials (Temporary, will be replaced with an ethernet connection)
const char* ssid = WIFI_SSID;
const char* password = WIFI_PASS;
const char* hostname = "esp32-rockettester";

// Web server and WebSocket setup
AsyncWebServer server(80);
WebSocketsServer webSocket = WebSocketsServer(81);

// Task handles
TaskHandle_t sensorTaskHandle = NULL;
TaskHandle_t webSocketTaskHandle = NULL;

// Pin definitions
const int ENGINE_OUT_PIN = 17;
const int ENGINE_IN_PIN = 35;
const int PYRO_PIN = 5;

// Global variables
bool isReading = false;
bool ingitedWire = false;
unsigned long readingsStartTime = 0;
unsigned long ingitionStartTime = 0;
unsigned long engineStartTime = 0;


// Sensor data structure to store readings and timestamps for each sensor
struct SensorData {
    float values[SENSOR_COUNT];  // Fixed-size array for sensor values so no dynamic memory allocation is needed
    unsigned long readingsTimestamp;
    unsigned long ignitionTimestamp; 
    unsigned long engineTimestamp;

    SensorData() : readingsTimestamp(0), ignitionTimestamp(0), engineTimestamp(0) {
        for(int i = 0; i < SENSOR_COUNT; i++) {
            values[i] = 0.0f;
        }
    }
};


#pragma pack(push, 1)  // Ensure struct is packed with no padding
struct BinarySensorPacket {
    uint32_t readingsTimestamp;  // 4 bytes
    uint32_t ignitionTimestamp;  // 4 bytes  
    float sensorValues[SENSOR_COUNT];  // 4 bytes * SENSOR_COUNT
};
#pragma pack(pop)

// Circular buffer to store sensor data so we can read data at high speed and avoid blocking tasks while sending data over websocket. FIFO
constexpr size_t BUFFER_SIZE = 1500; // Yes, it's not going to use that much, but it's better to have bit more than less
CircularBuffer<SensorData, BUFFER_SIZE> dataBuffer;

// Mutex for buffer access
portMUX_TYPE bufferMux = portMUX_INITIALIZER_UNLOCKED;


// Interrupt to detect engine start (falling edge)
// ESP outputs a signal from one pin and recieves it on another, the wire that connects them goes trough the engine's fire chamber,
// so when the engine starts - the connection breaks, we do not recieve the signal anymore, and the interrupt is triggered,
// and the engine start time is captured
void IRAM_ATTR engineStartISR() {
        engineStartTime = micros();
}

// Function to clear the buffer
void clearDataBuffer() {
    portENTER_CRITICAL(&bufferMux);
    while (!dataBuffer.isEmpty()) {
        dataBuffer.pop();
    }
    portEXIT_CRITICAL(&bufferMux);
}

// Sensor reading task. Reads all enabled sensors and pushes data to the buffer
// for the WebSocket task to send to the client. Buffer is used to avoid blocking, so tasks
// can run independently and at different speeds (reading is faster than sending)
void sensorTask(void *parameter) {
    SensorData data;

    while (true) {
        if (isReading) {
            uint32_t currentTime = micros();
            data.readingsTimestamp = currentTime - readingsStartTime;
            data.ignitionTimestamp = ingitedWire ? (currentTime - ingitionStartTime) : 0;
            float voltage[SENSOR_COUNT];
            bool hasData = false;
            for (uint8_t i = 0; i < SENSOR_COUNT; i++) {
                voltage[i] = adc.convertToVoltage(adc.cycleSingle());
                // voltage[i] = i * 0.1f; // Temporary, will be replaced with ADC readings
                
                if (sensorConfigs[i].enabled) {
                    data.values[i] = voltage[i] * sensorConfigs[i].conversionFactor + sensorConfigs[i].offset;
                    hasData = true;
                
                } else {
                    data.values[i] = 0.0f;
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

        // RTOS wake up delay
        vTaskDelay(1);
    }
}

// WebSocket communication task
void webSocketTask(void *parameter) {
    static constexpr size_t MAX_PACKETS = 50; // Max packets per transmission
    static BinarySensorPacket packets[MAX_PACKETS];
    
    while (true) {
        webSocket.loop();
        ArduinoOTA.handle();
        
        if (isReading && !dataBuffer.isEmpty()) {
            size_t packetCount = 0;
            
            portENTER_CRITICAL(&bufferMux);
            while (!dataBuffer.isEmpty() && packetCount < MAX_PACKETS) {
                SensorData data = dataBuffer.shift();
                packets[packetCount].readingsTimestamp = data.readingsTimestamp;
                packets[packetCount].ignitionTimestamp = data.ignitionTimestamp;
                memcpy(packets[packetCount].sensorValues, data.values, sizeof(float) * SENSOR_COUNT);
                packetCount++;
            }
            portEXIT_CRITICAL(&bufferMux);

            if (packetCount > 0) {
                size_t totalSize = packetCount * sizeof(BinarySensorPacket);
                webSocket.broadcastBIN(reinterpret_cast<uint8_t*>(packets), totalSize);
            }
        }
        vTaskDelay(1);
    }
}

// WebSocket event handler (connected, disconnected, text message)
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
            // Stop reading and clear buffer when client disconnects, set flags to initial states
            clearDataBuffer();
            isReading = false;
            ingitedWire = false;
            digitalWrite(PYRO_PIN, LOW);
            break;
        }
            
        case WStype_TEXT: {
            String message = String((char*)payload);
            JsonDocument doc;
            auto err = deserializeJson(doc, payload, length);
            if(!err) {
                // Send sensor config to client
                if(doc["type"] == "get_config") {
                    sendSensorConfig(num);
                }
                // Update sensor config from client
                else if(doc["type"] == "update_config") {
                    JsonObject obj = doc.as<JsonObject>();
                    handleUpdateConfig(num, obj);
                }
            }


            if (message == "start_readings") {
                clearDataBuffer(); // Clear the buffer before starting a new test
                isReading = true;
                readingsStartTime = micros();
            }

            else if (message == "start_ignition") {
                ingitedWire = true;
                ingitionStartTime = micros();
                digitalWrite(PYRO_PIN, HIGH); // Ignite the engine
            }

            else if (message == "end_test") {
                // Set flags to initial states and clear buffer after the test is done
                isReading = false;
                ingitedWire = false;
                digitalWrite(PYRO_PIN, LOW);
                clearDataBuffer();

                // Send time difference between ignition and real engine start to the client
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


void setupPins() {
    pinMode(ENGINE_OUT_PIN, OUTPUT);
    pinMode(ENGINE_IN_PIN, INPUT_PULLUP);
    pinMode(PYRO_PIN, OUTPUT); // Pyro pin to ignite the engine
    digitalWrite(ENGINE_OUT_PIN, HIGH); 
    digitalWrite(PYRO_PIN, LOW); // Set to low by default to avoid accidental ignition
    attachInterrupt(digitalPinToInterrupt(ENGINE_IN_PIN), engineStartISR, FALLING);
}


void setupADC() {
    Serial.println("Setting up ADC");
    adc.InitializeADC();
    adc.setPGA(PGA_2);
    adc.setDRATE(DRATE_2000SPS);
    adc.sendDirectCommand(SELFCAL);
    delay(100);  // Wait for calibration

    // Set input buffer mode for high impedance inputs
    adc.setBuffer(BUFFER_ENABLED);

        // Configure all enabled channels
    for (uint8_t i = 0; i < SENSOR_COUNT; i++) {
        if (sensorConfigs[i].enabled) {
            // Set MUX for single-ended measurement relative to AINCOM
            uint8_t mux = SING_0 + sensorConfigs[i].adcChannel;
            adc.setMUX(mux);
            delayMicroseconds(100);
        }
    }


    // Initialize with first enabled channel
    for (uint8_t i = 0; i < SENSOR_COUNT; i++) {
        if (sensorConfigs[i].enabled) {
            uint8_t mux = SING_0 + sensorConfigs[i].adcChannel;
            adc.setMUX(mux);
            break;
        }
    }
}

// Temporary, will be replaced with ethernet connection
void setupWiFi() {
    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true); 
    WiFi.persistent(true); // Save WiFi settings to flash
    
    // Connect to WiFi first using DHCP
    WiFi.begin(ssid, password);
    unsigned long startAttemptTime = millis();
    
    while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < 10000) {
        delay(1000);
        Serial.println("Connecting to WiFi...");
    }

    // Try to set static IP
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
        Serial.println("Failed to connect to WiFi");
    }

    delay(1000); // Wait a bit to stabilize connection

    if (!MDNS.begin(hostname)) {
        Serial.println("Error setting up MDNS responder!");
    } else {
        // Web serber service
        MDNS.addService("http", "tcp", 80);
        // WebSocket service
        MDNS.addService("ws", "tcp", 81);
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

// Start web server and websocket, handle routes and OTA requests
void setupWebServices() {
    // Set CORS headers globally for all responses so we can access the routes from any domain
    DefaultHeaders::Instance().addHeader("Access-Control-Allow-Origin", "*");
    DefaultHeaders::Instance().addHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
    DefaultHeaders::Instance().addHeader("Access-Control-Allow-Headers", "Content-Type");
    
    // Root route
    server.on("/", HTTP_GET, [](AsyncWebServerRequest *request){
        request->send(SPIFFS, "/index.html", "text/html");
    });
    

    // Handler to serve index.html for all routes except existing ones
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
        // Send response to client so the page shows sucess alert and refreshes safely
        AsyncWebServerResponse *response = request->beginResponse(200, "text/plain", 
            success ? "Firmware update successful. Device will restart." : "Firmware update failed!"); 
        response->addHeader("Connection", "close");
        request->send(response);
        // Restart ESP32 if update is successful
        if(success) {
            delay(1000);
            ESP.restart(); 
        }
    }, [](AsyncWebServerRequest *request, String filename, size_t index, uint8_t *data, size_t len, bool final) {
        // Start firmware update if it's the first chunk
        if(!index) {
            Serial.println("Update Start");
            if(!Update.begin(UPDATE_SIZE_UNKNOWN, U_FLASH)) {
                Update.printError(Serial);
                return;
            }
        }
        // If the chunk is written successfully, continue writing the next chunk
        if(Update.write(data, len) != len) {
            Update.printError(Serial);
            return;
        }
        // If it's the last chunk, end the update
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

    // Serve statis files (JS, CSS, images) from /assets folder
    server.serveStatic("/assets", SPIFFS, "/assets");
    server.begin();
    webSocket.begin();
    webSocket.onEvent(webSocketEvent);
}

// OTA setup, no authentication for now
void setupOTA() {
    ArduinoOTA.setHostname(hostname);  // Use existing hostname
    // Handlers for OTA events
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
    
    ArduinoOTA.begin(); // Start OTA
    Serial.println("OTA ready");
}


void setupEthernet() {
    // WT32-ETH01 Default Pins
    #define ETH_CLK_MODE    ETH_CLOCK_GPIO0_IN  // ETH_CLOCK_GPIO0_IN / ETH_CLOCK_GPIO0_OUT / ETH_CLOCK_GPIO16_OUT / ETH_CLOCK_GPIO17_OUT
    #define ETH_POWER_PIN   16                   // Do not use it, it is for testing
    #define ETH_TYPE        ETH_PHY_LAN8720     // ETH_PHY_LAN8720 / ETH_PHY_TLK110 / ETH_PHY_RTL8201 / ETH_PHY_DP83848
    #define ETH_ADDR        1                    // I²C-address of Ethernet PHY (0 or 1 for LAN8720)
    #define ETH_MDC_PIN     23                   // I²C clock pin
    #define ETH_MDIO_PIN    18                   // I²C IO pin

    ETH.begin(ETH_ADDR, ETH_POWER_PIN, ETH_MDC_PIN, ETH_MDIO_PIN, ETH_TYPE, ETH_CLK_MODE);

    // Static IP Configuration - Optional (otherwise uses DHCP)
    ETH.config(IPAddress(169, 254, 1, 1),     // Device IP
               IPAddress(169, 254, 1, 1),      // Gateway (same as IP)
               IPAddress(255, 255, 255, 0),      // Subnet mask for link-local
               IPAddress(169, 254, 1, 1));     // DNS (same as IP)


    // Wait for connection
    while (!ETH.linkUp()) {
        Serial.print(".");
        delay(500);
    }

    Serial.println();
    Serial.print("Ethernet IP: ");
    Serial.println(ETH.localIP());

    // Does not work with a cross-over cable (direct connection to PC)
    // Hostname to connect using esp32-rockettester.local instead of IP
    // ETH.setHostname(hostname);
    // Serial.print("Hostname: ");
    // Serial.println(ETH.getHostname());

    // optional: mDNS, also does not work with cross-over cable. 
    // if (!MDNS.begin(hostname)) {
    //     Serial.println("Error setting up MDNS responder!");
    // } else {
    //     // Web server service
    //     MDNS.addService("http", "tcp", 80);
    //     // WebSocket service
    //     MDNS.addService("ws", "tcp", 81);
    //     Serial.println("mDNS responder started");
    // }

    
}

void setup() {
    Serial.begin(115200);
    Serial.println("Rocket Tester ESP32"); 

    setupPins();
    setupADC();
    setupSPIFFS();
    loadSensorConfig();
    // setupWiFi();
    setupEthernet();
    setupWebServices();
    setupOTA();


    // Sensor and WebSocket tasks on separate cores so they can run independently
    xTaskCreatePinnedToCore(
        sensorTask,
        "SensorTask",
        10000,
        NULL,
        7,  // High priority for sensor readings
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
    vTaskDelete(NULL); // No loop needed, tasks are running on separate cores
}