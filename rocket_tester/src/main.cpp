// Modified main.cpp with CS controller integration

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
#include "cs_controller.h" // Add CS controller

// Task handles
TaskHandle_t sensorTaskHandle = NULL;
TaskHandle_t webSocketTaskHandle = NULL;
TaskHandle_t ethernetTaskHandle = NULL;

// Hardware instances
AsyncWebServer server(NetworkConfig::WEB_SERVER_PORT);
WebSocketsServer webSocket = WebSocketsServer(NetworkConfig::WEBSOCKET_PORT);
SPIClass ads1256_spi(HSPI);

// ADC instances
ADS1256 adc1256(PinConfig::ADS1256_DRDY_PIN, PinConfig::ADS1256_RST_PIN, 0, PinConfig::ADS1256_CS_PIN, 2.4937, &ads1256_spi);
ADS1232 ads1232(PinConfig::ADS1232_PDMN_PIN, PinConfig::ADS1232_SCLK_PIN, PinConfig::ADS1232_DOUT_PIN);

// CS Controller instance - using Serial1 (UART1)
HardwareSerial csSerial(1); // UART1
CSController csController(&csSerial);

// MAX31855 thermocouple instances - we'll create these dynamically or use a single instance
// Since we're multiplexing CS, we only need one MAX31855 instance
Adafruit_MAX31855 thermocouple(PinConfig::MAX31855_SCLK_PIN, -1, PinConfig::MAX31855_MISO_PIN); // CS pin will be handled by Arduino

// Interrupt handler
void IRAM_ATTR engineStartISR()
{
    systemState.engineStartTime = micros();
}

// Helper function to read specific thermocouple
float readThermocouple(uint8_t index)
{
    if (index >= TEMPERATURE_SENSOR_COUNT)
    {
        return NAN;
    }

    // Select the CS for this thermocouple
    if (!csController.selectCS(index))
    {
        Serial.printf("Failed to select CS%d\n", index);
        return NAN;
    }

    delay(1); // Small delay for CS to settle

    // Read the temperature
    double temp = thermocouple.readCelsius();

    // Deselect all CS pins
    csController.deselectAll();

    return isnan(temp) ? NAN : (float)temp;
}

void setup()
{
    Serial.begin(115200);
    Serial.println("Rocket Tester Stand - ESP32-S3-ETH-PoE with Multi-ADC Support");

    // Initialize GPIO pins first
    Setup::pins();

    // Initialize CS controller before other SPI devices
    Setup::initCSController();

    // Initialize Ethernet
    if (Setup::ethernet())
    {
        // Load sensor configuration before initializing ADCs
        loadSensorConfig();

        // Now safe to init ADCs and other SPI devices
        Setup::adcs();
        Setup::spiffs();
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