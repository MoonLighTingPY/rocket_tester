#include <Arduino.h>
#include <WiFi.h>
#include <SPIFFS.h>
#include <ESPAsyncWebServer.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_ADS1X15.h>
#include "secret.h"

// Network credentials (secret.h)
const char* ssid = WIFI_SSID;
const char* password = WIFI_PASS;

// Web server and WebSocket setup
AsyncWebServer server(80);
WebSocketsServer webSocket = WebSocketsServer(81);

// ADS1115 setup
Adafruit_ADS1115 ads;
const uint8_t ADS_I2C_ADDRESS = 0x48;

// Pin definitions
const int ENGINE_OUT_PIN = 26;  // Wire detection output
const int ENGINE_IN_PIN = 27;   // Wire detection input
const int PYRO_PIN = 25;        // Pyro charge ignition

// Global variables
bool isReading = false;
bool testStarted = false;
bool engineStarted = false;
unsigned long testStartTime = 0;
unsigned long engineStartTime = 0;

// Task handle
TaskHandle_t sensorTaskHandle = NULL;

// Sensor data structure
struct SensorData {
    float loadCell;    // A0
    float pressure1;   // A1
    float pressure2;   // A2
    float temperature; // A3
    unsigned long timestamp;
};

// Engine start detection ISR
void IRAM_ATTR engineStartISR() {
    if (testStarted && !engineStarted) {
        if (digitalRead(ENGINE_IN_PIN) == LOW) {
            engineStartTime = millis();
            engineStarted = true;
        }
    }
}

void setupADS1115() {
    if (!ads.begin(ADS_I2C_ADDRESS)) {
        Serial.println("Failed to initialize ADS1115!");
        return;
    }
    ads.setGain(GAIN_ONE);
    ads.setDataRate(RATE_ADS1115_860SPS);
}

void sensorTask(void *parameter) {
    SensorData data;
    TickType_t xLastWakeTime = xTaskGetTickCount();
    const TickType_t xFrequency = pdMS_TO_TICKS(2); // ~500Hz sampling

    while (true) {
        if (isReading) {
            data.timestamp = millis();
            
            // Read all sensors
            data.loadCell = ads.computeVolts(ads.readADC_SingleEnded(0));
            data.pressure1 = ads.computeVolts(ads.readADC_SingleEnded(1));
            data.pressure2 = ads.computeVolts(ads.readADC_SingleEnded(2));
            data.temperature = ads.computeVolts(ads.readADC_SingleEnded(3));

            // Convert sensor readings
            data.loadCell = map(data.loadCell * 1000, 0, 3300, 0, 1000); // Map to kg
            data.pressure1 = map(data.pressure1 * 1000, 400, 2000, 0, 1000); // Map 4-20mA to bar
            data.pressure2 = map(data.pressure2 * 1000, 400, 2000, 0, 1000); // Map 4-20mA to bar

            // Send data via WebSocket
            StaticJsonDocument<200> doc;
            doc["type"] = "test_data";
            doc["load"] = data.loadCell;
            doc["pressure1"] = data.pressure1;
            doc["pressure2"] = data.pressure2;
            doc["temp"] = data.temperature;
            doc["timestamp"] = data.timestamp;

            String jsonString;
            serializeJson(doc, jsonString);
            webSocket.broadcastTXT(jsonString);
        }
        vTaskDelayUntil(&xLastWakeTime, xFrequency);
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
            }
            else if (message == "start_test") {
                testStarted = true;
                testStartTime = millis();
                engineStarted = false;
                
                // Trigger pyro charge
                digitalWrite(PYRO_PIN, HIGH);
                delay(100);
                digitalWrite(PYRO_PIN, LOW);
            }
            else if (message == "end_test") {
                isReading = false;
                testStarted = false;
                engineStarted = false;
            }

            // Send engine start time difference if detected
            if (engineStarted) {
                StaticJsonDocument<100> doc;
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
    
    // Initialize SPIFFS
    if(!SPIFFS.begin(true)) {
        Serial.println("SPIFFS Mount Failed");
        return;
    }

    // Setup GPIO pins
    pinMode(ENGINE_OUT_PIN, OUTPUT);
    pinMode(ENGINE_IN_PIN, INPUT_PULLUP);
    pinMode(PYRO_PIN, OUTPUT);
    
    digitalWrite(ENGINE_OUT_PIN, HIGH);
    digitalWrite(PYRO_PIN, LOW);
    
    // Attach engine start detection interrupt
    attachInterrupt(digitalPinToInterrupt(ENGINE_IN_PIN), engineStartISR, FALLING);

    // Initialize I2C and ADS1115
    Wire.begin();
    setupADS1115();

    // Connect to WiFi
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
        delay(1000);
        Serial.println("Connecting to WiFi...");
    }
    Serial.println(WiFi.localIP());

    // Setup web server
    server.on("/", HTTP_GET, [](AsyncWebServerRequest *request){
        request->send(SPIFFS, "/index.html", "text/html");
    });
    server.begin();

    // Start WebSocket server
    webSocket.begin();
    webSocket.onEvent(webSocketEvent);

    // Create sensor reading task
    xTaskCreatePinnedToCore(
        sensorTask,
        "SensorTask",
        10000,
        NULL,
        1,
        &sensorTaskHandle,
        0
    );
}

void loop() {
    webSocket.loop();
}