#include <Arduino.h>
#include <ESPAsyncWebServer.h>
#include <WebSocketsServer.h>
#include <ADS1256.h>
#include <ArduinoJson.h>

#include "system_config.h"
#include "sensor_config.h"
#include "setup_functions.h"
#include "sensor_task.h"
#include "websocket_task.h"
#include "websocket_handler.h"

// Task handles
TaskHandle_t sensorTaskHandle = NULL;
TaskHandle_t webSocketTaskHandle = NULL;

// Hardware instances
AsyncWebServer server(NetworkConfig::WEB_SERVER_PORT);
WebSocketsServer webSocket = WebSocketsServer(NetworkConfig::WEBSOCKET_PORT);
ADS1256 adc(PinConfig::ADC_DRDY_PIN, PinConfig::ADC_RST_PIN, 0, PinConfig::ADC_CS_PIN, 2.4937);

// Interrupt handler
void IRAM_ATTR engineStartISR()
{
    systemState.engineStartTime = micros();
}

void setupTasks()
{
    SensorTask::create(&sensorTaskHandle);
    WebSocketTask::create(&webSocketTaskHandle);
}

void setup()
{
    delay(2000);
    Serial.begin(115200);
    Serial.println("Rocket Tester Stand");

    Setup::pins();
    Setup::adc();
    Setup::spiffs();
    loadSensorConfig();
    Setup::ethernet();
    Setup::webServices();
    Setup::ota();
    setupTasks();
}

void loop()
{
    vTaskDelete(NULL);
}