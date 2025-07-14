#ifndef WEBSOCKET_HANDLER_H
#define WEBSOCKET_HANDLER_H

#include <Arduino.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>

void webSocketEvent(uint8_t num, WStype_t type, uint8_t *payload, size_t length);

#endif