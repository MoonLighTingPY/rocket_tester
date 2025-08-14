#include "websocket_handler.h"
#include <ArduinoJson.h>
#include "system_config.h"
#include "sensor_config.h"

extern WebSocketsServer webSocket;
extern SensorConfig sensorConfigs[];

// Define the shared calibration context (single definition)
CalibrationCtx calibration;

// If ADS1232 is instantiated in main.cpp (as in your workspace), the extern in the header is sufficient.

void webSocketEvent(uint8_t num, WStype_t type, uint8_t *payload, size_t length)
{
  switch (type)
  {
  case WStype_CONNECTED:
    Serial.printf("WebSocket client #%u connected\n", num);
    sendSensorConfig(num);
    break;
  case WStype_DISCONNECTED:
    Serial.printf("WebSocket client #%u disconnected\n", num);
    bufferConfig.clear();
    systemState.isReading = false;
    systemState.ignitedWire = false;
    break;
  case WStype_TEXT:
  {
    String message = String((char *)payload);
    JsonDocument doc;
    auto err = deserializeJson(doc, payload, length);

    if (!err)
    {
      if (doc["type"] == "get_config")
      {
        sendSensorConfig(num);
      }
      else if (doc["type"] == "update_config")
      {
        JsonObject obj = doc.as<JsonObject>();
        handleUpdateConfig(num, obj);
      }
      else if (doc["type"] == "start_tare")
      {
        if (systemState.isReading)
        {
          JsonDocument r;
          r["type"] = "calibration_error";
          r["message"] = "Cannot calibrate while test running";
          String s;
          serializeJson(r, s);
          webSocket.sendTXT(num, s);
          break;
        }
        calibration = CalibrationCtx(); // reset
        // find load cell
        for (int i = 0; i < SENSOR_COUNT; i++)
        {
          if (sensorConfigs[i].enabled && sensorConfigs[i].type == LOAD)
          {
            calibration.loadCellIndex = i;
            break;
          }
        }
        if (calibration.loadCellIndex < 0)
        {
          JsonDocument r;
          r["type"] = "calibration_error";
          r["message"] = "No enabled load cell";
          String s;
          serializeJson(r, s);
          webSocket.sendTXT(num, s);
          break;
        }
        calibration.state = CAL_TARE;
        calibration.phaseStart = micros();
        calibration.lastSample = 0;
        JsonDocument r;
        r["type"] = "calibration_started";
        r["phase"] = "tare";
        String s;
        serializeJson(r, s);
        webSocket.broadcastTXT(s);
      }
      else if (doc["type"] == "start_calibration")
      {
        if (calibration.state != CAL_WAIT_KNOWN)
        {
          JsonDocument r;
          r["type"] = "calibration_error";
          r["message"] = "Tare not completed";
          String s;
          serializeJson(r, s);
          webSocket.sendTXT(num, s);
          break;
        }
        calibration.knownWeight = doc["knownWeight"] | 0.0;
        if (calibration.knownWeight <= 0)
        {
          JsonDocument r;
          r["type"] = "calibration_error";
          r["message"] = "Invalid known weight";
          String s;
          serializeJson(r, s);
          webSocket.sendTXT(num, s);
          break;
        }
        calibration.state = CAL_CALIBRATING;
        calibration.phaseStart = micros();
        calibration.lastSample = 0;
        calibration.sum = 0;
        calibration.samples = 0;
        JsonDocument r;
        r["type"] = "calibration_started";
        r["phase"] = "known_weight";
        String s;
        serializeJson(r, s);
        webSocket.broadcastTXT(s);
      }
    }

    if (message == "start_readings")
    {
      Serial.println("WebSocket: starting readings...");
      bufferConfig.clear();
      systemState.isReading = true;
      systemState.readingsStartTime = micros();
      systemState.ignitedWire = false;
      systemState.prevPyroState = digitalRead(PinConfig::PYRO_PIN);

      if (systemState.prevPyroState == LOW)
      {
        systemState.ignitedWire = false;
      }
      else
      {
        systemState.ignitedWire = true;
        systemState.ignitionStartTime = micros();
      }
      Serial.printf("Readings started at %lu\n", systemState.readingsStartTime);
    }
    else if (message == "end_test")
    {
      systemState.isReading = false;
      systemState.ignitedWire = false;
      bufferConfig.clear();

      JsonDocument doc;
      doc.clear();
      doc["type"] = "time_difference";
      doc["value"] = systemState.engineStartTime - systemState.ignitionStartTime;
      String jsonString;
      serializeJson(doc, jsonString);
      webSocket.broadcastTXT(jsonString);
    }
    break;
  }
  }
}