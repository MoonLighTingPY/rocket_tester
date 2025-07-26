#include "ethernet_task.h"
#include <EthernetESP32.h>

void EthernetTask::run(void *parameter)
{
    TickType_t xLastWakeTime = xTaskGetTickCount();
    const TickType_t xFrequency = pdMS_TO_TICKS(1000); // Check every 1 second

    for (;;)
    {
        // Maintain Ethernet connection
        Ethernet.maintain();

        // Check link status
        static uint8_t lastLinkStatus = LinkOFF;
        uint8_t currentLinkStatus = Ethernet.linkStatus();

        if (currentLinkStatus != lastLinkStatus)
        {
            Serial.printf("Ethernet link status changed: %s\n",
                          currentLinkStatus == LinkON ? "UP" : "DOWN");

            if (currentLinkStatus == LinkOFF)
            {
                Serial.println("Ethernet link lost - attempting to restore...");
                // Optionally restart Ethernet
                // Setup::ethernet();
            }
            lastLinkStatus = currentLinkStatus;
        }

        // Print IP periodically for debugging
        static int counter = 0;
        if (++counter >= 30)
        { // Every 30 seconds
            Serial.printf("Ethernet IP: %s, Link: %s\n",
                          Ethernet.localIP().toString().c_str(),
                          currentLinkStatus == LinkON ? "UP" : "DOWN");
            counter = 0;
        }

        vTaskDelayUntil(&xLastWakeTime, xFrequency);
    }
}

void EthernetTask::create(TaskHandle_t *taskHandle)
{
    xTaskCreatePinnedToCore(
        run,
        "EthernetMaintenance",
        2048,
        NULL,
        1, // Lower priority than sensor tasks
        taskHandle,
        0 // Core 0
    );
}