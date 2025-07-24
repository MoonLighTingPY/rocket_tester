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
#include <ADS1232.h>
#include <Adafruit_MAX31855.h>

extern AsyncWebServer server;
extern WebSocketsServer webSocket;
extern ADS1256 adc1256;
extern ADS1232 ads1232;
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

  // Setup ADS1232 for load cell
  Serial.println("Initializing ADS1232...");
  ads1232.power_up();
  delay(100);

  // Perform initial calibration/tare
  Serial.println("Performing ADS1232 tare...");
  long tare_offset = ads1232.raw_read(10); // Average 10 readings for tare
  ads1232.set_offset(tare_offset);
  ads1232.set_scale(1.0f); // Default scale, can be calibrated later
  Serial.printf("ADS1232 initialized - Tare offset: %ld\n", tare_offset);

  // Setup MAX31855 thermocouples
  Serial.println("Initializing MAX31855 thermocouples...");
  for (int i = 0; i < TEMPERATURE_SENSOR_COUNT; i++)
  {
    if (sensorConfigs[i + 3].enabled) // Temperature sensors start at index 3 (0=load, 1-2=pressure, 3+=temperature)
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
  Serial.println("Initializing Ethernet...");

  // Use correct pins for ESP32-S3-ETH module (from your documentation)
  const int ETH_MDC = 23;
  const int ETH_MDIO = 18;
  const int ETH_POWER = -1; // Not used

  // Use correct enum types for ESP32 Arduino core
  eth_phy_type_t phyType = ETH_PHY_LAN8720;
  eth_clock_mode_t clkMode = ETH_CLOCK_GPIO17_OUT;

  // Try DHCP first
  if (!ETH.begin(0, ETH_POWER, ETH_MDC, ETH_MDIO, phyType, clkMode))
  {
    Serial.println("ETH.begin() with DHCP failed, trying static IP...");

    // Fallback to static IP
    if (!ETH.begin(0, ETH_POWER, ETH_MDC, ETH_MDIO, phyType, clkMode))
    {
      Serial.println("ETH.begin() failed with both DHCP and static IP");
      return;
    }
    ETH.config(NetworkConfig::deviceIP, NetworkConfig::gateway, NetworkConfig::subnet, NetworkConfig::dns);
  }

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