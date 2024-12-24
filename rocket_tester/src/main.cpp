#include <Arduino.h>
#include <WiFi.h>
#include <SPIFFS.h>
#include <ESPAsyncWebServer.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_ADS1X15.h>
#include "secret.h"
#include <CircularBuffer.hpp>
#include <ESPmDNS.h>

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
struct SensorData {
    float loadCell;
    float pressure1;
    float pressure2;
    float temperature;
    unsigned long readingsTimestamp;
    unsigned long ingitionTimestamp;
    unsigned long engineTimestamp;
};

// Create a circular buffer to store 2000 readings
#define BUFFER_SIZE 2000
CircularBuffer<SensorData, BUFFER_SIZE> dataBuffer;

// Task handles
TaskHandle_t sensorTaskHandle = NULL;
TaskHandle_t webSocketTaskHandle = NULL;

// Mutex for buffer access
portMUX_TYPE bufferMux = portMUX_INITIALIZER_UNLOCKED;

void IRAM_ATTR engineStartISR() {
    if (ingitedWire && !engineStarted) {
        if (digitalRead(ENGINE_IN_PIN) == LOW) {
            engineStartTime = micros();
            engineStarted = true;
        }
    }
}

// Function to clear the buffer
void clearBuffer() {
    portENTER_CRITICAL(&bufferMux);
    dataBuffer.clear();
    portEXIT_CRITICAL(&bufferMux);
}

// High-speed sensor reading task
void sensorTask(void *parameter) {
    SensorData data;
    TickType_t xLastWakeTime = xTaskGetTickCount();
    // Use exact frequency for ADS1115 max rate
    const TickType_t xFrequency = pdMS_TO_TICKS(1); // 860Hz max
    
    while (true) {
        // Precise timing for sensor reads
        vTaskDelayUntil(&xLastWakeTime, xFrequency);
        
        if (isReading) {
            portENTER_CRITICAL(&bufferMux);
            uint32_t currentTime = micros();
            data.readingsTimestamp = currentTime - readingsStartTime;
            data.ingitionTimestamp = ingitedWire ? (currentTime - ingitionStartTime) : 0;
            
            // Read sensors here with precise timing
            data.loadCell = dataCounter++;
            data.pressure1 = random(0, 100);
            data.pressure2 = random(0, 100); 
            data.temperature = dataCounter;
            
            if (!dataBuffer.isFull()) {
                dataBuffer.push(data);
            }
            portEXIT_CRITICAL(&bufferMux);
        }
    }
}

// WebSocket communication task
// WebSocket communication task
void webSocketTask(void *parameter) {
    const size_t BATCH_SIZE = 20;
    TickType_t xLastWakeTime = xTaskGetTickCount();
    const TickType_t xFrequency = pdMS_TO_TICKS(20); // Fixed 50Hz rate for websocket updates
    
    while (true) {
        // Use vTaskDelayUntil for precise timing
        vTaskDelayUntil(&xLastWakeTime, xFrequency);
        
        webSocket.loop();
        
        if (isReading && !dataBuffer.isEmpty()) {
            JsonDocument doc;
            doc.clear();
            JsonArray array = doc["data"].to<JsonArray>();
            
            // Use critical section for buffer access
            portENTER_CRITICAL(&bufferMux);
            int count = 0;
            while (!dataBuffer.isEmpty() && count < BATCH_SIZE) {
                SensorData data = dataBuffer.shift();
                JsonObject reading = array.add<JsonObject>();
                
                // Add high-precision timestamps
                reading["t1"] = data.readingsTimestamp;
                reading["t2"] = data.ingitionTimestamp;
                reading["l"] = data.loadCell;
                reading["p1"] = data.pressure1; 
                reading["p2"] = data.pressure2;
                reading["tp"] = data.temperature;
                count++;
            }
            portEXIT_CRITICAL(&bufferMux);

            if (count > 0) {
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
    }
}

void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
    switch(type) {
        case WStype_CONNECTED:
            Serial.printf("WebSocket client #%u connected\n", num);
            break;
            
        case WStype_TEXT: {
            String message = String((char*)payload);
            Serial.printf("Received message: %s\n", message.c_str());
            
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

void setup() {
    Serial.begin(115200);
    
    if(!SPIFFS.begin(true)) {
        Serial.println("SPIFFS Mount Failed");
        return;
    }

    pinMode(ENGINE_OUT_PIN, OUTPUT);
    pinMode(ENGINE_IN_PIN, INPUT_PULLUP);
    pinMode(PYRO_PIN, OUTPUT);
    
    digitalWrite(ENGINE_OUT_PIN, HIGH);
    digitalWrite(PYRO_PIN, LOW);
    
    attachInterrupt(digitalPinToInterrupt(ENGINE_IN_PIN), engineStartISR, FALLING);

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

    server.on("/", HTTP_GET, [](AsyncWebServerRequest *request){
        request->send(SPIFFS, "/index.html", "text/html");
    });
    server.serveStatic("/assets", SPIFFS, "/assets");
    server.begin();

    webSocket.begin();
    webSocket.onEvent(webSocketEvent);

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