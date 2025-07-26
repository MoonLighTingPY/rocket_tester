#ifndef ETHERNET_TASK_H
#define ETHERNET_TASK_H

#include <Arduino.h>

class EthernetTask
{
public:
    static void run(void *parameter);
    static void create(TaskHandle_t *taskHandle);
};

#endif