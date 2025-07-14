#include "setup_functions.h"
#include "system_config.h"
#include "sensor_config.h"
#include <SPIFFS.h>
#include <ETH.h>
#include <ESPAsyncWebServer.h>
#include <WebSocketsServer.h>
#include <ArduinoOTA.h>
#include <Update.h>
#include <ADS1256.h>
#include <HX711.h>
#include <Adafruit_MAX31855.h>

extern AsyncWebServer server;
extern WebSocketsServer webSocket;
extern ADS1256 adc1256;
extern HX711 ads1232;
extern Adafruit_MAX31855 thermocouples[];
extern void webSocketEvent(uint8_t num, WStype_t type, uint8_t *payload, size_t length);
extern void engineStartISR();

void Setup::pins()
{
  pinMode(PinConfig::PYRO_PIN, INPUT_PULLDOWN);
  pinMode(PinConfig::ENGINE_OUT_PIN, OUTPUT);
  pinMode(PinConfig::ENGINE_IN_PIN, INPUT_PULLUP);
  digitalWrite(PinConfig::ENGINE_OUT_PIN, HIGH);
  attachInterrupt(digitalPinToInterrupt(PinConfig::ENGINE_IN_PIN), engineStartISR, FALLING);

  // ADS1232 control pins
  pinMode(PinConfig::ADS1232_POMN_PIN, OUTPUT);
  pinMode(PinConfig::ADS1232_SPEED_PIN, OUTPUT);
  pinMode(PinConfig::ADS1232_GAIN1_PIN, OUTPUT);
  pinMode(PinConfig::ADS1232_GAIN0_PIN, OUTPUT);

  // Set ADS1232 configuration
  digitalWrite(PinConfig::ADS1232_POMN_PIN, HIGH);  // Power on
  digitalWrite(PinConfig::ADS1232_SPEED_PIN, HIGH); // High speed
  digitalWrite(PinConfig::ADS1232_GAIN1_PIN, LOW);  // Gain configuration
  digitalWrite(PinConfig::ADS1232_GAIN0_PIN, HIGH); // Gain = 64

  // Initialize MAX31855 CS pins
  for (int i = 0; i < TEMPERATURE_SENSOR_COUNT; i++)
  {
    pinMode(PinConfig::MAX31855_CS_PINS[i], OUTPUT);
    digitalWrite(PinConfig::MAX31855_CS_PINS[i], HIGH);
  }
}

void Setup::adcs()
{
  Serial.println("Setting up ADCs");

  // Setup ADS1256 for pressure sensors
  Serial.println("Initializing ADS1256...");
  adc1256.InitializeADC();
  adc1256.setPGA(PGA_2);
  adc1256.setDRATE(DRATE_30000SPS);
  adc1256.sendDirectCommand(SELFCAL);
  delay(100);
  adc1256.setBuffer(BUFFER_ENABLED);
  Serial.println("ADS1256 initialized");

  // Setup ADS1232 for load cells
  Serial.println("Initializing ADS1232...");
  ads1232.begin(PinConfig::ADS1232_DOUT_PIN, PinConfig::ADS1232_SCLK_PIN);
  ads1232.set_scale();
  ads1232.tare(); // Reset the scale to 0
  Serial.println("ADS1232 initialized");

  // Setup MAX31855 thermocouples
  Serial.println("Initializing MAX31855 thermocouples...");
  for (int i = 0; i < TEMPERATURE_SENSOR_COUNT; i++)
  {
    if (sensorConfigs[i + 4].enabled) // Temperature sensors start at index 4
    {
      Serial.printf("Initializing thermocouple %d on CS pin %d\n", i, PinConfig::MAX31855_CS_PINS[i]);
    }
  }
  Serial.println("All ADCs initialized");
}

void Setup::spiffs()
{
  if (!SPIFFS.begin(true))
  {
    Serial.println("An Error has occurred while mounting SPIFFS");
    ESP.restart();
    return;
  }
  Serial.println("SPIFFS mounted successfully");
}

