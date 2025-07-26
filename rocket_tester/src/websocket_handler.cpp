#include "websocket_handler.h"
#include <ArduinoJson.h>
#include "system_config.h"
#include "sensor_config.h"

extern WebSocketsServer webSocket;

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
      digitalWrite(PinConfig::PYRO_PIN, LOW);
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