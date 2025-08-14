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
#include "max6675.h"

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
extern Adafruit_MAX31855 thermocouples[];
extern MAX6675 max6675_sensors[];
extern void webSocketEvent(uint8_t num, WStype_t type, uint8_t *payload, size_t length);
extern void engineStartISR();

// Helper function to set multiplexer channel
void setMultiplexerChannel(uint8_t channel)
{
    digitalWrite(PinConfig::MUX_S0_PIN, (channel & 0x01) ? HIGH : LOW);
    digitalWrite(PinConfig::MUX_S1_PIN, (channel & 0x02) ? HIGH : LOW);
    digitalWrite(PinConfig::MUX_S2_PIN, (channel & 0x04) ? HIGH : LOW);
    delayMicroseconds(10); // Small delay for multiplexer settling
}

void Setup::pins()
{
    // Configure GPIO pins for SPI communication FIRST
    pinMode(PinConfig::ADS1256_SCLK_PIN, OUTPUT);  // GPIO 36 as OUTPUT
    pinMode(PinConfig::ADS1256_MISO_PIN, INPUT);   // GPIO 37 as INPUT
    pinMode(PinConfig::ADS1256_MOSI_PIN, OUTPUT);  // GPIO 35 as OUTPUT
    pinMode(PinConfig::ADS1256_CS_PIN, OUTPUT);    // GPIO 40 as OUTPUT
    digitalWrite(PinConfig::ADS1256_CS_PIN, HIGH); // Deselect ADS1256

    pinMode(PinConfig::PYRO_PIN, INPUT);
    pinMode(PinConfig::ENGINE_OUT_PIN, OUTPUT);
    pinMode(PinConfig::ENGINE_IN_PIN, INPUT_PULLUP);
    digitalWrite(PinConfig::ENGINE_OUT_PIN, HIGH);
    attachInterrupt(digitalPinToInterrupt(PinConfig::ENGINE_IN_PIN), engineStartISR, FALLING);

    // Initialize multiplexer control pins
    pinMode(PinConfig::MUX_S0_PIN, OUTPUT);
    pinMode(PinConfig::MUX_S1_PIN, OUTPUT);
    pinMode(PinConfig::MUX_S2_PIN, OUTPUT);
    pinMode(PinConfig::MUX_SIG_PIN, OUTPUT);

    // Set all multiplexer pins to ensure no MAX31855 is selected initially
    digitalWrite(PinConfig::MUX_S0_PIN, LOW);
    digitalWrite(PinConfig::MUX_S1_PIN, LOW);
    digitalWrite(PinConfig::MUX_S2_PIN, LOW);
    digitalWrite(PinConfig::MUX_SIG_PIN, HIGH); // Deselect all (CS high)
}

void Setup::adcs()
{
    Serial.println("Setting up ADCs");
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