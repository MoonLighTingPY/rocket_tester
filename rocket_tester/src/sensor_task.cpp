#include "sensor_task.h"
#include "system_config.h"
#include "sensor_config.h"
#include <ADS1256.h>
#include <ADS1232.h>
#include <Adafruit_MAX31855.h>

extern ADS1256 adc1256;
extern ADS1232 ads1232;
extern Adafruit_MAX31855 thermocouples[];
extern void setMultiplexerChannel(uint8_t channel);

// Helper function to read thermocouple with fault handling
float readThermocoupleWithFaultHandling(uint8_t thermocoupleIndex, uint32_t timeoutMs = 50)
{
  if (thermocoupleIndex >= TEMPERATURE_SENSOR_COUNT)
  {
    return NAN;
  }

  // Set multiplexer to select the correct MAX31855
  uint8_t muxChannel = PinConfig::MAX31855_MUX_CHANNELS[thermocoupleIndex];
  setMultiplexerChannel(muxChannel);

  // Shorter delay for multiplexer settling
  delayMicroseconds(20);

  uint32_t startTime = millis();
  double temp = NAN;

  // Single read attempt with quick timeout
  temp = thermocouples[thermocoupleIndex].readCelsius();

  if (isnan(temp))
  {
    // Check for faults only if reading failed
    uint8_t error = thermocouples[thermocoupleIndex].readError();
    if (error != 0)
    {
      // Only print errors occasionally to avoid flooding serial
      static uint32_t lastErrorPrint = 0;
      if (millis() - lastErrorPrint > 1000) // Print errors max once per second
      {
        Serial.printf("TC%d fault: 0x%02X ", thermocoupleIndex, error);
        if (error & MAX31855_FAULT_OPEN)
          Serial.print("OPEN ");
        if (error & MAX31855_FAULT_SHORT_GND)
          Serial.print("SHORT_GND ");
        if (error & MAX31855_FAULT_SHORT_VCC)
          Serial.print("SHORT_VCC ");
        Serial.println();
        lastErrorPrint = millis();
      }
    }
  }

  // Deselect all thermocouples by setting MUX signal high
  digitalWrite(PinConfig::MUX_SIG_PIN, HIGH);

  return (float)temp;
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
            // Ensure ADS1256 SPI is not active
            digitalWrite(PinConfig::ADS1256_CS_PIN, HIGH);
            delayMicroseconds(10);

            // Map sensor config adcChannel to actual thermocouple index (0-1)
            uint8_t thermocoupleIndex = sensorConfigs[i].adcChannel;
            if (thermocoupleIndex < TEMPERATURE_SENSOR_COUNT)
            {
              rawValue = readThermocoupleWithFaultHandling(thermocoupleIndex, 20); // Very short timeout

              if (!isnan(rawValue))
              {
                readSuccess = true;
              }
            }

            // Restore ADS1256 CS to LOW for next cycle
            delayMicroseconds(10);
            digitalWrite(PinConfig::ADS1256_CS_PIN, LOW);
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