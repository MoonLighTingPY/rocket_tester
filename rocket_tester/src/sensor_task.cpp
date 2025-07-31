// Modified sensor_task.cpp with CS controller integration

#include "sensor_task.h"
#include "system_config.h"
#include "sensor_config.h"
#include <ADS1256.h>
#include <ADS1232.h>
#include <Adafruit_MAX31855.h>
#include "cs_controller.h"

extern ADS1256 adc1256;
extern ADS1232 ads1232;
extern CSController csController;
extern Adafruit_MAX31855 thermocouple; // Single instance for all thermocouples

// Helper function to read specific thermocouple with CS control
float readThermocoupleWithCS(uint8_t index)
{
  if (index >= TEMPERATURE_SENSOR_COUNT)
  {
    return NAN;
  }

  // Select the CS for this thermocouple
  if (!csController.selectCS(index))
  {
    Serial.printf("Failed to select CS%d for thermocouple\n", index);
    return NAN;
  }

  // Small delay for CS to settle
  delayMicroseconds(100);

  // Read the temperature
  double temp = thermocouple.readCelsius();

  // Deselect all CS pins after reading
  csController.deselectAll();

  return isnan(temp) ? NAN : (float)temp;
}

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
      bool hasData = false;

      // --- Read all ADS1256 channels first, store voltages ---
      float ads1256Voltages[SENSOR_COUNT] = {0.0f};
      for (uint8_t i = 0; i < SENSOR_COUNT; i++)
      {
        if (sensorConfigs[i].adcType == ADS1256_ADC)
        {
          int32_t rawAdc = adc1256.cycleSingle();
          ads1256Voltages[i] = adc1256.convertToVoltage(rawAdc);
        }
      }

      // Read all sensors
      for (uint8_t i = 0; i < SENSOR_COUNT; i++)
      {
        if (sensorConfigs[i].enabled)
        {
          float rawValue = 0.0f;
          bool readSuccess = false;

          switch (sensorConfigs[i].adcType)
          {
          case ADS1232_ADC: // Load cell
            if (ads1232.is_ready())
            {
              rawValue = ads1232.units_read(1);
              readSuccess = true;
            }
            break;

          case ADS1256_ADC: // Pressure sensors
            rawValue = ads1256Voltages[i];
            readSuccess = true;
            break;

          case MAX31855_ADC: // Temperature sensors
          {
            uint8_t thermocoupleIndex = sensorConfigs[i].adcChannel;
            if (thermocoupleIndex < TEMPERATURE_SENSOR_COUNT)
            {
              float temp = readThermocoupleWithCS(thermocoupleIndex);
              if (!isnan(temp))
              {
                rawValue = temp;
                readSuccess = true;
              }
              else
              {
                Serial.printf("Failed to read thermocouple %d\n", thermocoupleIndex);
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

    vTaskDelay(1); // 1ms delay
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