#include "websocket_task.h"
#include "system_config.h"
#include "sensor_config.h"
#include "websocket_handler.h" // brings CalibrationCtx, ads1232 declaration, and calibration extern
#include <WebSocketsServer.h>
#include <ArduinoOTA.h>
#include <ArduinoJson.h>

extern WebSocketsServer webSocket;
extern SensorConfig sensorConfigs[];

void WebSocketTask::run(void *parameter)
{
  while (true)
  {
    webSocket.loop();
    ArduinoOTA.handle();

    // Handle pyro pin monitoring inline
    if (systemState.isReading && !systemState.ignitedWire)
    {
      bool currentPyroState = !digitalRead(PinConfig::PYRO_PIN);
      Serial.printf("Pyro state: %s\n", currentPyroState ? "HIGH" : "LOW");

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

    // Handle test data streaming
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

    // Calibration sampling (runs only when not in active test)
    if (!systemState.isReading && calibration.state != CAL_IDLE)
    {
      uint64_t nowUs = micros();
      const uint64_t sampleIntervalUs = 50000;  // 50 ms
      const uint64_t phaseDurationUs = 3000000; // 3 s
      if (nowUs - calibration.lastSample >= sampleIntervalUs)
      {
        calibration.lastSample = nowUs;
        long raw = ads1232.raw_read(1);
        calibration.sum += raw;
        calibration.samples++;
        JsonDocument sd;
        sd["type"] = "calibration_sample";
        sd["raw"] = raw;
        String out;
        serializeJson(sd, out);
        webSocket.broadcastTXT(out);
      }
      if (nowUs - calibration.phaseStart >= phaseDurationUs)
      {
        if (calibration.state == CAL_TARE)
        {
          calibration.tare = calibration.samples ? (float)(calibration.sum / calibration.samples) : 0;
          calibration.state = CAL_WAIT_KNOWN;
          calibration.sum = 0;
          calibration.samples = 0;
          JsonDocument td;
          td["type"] = "tare_complete";
          td["tare"] = calibration.tare;
          String out;
          serializeJson(td, out);
          webSocket.broadcastTXT(out);
        }
        else if (calibration.state == CAL_CALIBRATING)
        {
          float avgLoaded = calibration.samples ? (float)(calibration.sum / calibration.samples) : calibration.tare;
          float net = (avgLoaded - calibration.tare);
          float scale = (net != 0) ? (calibration.knownWeight / net) : 0;
          float offsetConfig = -calibration.tare * scale;
          if (calibration.loadCellIndex >= 0)
          {
            sensorConfigs[calibration.loadCellIndex].conversionFactor = scale;
            sensorConfigs[calibration.loadCellIndex].offset = offsetConfig;
          }
          {
            JsonDocument dummy;
            JsonArray arr = dummy.to<JsonArray>();
            saveSensorConfig(arr);
          }
          JsonDocument cd;
          cd["type"] = "calibration_complete";
          cd["tare"] = calibration.tare;
          cd["scale"] = scale;
          cd["offset"] = offsetConfig;
          String out;
          serializeJson(cd, out);
          webSocket.broadcastTXT(out);
          calibration.state = CAL_IDLE;
        }
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