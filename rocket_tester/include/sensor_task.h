#ifndef SENSOR_TASK_H
#define SENSOR_TASK_H

#include <Arduino.h>

class SensorTask
{
public:
  static void run(void *parameter);
  static void create(TaskHandle_t *taskHandle);
};

#endif