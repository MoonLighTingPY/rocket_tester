#include <Arduino.h>
#include <WebSocketsServer.h>
#include <WebServer.h>
#include <ADS1256.h>
#include <ADS1232.h>
#include <Adafruit_MAX31855.h>
#include <ArduinoJson.h>
#include <ESPAsyncWebServer.h>
#include "system_config.h"
#include "sensor_config.h"
#include "setup_functions.h"
#include "sensor_task.h"
#include "websocket_task.h"
#include "websocket_handler.h"
#include "ethernet_task.h"

// Task handles
TaskHandle_t sensorTaskHandle = NULL;
TaskHandle_t webSocketTaskHandle = NULL;
TaskHandle_t ethernetTaskHandle = NULL;

// Hardware instances
AsyncWebServer server(NetworkConfig::WEB_SERVER_PORT);
WebSocketsServer webSocket = WebSocketsServer(NetworkConfig::WEBSOCKET_PORT);

SPIClass ads1256_spi(HSPI); // or SPI2_HOST if using ESP-IDF defines

// ADC instances
ADS1256 adc1256(PinConfig::ADS1256_DRDY_PIN, PinConfig::ADS1256_RST_PIN, 0, PinConfig::ADS1256_CS_PIN, 2.4937, &ads1256_spi);
ADS1232 ads1232(PinConfig::ADS1232_POMN_PIN, PinConfig::ADS1232_SCLK_PIN, PinConfig::ADS1232_DOUT_PIN);

// MAX31855 thermocouple instances - create array for all possible thermocouples
Adafruit_MAX31855 thermocouples[TEMPERATURE_SENSOR_COUNT] = {
    Adafruit_MAX31855(PinConfig::MAX31855_SCLK_PIN, PinConfig::MAX31855_CS_PINS[0], PinConfig::MAX31855_MISO_PIN),
    Adafruit_MAX31855(PinConfig::MAX31855_SCLK_PIN, PinConfig::MAX31855_CS_PINS[1], PinConfig::MAX31855_MISO_PIN),
    Adafruit_MAX31855(PinConfig::MAX31855_SCLK_PIN, PinConfig::MAX31855_CS_PINS[2], PinConfig::MAX31855_MISO_PIN),
    Adafruit_MAX31855(PinConfig::MAX31855_SCLK_PIN, PinConfig::MAX31855_CS_PINS[3], PinConfig::MAX31855_MISO_PIN),
    Adafruit_MAX31855(PinConfig::MAX31855_SCLK_PIN, PinConfig::MAX31855_CS_PINS[4], PinConfig::MAX31855_MISO_PIN),
    Adafruit_MAX31855(PinConfig::MAX31855_SCLK_PIN, PinConfig::MAX31855_CS_PINS[5], PinConfig::MAX31855_MISO_PIN),
    Adafruit_MAX31855(PinConfig::MAX31855_SCLK_PIN, PinConfig::MAX31855_CS_PINS[6], PinConfig::MAX31855_MISO_PIN),
    Adafruit_MAX31855(PinConfig::MAX31855_SCLK_PIN, PinConfig::MAX31855_CS_PINS[7], PinConfig::MAX31855_MISO_PIN),
    Adafruit_MAX31855(PinConfig::MAX31855_SCLK_PIN, PinConfig::MAX31855_CS_PINS[8], PinConfig::MAX31855_MISO_PIN),
    Adafruit_MAX31855(PinConfig::MAX31855_SCLK_PIN, PinConfig::MAX31855_CS_PINS[9], PinConfig::MAX31855_MISO_PIN),
    Adafruit_MAX31855(PinConfig::MAX31855_SCLK_PIN, PinConfig::MAX31855_CS_PINS[10], PinConfig::MAX31855_MISO_PIN),
    Adafruit_MAX31855(PinConfig::MAX31855_SCLK_PIN, PinConfig::MAX31855_CS_PINS[11], PinConfig::MAX31855_MISO_PIN)};

// Interrupt handler
void IRAM_ATTR engineStartISR()
{
    systemState.engineStartTime = micros();
}

void setup()
{
    Serial.begin(115200);
    Serial.println("Rocket Tester Stand - ESP32-S3-ETH-PoE with Multi-ADC Support");

    // Set all CS pins HIGH before SPI/Ethernet init
    Setup::pins();

    // Initialize Ethernet FIRST
    if (Setup::ethernet())
    {
        // Now safe to init ADCs and other SPI devices
        Setup::adcs();
        Setup::spiffs();
        loadSensorConfig();
        Setup::webServices();
        Setup::ota();
        SensorTask::create(&sensorTaskHandle);
        WebSocketTask::create(&webSocketTaskHandle);
        EthernetTask::create(&ethernetTaskHandle);
    }
}

void loop()
{
    vTaskDelete(NULL);
}