void Setup::webServices()
{
  DefaultHeaders::Instance().addHeader("Access-Control-Allow-Origin", "*");
  DefaultHeaders::Instance().addHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  DefaultHeaders::Instance().addHeader("Access-Control-Allow-Headers", "Content-Type");

  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request)
            { request->send(SPIFFS, "/index.html", "text/html"); });

  server.onNotFound([](AsyncWebServerRequest *request)
                    {
        if (request->method() == HTTP_OPTIONS) {
            request->send(200);
        } else {
            request->send(SPIFFS, "/index.html", "text/html");
        } });

  server.on("/update", HTTP_POST, [](AsyncWebServerRequest *request)
            {
        bool success = !Update.hasError();
        AsyncWebServerResponse *response = request->beginResponse(200, "text/plain", 
            success ? "Firmware update successful. Device will restart." : "Firmware update failed!"); 
        response->addHeader("Connection", "close");
        request->send(response);
        if(success) {
            delay(1000);
            ESP.restart(); 
        } }, [](AsyncWebServerRequest *request, String filename, size_t index, uint8_t *data, size_t len, bool final)
            {
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
        } });

  server.on("/updatefs", HTTP_POST, [](AsyncWebServerRequest *request)
            {
        bool success = !Update.hasError();
        AsyncWebServerResponse *response = request->beginResponse(200, "text/plain", 
            success ? "SPIFFS update successful. Device will restart." : "SPIFFS update failed!");
        response->addHeader("Connection", "close");
        request->send(response);
        if(success) {
            delay(1000);
            ESP.restart();
        } }, [](AsyncWebServerRequest *request, String filename, size_t index, uint8_t *data, size_t len, bool final)
            {
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
        } });

  server.serveStatic("/assets", SPIFFS, "/assets");
  server.begin();
  webSocket.begin();
  webSocket.onEvent(webSocketEvent);
}

void Setup::ota()
{
  ArduinoOTA.setHostname(NetworkConfig::hostname);

  ArduinoOTA.onStart([]()
                     {
        String type;
        if (ArduinoOTA.getCommand() == U_FLASH) {
            type = "sketch";
        } else {
            type = "filesystem";
            SPIFFS.end();
        }
        Serial.println("Start updating " + type); });

  ArduinoOTA.onEnd([]()
                   { Serial.println("\nEnd"); });

  ArduinoOTA.onProgress([](unsigned int progress, unsigned int total)
                        { Serial.printf("Progress: %u%%\r", (progress / (total / 100))); });

  ArduinoOTA.onError([](ota_error_t error)
                     {
        Serial.printf("Error[%u]: ", error);
        if (error == OTA_AUTH_ERROR) Serial.println("Auth Failed");
        else if (error == OTA_BEGIN_ERROR) Serial.println("Begin Failed");
        else if (error == OTA_CONNECT_ERROR) Serial.println("Connect Failed");
        else if (error == OTA_RECEIVE_ERROR) Serial.println("Receive Failed");
        else if (error == OTA_END_ERROR) Serial.println("End Failed"); });

  ArduinoOTA.begin();
  Serial.println("OTA ready");
}

void Setup::ethernet()
{
  // ESP32-S3-ETH-PoE specific Ethernet setup
  // For ESP32-S3-ETH-PoE boards, the pins are usually fixed in hardware

  Serial.println("Initializing Ethernet...");

  // For ESP32-S3-ETH-PoE, use the standard pin configuration
  // Most ESP32-S3-ETH-PoE boards use these default pins:
  // PHY Address: 1 (or 0, depends on board)
  // Power pin: Usually not needed (-1) or specific to board
  // MDC: GPIO 23 (default)
  // MDIO: GPIO 18 (default)

  // Try PHY address 1 first (common for ESP32-S3-ETH-PoE)
  if (!ETH.begin(1, -1, 23, 18))
  {
    Serial.println("ETH.begin() with PHY address 1 failed, trying PHY address 0...");
    // If that fails, try PHY address 0
    if (!ETH.begin(0, -1, 23, 18))
    {
      Serial.println("ETH.begin() failed with both PHY addresses");
      return;
    }
  }

  ETH.config(NetworkConfig::deviceIP, NetworkConfig::gateway, NetworkConfig::subnet, NetworkConfig::dns);

  // Wait for link to come up
  Serial.print("Waiting for Ethernet link");
  unsigned long timeout = millis() + 10000; // 10 second timeout
  while (!ETH.linkUp() && millis() < timeout)
  {
    Serial.print(".");
    delay(500);
  }

  if (ETH.linkUp())
  {
    Serial.println();
    Serial.print("Ethernet IP: ");
    Serial.println(ETH.localIP());
    Serial.println("Ethernet PHY Link status: UP");

    ETH.setHostname(NetworkConfig::hostname);
    Serial.print("Hostname: ");
    Serial.println(ETH.getHostname());
  }
  else
  {
    Serial.println();
    Serial.println("Failed to establish Ethernet link!");
    Serial.println("Check your connections and board configuration");
    Serial.println("Note: Make sure you're using an ESP32-S3-ETH-PoE board with proper Ethernet hardware");
  }
}