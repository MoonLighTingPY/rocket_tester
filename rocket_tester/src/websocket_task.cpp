#include "websocket_task.h"
#include "system_config.h"
#include "sensor_config.h"
#include <WebSocketsServer.h>
#include <ArduinoOTA.h>
#include <ArduinoJson.h>

extern WebSocketsServer webSocket;

void WebSocketTask::run(void *parameter)
{
  while (true)
  {
    webSocket.loop();
    ArduinoOTA.handle();

    // Handle pyro pin monitoring inline
    if (systemState.isReading && !systemState.ignitedWire)
    {
      bool currentPyroState = digitalRead(PinConfig::PYRO_PIN);

      if (currentPyroState == HIGH && systemState.prevPyroState == LOW)
      {
        systemState.ignitedWire = true;
        systemState.ignitionStartTime = micros();

        JsonDocument doc;
        doc["type"] = "ignition_detected";
        doc["timestamp"] = systemState.ignitionStartTime;
        String jsonString;
        serializeJson(doc, jsonString);
        webSocket.broadcastTXT(jsonString);

        Serial.println("External ignition detected!");
      }

      systemState.prevPyroState = currentPyroState;
    }
    else if (!systemState.isReading)
    {
      systemState.ignitedWire = false;
      systemState.prevPyroState = LOW;
    }

    if (systemState.isReading && !bufferConfig.dataBuffer.isEmpty())
    {

      JsonDocument doc;
      JsonArray array = doc["data"].to<JsonArray>();

      portENTER_CRITICAL(&bufferConfig.bufferMux);
      while (!bufferConfig.dataBuffer.isEmpty())
      {
        SensorData data = bufferConfig.dataBuffer.shift();
        JsonObject reading = array.add<JsonObject>();

        reading["t1"] = data.readingsTimestamp;
        reading["t2"] = data.ignitionTimestamp;

        for (size_t i = 0; i < SENSOR_COUNT; i++)
        {
          const SensorConfig &sensor = sensorConfigs[i];
          if (sensor.enabled)
          {
            reading[sensor.name] = data.values[i];
          }
        }
      }
      portEXIT_CRITICAL(&bufferConfig.bufferMux);

      if (array.size() >= 0)
      {
        doc["type"] = "test_data";
        String jsonString;
        serializeJson(doc, jsonString);
        webSocket.broadcastTXT(jsonString);
      }
    }

    vTaskDelay(1);
  }
}

void WebSocketTask::create(TaskHandle_t *taskHandle)
{
  xTaskCreatePinnedToCore(
      run,
      "WebSocketTask",
      10000,
      NULL,
      6, // High but lower than sensor task
      taskHandle,
      1 // Core 1
  );
}