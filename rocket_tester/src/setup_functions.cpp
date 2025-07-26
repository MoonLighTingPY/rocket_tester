#include "setup_functions.h"
#include "system_config.h"
#include "sensor_config.h"
#include <SPIFFS.h>
#include <EthernetESP32.h>
#include <ESPmDNS.h>
#include <ESPAsyncWebServer.h>
#include <WebSocketsServer.h>
#include <ArduinoOTA.h>
#include <Update.h>
#include <ADS1256.h>
#include <ADS1232.h>
#include <Adafruit_MAX31855.h>
#include <SPI.h>
#include "driver/spi_common.h"

#define W5500_CS 14
#define W5500_RST 9
#define W5500_INT 10
#define W5500_MISO 12
#define W5500_MOSI 11
#define W5500_SCK 13

W5500Driver driver(W5500_CS, W5500_INT, W5500_RST);

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

// Modified ADS1256 initialization to use separate SPI bus
void Setup::adcs()
{
  Serial.println("Setting up ADCs");

  // Setup ADS1256 for pressure sensors - USE SEPARATE SPI BUS
  Serial.println("Initializing ADS1256...");

  // Initialize separate SPI bus for ADS1256 if needed
  // OR use software SPI for ADS1256 to avoid conflicts
  SPIClass *ads1256_spi = new SPIClass(SPI2_HOST); // Use different SPI bus
  ads1256_spi->begin(PinConfig::ADS1256_SCLK_PIN, PinConfig::ADS1256_MISO_PIN, PinConfig::ADS1256_MOSI_PIN, PinConfig::ADS1256_CS_PIN);

  adc1256.InitializeADC();
  adc1256.setPGA(PGA_2);
  adc1256.setDRATE(DRATE_30000SPS);
  adc1256.sendDirectCommand(SELFCAL);
  delay(100);
  adc1256.setBuffer(BUFFER_ENABLED);
  Serial.println("ADS1256 initialized");

  // Setup ADS1232 for load cell (uses separate GPIO pins - OK)
  Serial.println("Initializing ADS1232...");
  ads1232.power_up();
  delay(100);

  Serial.println("Performing ADS1232 tare...");
  long tare_offset = ads1232.raw_read(10);
  ads1232.set_offset(tare_offset);
  ads1232.set_scale(1.0f);
  Serial.printf("ADS1232 initialized - Tare offset: %ld\n", tare_offset);

  // Setup MAX31855 thermocouples (use separate SPI or bit-bang)
  Serial.println("Initializing MAX31855 thermocouples...");
  for (int i = 0; i < TEMPERATURE_SENSOR_COUNT; i++)
  {
    if (sensorConfigs[i + 3].enabled)
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

bool Setup::ethernet()
{
  Serial.println("Initializing Ethernet...");

  // Initialize SPI for W5500 ONLY
  SPI.begin(W5500_SCK, W5500_MISO, W5500_MOSI, W5500_CS);

  // Configure W5500 pins
  pinMode(W5500_RST, OUTPUT);
  pinMode(W5500_CS, OUTPUT);
  pinMode(W5500_INT, INPUT);

  // Reset W5500
  digitalWrite(W5500_RST, LOW);
  delay(10);
  digitalWrite(W5500_RST, HIGH);
  delay(100);

  Ethernet.init(driver);

  byte mac[] = {0xDE, 0xAD, 0xBE, 0xEF, 0xFE, 0xED};
  IPAddress ip(169, 254, 1, 1);
  IPAddress gateway(169, 254, 1, 1);
  IPAddress subnet(255, 255, 0, 0);

  Serial.println("Initialize Ethernet with static IP:");
  Ethernet.begin(mac, ip, gateway, subnet);

  // Wait for link up
  int timeout = 0;
  while (Ethernet.linkStatus() == LinkOFF && timeout < 50)
  {
    delay(100);
    timeout++;
  }

  if (Ethernet.linkStatus() == LinkOFF)
  {
    Serial.println("Ethernet link failed!");
    return false;
  }

  Serial.print("  Static IP: ");
  Serial.println(Ethernet.localIP());
  Serial.print("  Link Status: ");
  Serial.println(Ethernet.linkStatus() == LinkON ? "UP" : "DOWN");

  if (MDNS.begin("esp32s3-rockettester"))
  {
    Serial.println("MDNS responder started");
  }

  return true;
}
