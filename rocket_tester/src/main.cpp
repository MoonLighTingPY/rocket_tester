#include <Arduino.h>
#include <WiFi.h>
#include <SPIFFS.h>
#include <ESPAsyncWebServer.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_ADS1X15.h>
#include "secret.h"
#include <CircularBuffer.h>
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
bool testStarted = false;
bool engineStarted = false;
unsigned long testStartTime = 0;
unsigned long readingsStartTime = 0;
unsigned long engineStartTime = 0;
unsigned long dataCounter = 0;
unsigned long sampleCounter = 0;  // Counts samples from start of readings
const float SAMPLE_PERIOD = 1.0/860.0;  // ~1.16ms per sample at 860Hz
struct SensorData {
    float loadCell;
    float pressure1;
    float pressure2;
    float temperature;
    unsigned long timestamp;
};

// Create a circular buffer to store 5000 readings
#define BUFFER_SIZE 2000
CircularBuffer<SensorData, BUFFER_SIZE> dataBuffer;

// Task handles
TaskHandle_t sensorTaskHandle = NULL;
TaskHandle_t webSocketTaskHandle = NULL;

// Mutex for buffer access
portMUX_TYPE bufferMux = portMUX_INITIALIZER_UNLOCKED;

void IRAM_ATTR engineStartISR() {
    if (testStarted && !engineStarted) {
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
    const TickType_t xFrequency = pdMS_TO_TICKS(1); // ~860Hz max for ADS1115

    while (true) {
        if (isReading) {
            data.timestamp = sampleCounter;  // Just store the counter
            data.loadCell = dataCounter++;   // Simulated sensor data
            data.pressure1 = random(0, 100);    // Simulated sensor data
            data.pressure2 = random(0, 100); // Simulated sensor data
            data.temperature = dataCounter;  // Simulated sensor data
            sampleCounter++;

            portENTER_CRITICAL(&bufferMux);
            if (!dataBuffer.isFull()) {
                dataBuffer.push(data);
            }
            portEXIT_CRITICAL(&bufferMux);
        }
        vTaskDelayUntil(&xLastWakeTime, xFrequency);
    }
}

// WebSocket communication task
void webSocketTask(void *parameter) {
    while (true) {
        webSocket.loop();
        
        if (isReading && !dataBuffer.isEmpty()) {
            DynamicJsonDocument doc(2000);
            JsonArray array = doc["data"].to<JsonArray>();
            
            portENTER_CRITICAL(&bufferMux);
            int count = 0;
            while (!dataBuffer.isEmpty() && count < 20) {
                SensorData data = dataBuffer.shift();
                JsonObject reading = array.add<JsonObject>();
                reading["t"] = data.timestamp;
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

        // Imitate engine start 100 milliseconds after test start
        if (testStarted && !engineStarted && (micros() - testStartTime >= 100000)) {
            engineStartTime = micros();
            engineStarted = true;
        }

        delay(20); // 50Hz WebSocket updates
    }
}

void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
    switch(type) {
        case WStype_CONNECTED:
            Serial.printf("WebSocket client #%u connected\n", num);
            break;
            
        case WStype_TEXT: {
            String message = String((char*)payload);
            
            if (message == "start_readings") {
                isReading = true;
                dataCounter = 0;
                sampleCounter = 0;
                readingsStartTime = micros();
            }
            else if (message == "start_test") {
                testStarted = true;
                testStartTime = micros();
                engineStarted = false;
                
                digitalWrite(PYRO_PIN, HIGH);

            }
            else if (message == "end_test") {
                isReading = false;
                testStarted = false;
                engineStarted = false;
                dataCounter = 0;
                sampleCounter = 0;
                clearBuffer(); // Clear the buffer when stopping the readings
            }

            if (engineStarted && !testStarted) {
                DynamicJsonDocument doc(200);
                doc["type"] = "time_difference";
                doc["value"] = engineStartTime - testStartTime;
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
    }

    server.on("/", HTTP_GET, [](AsyncWebServerRequest *request){
        request->send(SPIFFS, "/index.html", "text/html");
    });
    server.begin();

    webSocket.begin();
    webSocket.onEvent(webSocketEvent);

    // Create tasks on different cores
    xTaskCreatePinnedToCore(
        sensorTask,
        "SensorTask",
        10000,
        NULL,
        2,  // Higher priority
        &sensorTaskHandle,
        0   // Core 0
    );

    xTaskCreatePinnedToCore(
        webSocketTask,
        "WebSocketTask",
        10000,
        NULL,
        1,  // Lower priority
        &webSocketTaskHandle,
        1   // Core 1
    );
}

void loop() {
    vTaskDelete(NULL); // Delete setup and loop task
}