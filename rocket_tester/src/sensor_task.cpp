#include "sensor_task.h"
#include "system_config.h"
#include "sensor_config.h"
#include <ADS1256.h>
#include <HX711.h>
#include <Adafruit_MAX31855.h>

extern ADS1256 adc1256;
extern HX711 ads1232;
extern Adafruit_MAX31855 thermocouples[];

void SensorTask::run(void *parameter)
{
  SensorData data;
  uint8_t currentLoadCell = 0; // For alternating between ADS1232 channels

  while (true)
  {
    if (systemState.isReading)
    {
      uint32_t currentTime = micros();
      data.readingsTimestamp = currentTime - systemState.readingsStartTime;
      data.ignitionTimestamp = systemState.ignitedWire ? (currentTime - systemState.ignitionStartTime) : 0;

      bool hasData = false;

      // Read all sensors
      for (uint8_t i = 0; i < SENSOR_COUNT; i++)
      {
        if (sensorConfigs[i].enabled)
        {
          float rawValue = 0.0f;
          bool readSuccess = false;

          switch (sensorConfigs[i].adcType)
          {
          case ADS1232_ADC: // Load cells
            if (ads1232.is_ready())
            {
              // ADS1232 has internal channel switching for AINP1 and AINP2
              rawValue = ads1232.get_units();
              readSuccess = true;
            }
            break;

          case ADS1256_ADC: // Pressure sensors
          {
            uint8_t mux = SING_0 + sensorConfigs[i].adcChannel;
            adc1256.setMUX(mux);
            delayMicroseconds(100);
            float voltage = adc1256.convertToVoltage(adc1256.cycleSingle());
            rawValue = voltage;
            readSuccess = true;
          }
          break;

          case MAX31855_ADC: // Temperature sensors
          {
            uint8_t thermocoupleIndex = sensorConfigs[i].adcChannel;
            if (thermocoupleIndex < TEMPERATURE_SENSOR_COUNT)
            {
              double temp = thermocouples[thermocoupleIndex].readCelsius();
              if (!isnan(temp))
              {
                rawValue = (float)temp;
                readSuccess = true;
              }
            }
          }
          break;
          }

          if (readSuccess)
          {
            data.values[i] = rawValue * sensorConfigs[i].conversionFactor + sensorConfigs[i].offset;
            hasData = true;
          }
          else
          {
            data.values[i] = 0.0f;
          }
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
      12000, // Increased stack size for multiple ADCs
      NULL,
      7, // High priority for sensor readings
      taskHandle,
      0 // Core 0
  );
}