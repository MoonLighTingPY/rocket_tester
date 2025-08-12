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

// ADC calibration constants - updated based on actual measurements
const uint16_t ADC_0V_OFFSET = 47;      // ADC reading at 0V
const uint16_t ADC_2_5V_READING = 1500; // ADC reading at 2.5V (measured ~1496-1501)
const float VOLT_2_5V = 2500.0;         // 2.5V in millivolts

// Function to convert ADC reading to voltage with oversampling and calibration
float adc2volt(uint8_t pin, uint8_t samples = 5)
{
  uint32_t adcRaw = 0;

  // Oversampling to reduce noise
  for (uint8_t n = 0; n < samples; n++)
  {
    adcRaw += analogRead(pin);
    delayMicroseconds(500); // Small delay between samples
  }
  adcRaw = adcRaw / samples;

  // Apply calibration using actual measured values
  float volt = map(adcRaw, ADC_0V_OFFSET, ADC_2_5V_READING, 0, VOLT_2_5V);
  volt = volt / 1000.0; // Convert millivolts to volts

  // Clamp to valid range
  if (volt < 0.0)
    volt = 0.0;
  if (volt > 2.6)
    volt = 2.6; // Allow slight overhead
  return volt;
}

// Helper function to read thermocouple with fault handling
float readThermocoupleWithFaultHandling(uint8_t thermocoupleIndex, uint32_t timeoutMs = 50)
{

  if (thermocoupleIndex >= TEMPERATURE_SENSOR_COUNT)
  {
    Serial.println("[DEBUG] Invalid thermocouple index!");
    return NAN;
  }

  // Ensure proper SPI bus isolation
  digitalWrite(PinConfig::ADS1256_CS_PIN, HIGH);
  delayMicroseconds(50); // Longer delay to ensure ADS1256 is fully deselected

  // Set multiplexer to select the correct MAX31855
  uint8_t muxChannel = PinConfig::MAX31855_MUX_CHANNELS[thermocoupleIndex];
  setMultiplexerChannel(muxChannel);

  // Longer delay for multiplexer settling
  delayMicroseconds(100); // Increased settling time

  // Select the thermocouple via multiplexer signal pin
  digitalWrite(PinConfig::MUX_SIG_PIN, LOW); // Active low to select
  delayMicroseconds(50);

  uint32_t startTime = millis();
  double temp = NAN;

  // Add timeout protection
  bool readComplete = false;
  uint32_t attempts = 0;
  const uint32_t maxAttempts = 3;

  while (!readComplete && attempts < maxAttempts && (millis() - startTime) < timeoutMs)
  {
    temp = thermocouples[thermocoupleIndex].readCelsius();
    attempts++;

    if (!isnan(temp))
    {
      readComplete = true;
    }
    else
    {
      Serial.printf("[DEBUG] ReadCelsius attempt %lu failed\n", attempts);
      delayMicroseconds(100); // Small delay between attempts
    }
  }

  if (!readComplete)
  {
    Serial.printf("[DEBUG] Temperature read timed out after %lu attempts\n", attempts);
    uint8_t error = thermocouples[thermocoupleIndex].readError();
    Serial.printf("[DEBUG] readError returned: 0x%02X\n", error);
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

  // Configure ADC settings for better precision
  analogReadResolution(11); // 11-bit resolution (0-2047)
  analogSetAttenuation(ADC_11db);

  // Initialize ADC pins once at startup
  analogRead(1); // Initialize ADC1_CH0
  analogRead(2); // Initialize ADC1_CH1
  delay(10);     // Allow ADC to stabilize

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
          case ADS1232_ADC: // Load cell
            if (ads1232.is_ready())
            {
              rawValue = ads1232.units_read(1);
              readSuccess = true;
            }
            break;

          case ADS1256_ADC: // Pressure sensors
            // Convert ADC reading to voltage with proper calibration
            if (sensorConfigs[i].adcChannel == 0)
            {
              rawValue = adc2volt(1); // ADC1_CH0 = GPIO1, convert to voltage
              readSuccess = true;
            }
            else if (sensorConfigs[i].adcChannel == 1)
            {
              rawValue = adc2volt(2); // ADC1_CH1 = GPIO2, convert to voltage
              readSuccess = true;
            }
            else
            {
              rawValue = 0.0f;
              readSuccess = false;
            }
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
              rawValue = readThermocoupleWithFaultHandling(thermocoupleIndex, 20);

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

    // Increase delay to reduce CPU load and prevent stack overflow
    vTaskDelay(pdMS_TO_TICKS(10)); // 10ms delay instead of 1ms
  }
}

void SensorTask::create(TaskHandle_t *taskHandle)
{
  xTaskCreatePinnedToCore(
      run,
      "SensorTask",
      16000, // Increased stack size even more
      NULL,
      7, // High priority for sensor readings
      taskHandle,
      0 // Core 0
  );
}