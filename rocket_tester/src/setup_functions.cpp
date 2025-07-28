// Updated setup_functions.cpp with CS controller integration

#include "setup_functions.h"
#include "system_config.h"
#include "sensor_config.h"
#include "cs_controller.h"
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

#define W5500_CS 14
#define W5500_RST 9
#define W5500_INT 10
#define W5500_MISO 12
#define W5500_MOSI 11
#define W5500_SCK 13

W5500Driver driver(W5500_CS, W5500_INT, W5500_RST);

extern AsyncWebServer server;
extern WebSocketsServer webSocket;
extern SPIClass ads1256_spi;
extern ADS1256 adc1256;
extern ADS1232 ads1232;
extern Adafruit_MAX31855 thermocouple; // Single instance now
extern CSController csController;
extern HardwareSerial csSerial;
extern void webSocketEvent(uint8_t num, WStype_t type, uint8_t *payload, size_t length);
extern void engineStartISR();

void Setup::pins()
{
  pinMode(PinConfig::PYRO_PIN, INPUT_PULLDOWN);
  pinMode(PinConfig::ENGINE_OUT_PIN, OUTPUT);
  pinMode(PinConfig::ENGINE_IN_PIN, INPUT_PULLUP);
  digitalWrite(PinConfig::ENGINE_OUT_PIN, HIGH);
  attachInterrupt(digitalPinToInterrupt(PinConfig::ENGINE_IN_PIN), engineStartISR, FALLING);

  // No need to initialize individual MAX31855 CS pins - handled by Arduino Pro Micro
  Serial.println("GPIO pins initialized (CS pins handled by Arduino Pro Micro)");
}

void Setup::initCSController()
{
  Serial.println("Initializing CS Controller...");

  // Initialize the serial connection to Arduino Pro Micro
  csSerial.begin(115200, SERIAL_8N1, PinConfig::CS_CONTROLLER_RX, PinConfig::CS_CONTROLLER_TX);

  // Give Arduino time to initialize
  delay(500);

  // Initialize CS controller (no response expected)
  csController.begin();
  Serial.println("CS Controller initialized successfully");

  // Test all CS channels (just send commands, no feedback)
  Serial.println("Testing CS channels...");
  for (int i = 0; i < TEMPERATURE_SENSOR_COUNT; i++)
  {
    csController.selectCS(i);
    delay(50); // Give time for Arduino to process
    csController.deselectAll();
    delay(50);
  }
  Serial.println("CS Controller test complete");
}

void Setup::adcs()
{
  Serial.println("Setting up ADCs");

  // Initialize ADS1256 SPI
  ads1256_spi.begin(
      PinConfig::ADS1256_SCLK_PIN,
      PinConfig::ADS1256_MISO_PIN,
      PinConfig::ADS1256_MOSI_PIN,
      PinConfig::ADS1256_CS_PIN);

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

  // Setup MAX31855 thermocouples - now using CS controller
  Serial.println("Initializing MAX31855 with CS controller...");

  // Test each enabled thermocouple
  for (int i = 0; i < TEMPERATURE_SENSOR_COUNT; i++)
  {
    if (sensorConfigs[i + 3].enabled) // Temperature sensors start at index 3
    {
      Serial.printf("Testing thermocouple %d...", i);

      // Select CS for this thermocouple
      if (csController.selectCS(i))
      {
        delay(10); // Let CS settle

        // Try to read temperature
        double temp = thermocouple.readCelsius();
        uint8_t error = thermocouple.readError(); // If available in your library
        Serial.printf("Raw error flags: 0x%02X\n", error);
        csController.deselectAll(); // Always deselect after reading

        if (!isnan(temp))
        {
          Serial.printf(" OK (%.2f°C)\n", temp);
        }
        else
        {
          Serial.printf(" FAILED (NaN reading)\n");
        }
      }
      else
      {
        Serial.printf(" FAILED (CS selection failed)\n");
      }

      delay(50); // Small delay between tests
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

  SPI.begin(W5500_SCK, W5500_MISO, W5500_MOSI, W5500_CS);

  Ethernet.init(driver);

  byte mac[] = {0xDE, 0xAD, 0xBE, 0xEF, 0xFE, 0xED};
  IPAddress ip(169, 254, 1, 1);
  IPAddress gateway(169, 254, 1, 1);
  IPAddress subnet(255, 255, 0, 0);

  Serial.println("Initialize Ethernet with static IP:");
  Ethernet.begin(mac, ip, gateway, subnet);

  Serial.print("  Static IP: ");
  Serial.println(Ethernet.localIP());
  delay(2000);

  if (MDNS.begin("esp32-rockettester"))
  {
    Serial.println("MDNS responder started");
  }
  return true;
}