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

// External references
extern AsyncWebServer server;
extern WebSocketsServer webSocket;
extern ADS1256 adc;
extern void webSocketEvent(uint8_t num, WStype_t type, uint8_t *payload, size_t length);
extern void engineStartISR();

void Setup::pins()
{
  pinMode(PinConfig::PYRO_PIN, INPUT_PULLDOWN);
  pinMode(PinConfig::ENGINE_OUT_PIN, OUTPUT);
  pinMode(PinConfig::ENGINE_IN_PIN, INPUT_PULLUP);
  digitalWrite(PinConfig::ENGINE_OUT_PIN, HIGH);
  attachInterrupt(digitalPinToInterrupt(PinConfig::ENGINE_IN_PIN), engineStartISR, FALLING);
}

void Setup::adc()
{
  Serial.println("Setting up ADC");
  ::adc.InitializeADC();
  Serial.println("ADC initialized");
  ::adc.setPGA(PGA_2);
  ::adc.setDRATE(DRATE_30000SPS);
  ::adc.sendDirectCommand(SELFCAL);
  delay(100);

  ::adc.setBuffer(BUFFER_ENABLED);

  for (uint8_t i = 0; i < SENSOR_COUNT; i++)
  {
    if (sensorConfigs[i].enabled)
    {
      uint8_t mux = SING_0 + sensorConfigs[i].adcChannel;
      ::adc.setMUX(mux);
      delayMicroseconds(100);
    }
  }

  for (uint8_t i = 0; i < SENSOR_COUNT; i++)
  {
    if (sensorConfigs[i].enabled)
    {
      uint8_t mux = SING_0 + sensorConfigs[i].adcChannel;
      ::adc.setMUX(mux);
      break;
    }
  }
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
#define ETH_CLK_MODE ETH_CLOCK_GPIO0_IN
#define ETH_POWER_PIN 16
#define ETH_TYPE ETH_PHY_LAN8720
#define ETH_ADDR 1
#define ETH_MDC_PIN 23
#define ETH_MDIO_PIN 18

  ETH.begin(ETH_ADDR, ETH_POWER_PIN, ETH_MDC_PIN, ETH_MDIO_PIN, ETH_TYPE, ETH_CLK_MODE);
  ETH.config(NetworkConfig::deviceIP, NetworkConfig::gateway, NetworkConfig::subnet, NetworkConfig::dns);

  while (!ETH.linkUp())
  {
    Serial.print(".");
    delay(500);
  }

  Serial.println();
  Serial.print("Ethernet IP: ");
  Serial.println(ETH.localIP());
  Serial.println("Ethernet PHY Link status: " + String(ETH.linkUp() ? "UP" : "DOWN"));

  ETH.setHostname(NetworkConfig::hostname);
  Serial.print("Hostname: ");
  Serial.println(ETH.getHostname());
}