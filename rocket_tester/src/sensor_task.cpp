#include "sensor_task.h"
#include "system_config.h"
#include "sensor_config.h"
#include <ADS1256.h>

extern ADS1256 adc;

void SensorTask::run(void *parameter)
{
  SensorData data;

  while (true)
  {
    if (systemState.isReading)
    {
      uint32_t currentTime = micros();
      data.readingsTimestamp = currentTime - systemState.readingsStartTime;
      data.ignitionTimestamp = systemState.ignitedWire ? (currentTime - systemState.ignitionStartTime) : 0;

      float voltage[SENSOR_COUNT];
      bool hasData = false;

      for (uint8_t i = 0; i < SENSOR_COUNT; i++)
      {
        voltage[i] = adc.convertToVoltage(adc.cycleSingle());

        if (sensorConfigs[i].enabled)
        {
          data.values[i] = voltage[i] * sensorConfigs[i].conversionFactor + sensorConfigs[i].offset;
          hasData = true;
        }
        else
        {
          data.values[i] = 0.0f;
        }
      }

      if (hasData)
      {
        portENTER_CRITICAL(&bufferConfig.bufferMux);
        if (!bufferConfig.dataBuffer.isFull())
        {
          bufferConfig.dataBuffer.push(data);
        }
        portEXIT_CRITICAL(&bufferConfig.bufferMux);
      }
    }

    vTaskDelay(1);
  }
}

void SensorTask::create(TaskHandle_t *taskHandle)
{
  xTaskCreatePinnedToCore(
      run,
      "SensorTask",
      10000,
      NULL,
      7, // High priority for sensor readings
      taskHandle,
      0 // Core 0
  );
}