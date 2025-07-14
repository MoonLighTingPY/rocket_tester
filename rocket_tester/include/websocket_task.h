#ifndef WEBSOCKET_TASK_H
#define WEBSOCKET_TASK_H

#include <Arduino.h>

class WebSocketTask
{
public:
  static void run(void *parameter);
  static void create(TaskHandle_t *taskHandle);
};

#endif