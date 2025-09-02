#include "sensor_task.h"
#include "system_config.h"
#include "sensor_config.h"
#include <ADS1256.h>
#include <ADS1232.h>
#include <Adafruit_MAX31855.h>
#include "max6675.h"
// Add SPI extern so we can use hardware SPI for MAX6675
extern SPIClass ads1256_spi;

extern ADS1256 adc1256;
extern ADS1232 ads1232;
extern Adafruit_MAX31855 thermocouples[];
extern MAX6675 max6675_sensors[];
extern void setMultiplexerChannel(uint8_t channel);

// ADC calibration constants - updated based on actual 4-20mA loop measurements
const uint16_t ADC_4mA_READING = 117;   // ADC reading at 4mA (0.23V)
const uint16_t ADC_20mA_READING = 1594; // ADC reading at 20mA (2.54V)
const float VOLT_4mA = 230.0;           // 0.23V in millivolts
const float VOLT_20mA = 2540.0;         // 2.54V in millivolts

// Function to convert ADC reading to voltage with oversampling and calibration
float adc2volt(uint8_t pin, uint8_t samples = 5)
{
  uint32_t adcRaw = 0;

  // Oversampling to reduce noise
  // for (uint8_t n = 0; n < samples; n++)
  // {
  //   adcRaw += analogRead(pin);
  //   delayMicroseconds(500); // Small delay between samples
  // }
  // adcRaw = adcRaw / samples;
  adcRaw = analogRead(pin);
  // Linear interpolation between 4mA and 20mA points
  float volt = map(adcRaw, ADC_4mA_READING, ADC_20mA_READING, VOLT_4mA, VOLT_20mA);
  volt = volt / 1000.0; // Convert millivolts to volts

  // No clamping needed - let the sensor report its actual range
  return volt;
}

// Add per-MAX6675 timing/cache (only 2 channels here but sized for all)
static uint32_t max6675LastReadMs[TEMPERATURE_SENSOR_COUNT] = {0};
static float max6675Cached[TEMPERATURE_SENSOR_COUNT] = {NAN, NAN, NAN, NAN};
// Minimum time between MAX6675 conversions (datasheet ~220ms). Use 230ms margin.
static const uint32_t MAX6675_MIN_INTERVAL_MS = 230;

// Helper function to read thermocouple with fault handling
float readThermocoupleWithFaultHandling(uint8_t thermocoupleIndex, uint32_t timeoutMs = 50)
{
  if (thermocoupleIndex >= TEMPERATURE_SENSOR_COUNT)
  {
    Serial.println("[DEBUG] Invalid thermocouple index!");
    return NAN;
  }

  // Determine chip type based on channel (0-1 MAX31855, 2-3 MAX6675)
  ThermocoupleChipType chipType = (thermocoupleIndex < 2) ? MAX31855_CHIP : MAX6675_CHIP;

  // For MAX6675: if conversion still in progress, just return cached value (no bus activity)
  if (chipType == MAX6675_CHIP)
  {
    uint32_t now = millis();
    if ((now - max6675LastReadMs[thermocoupleIndex]) < MAX6675_MIN_INTERVAL_MS && !isnan(max6675Cached[thermocoupleIndex]))
    {
      return max6675Cached[thermocoupleIndex];
    }
  }

  // Ensure proper SPI bus isolation before any new transaction
  digitalWrite(PinConfig::ADS1256_CS_PIN, HIGH);
  delayMicroseconds(30);

  // Select desired channel on multiplexer (needed for both chip types)
  uint8_t muxChannel = PinConfig::MAX31855_MUX_CHANNELS[thermocoupleIndex];
  setMultiplexerChannel(muxChannel);
  delayMicroseconds(40);

  // We'll only pull CS (MUX_SIG_PIN low) when we really perform a read
  uint32_t startTime = millis();
  double temp = NAN;
  bool readComplete = false;
  uint32_t attempts = 0;
  const uint32_t maxAttempts = 3;

  while (!readComplete && attempts < maxAttempts && (millis() - startTime) < timeoutMs)
  {
    if (chipType == MAX31855_CHIP)
    {
      // Drive CS low
      digitalWrite(PinConfig::MUX_SIG_PIN, LOW);
      delayMicroseconds(5);
      temp = thermocouples[thermocoupleIndex].readCelsius();
      digitalWrite(PinConfig::MUX_SIG_PIN, HIGH); // End transaction (library internally clocks while CS low)
    }
    else // MAX6675_CHIP
    {
      // Start a read only after its conversion interval elapsed (already checked, but re-guard)
      digitalWrite(PinConfig::MUX_SIG_PIN, LOW); // CS LOW to read existing conversion
      delayMicroseconds(5);
      ads1256_spi.beginTransaction(SPISettings(4000000, MSBFIRST, SPI_MODE0));
      uint16_t v = ((uint16_t)ads1256_spi.transfer(0x00) << 8) | ads1256_spi.transfer(0x00);
      ads1256_spi.endTransaction();
      digitalWrite(PinConfig::MUX_SIG_PIN, HIGH); // Rising edge starts the NEXT conversion
      // Bit 2 = fault (open)
      if (v & 0x0004)
      {
        temp = NAN;
      }
      else
      {
        uint16_t raw = v >> 3;     // Bits 15..3
        temp = (double)raw * 0.25; // 0.25 °C per bit
      }
      // Cache (even if NAN, so we don't hammer the chip every loop)
      max6675Cached[thermocoupleIndex] = (float)temp;
      max6675LastReadMs[thermocoupleIndex] = millis();
    }

    attempts++;
    if (!isnan(temp))
      readComplete = true;
    else
      delayMicroseconds(80);
  }

  if (!readComplete && chipType == MAX31855_CHIP)
  {
    uint8_t error = thermocouples[thermocoupleIndex].readError();
    static uint32_t lastErrorPrint = 0;
    if (millis() - lastErrorPrint > 1000)
    {
      Serial.printf("TC%d MAX31855 fault: 0x%02X\n", thermocoupleIndex, error);
      lastErrorPrint = millis();
    }
  }

  // Re-enable ADS1256 (keep CS high here; main loop manages driving low if needed)
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

            // Map sensor config adcChannel to actual thermocouple index (0-3)
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
            data.values[i] = 1.11f;
          }
        }
        else
        {
          data.values[i] = 2.22f;
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