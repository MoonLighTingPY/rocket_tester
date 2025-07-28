// Updated system_config.h with CS controller setup
#ifndef SYSTEM_CONFIG_H
#define SYSTEM_CONFIG_H

#include <Arduino.h>
#include <CircularBuffer.hpp>
#include "sensor_config.h"

struct PinConfig
{
  // Engine control pins
  static const int ENGINE_OUT_PIN = 2;
  static const int ENGINE_IN_PIN = 3;
  static const int PYRO_PIN = 15;

  // W5500 Ethernet pins (Hardware SPI - VSPI)
  static const int W5500_SCK = 13;  // Hardware SPI SCK
  static const int W5500_MISO = 12; // Hardware SPI MISO
  static const int W5500_MOSI = 11; // Hardware SPI MOSI
  static const int W5500_CS = 14;   // Chip Select
  static const int W5500_RST = 9;   // Reset
  static const int W5500_INT = 10;  // Interrupt

  // ADS1232 pins (for load cells) - GPIO based, no SPI conflict
  static const int ADS1232_SCLK_PIN = 35;
  static const int ADS1232_DOUT_PIN = 36;
  static const int ADS1232_POMN_PIN = 37;

  // ADS1256 pins (for pressure sensors) - Use HSPI or software SPI
  static const int ADS1256_DRDY_PIN = 42;
  static const int ADS1256_RST_PIN = 46;
  static const int ADS1256_CS_PIN = 45;
  // Use different pins to avoid W5500 conflict
  static const int ADS1256_SCLK_PIN = 39; // Different from W5500
  static const int ADS1256_MISO_PIN = 41; // Different from W5500
  static const int ADS1256_MOSI_PIN = 40; // Different from W5500

  // MAX31855 shared pins (for thermocouples) - CS handled by Arduino Pro Micro
  static const int MAX31855_SCLK_PIN = 18; // Different from both above
  static const int MAX31855_MISO_PIN = 16; // DOUT - Different from above
  // No individual CS pins needed - handled by Arduino Pro Micro via UART

  // UART pins for CS controller communication
  static const int CS_CONTROLLER_TX = 43; // UART0 TX to Arduino Pro Micro RX
  static const int CS_CONTROLLER_RX = 44; // UART1 RX (if needed for feedback)
};

// Network configuration
struct NetworkConfig
{
  static const char *hostname;
  static const int WEB_SERVER_PORT = 80;
  static const int WEBSOCKET_PORT = 81;
  static const IPAddress deviceIP;
  static const IPAddress gateway;
  static const IPAddress subnet;
  static const IPAddress dns;
};

// Rest of your existing structs remain the same...
struct SystemState
{
  bool isReading;
  bool ignitedWire;
  bool prevPyroState;
  unsigned long readingsStartTime;
  unsigned long ignitionStartTime;
  unsigned long engineStartTime;

  SystemState() : isReading(false),
                  ignitedWire(false),
                  prevPyroState(LOW),
                  readingsStartTime(0),
                  ignitionStartTime(0),
                  engineStartTime(0) {}
};

struct SensorData
{
  float values[SENSOR_COUNT];
  unsigned long readingsTimestamp;
  unsigned long ignitionTimestamp;
  unsigned long engineTimestamp;

  SensorData() : readingsTimestamp(0), ignitionTimestamp(0), engineTimestamp(0)
  {
    for (int i = 0; i < SENSOR_COUNT; i++)
    {
      values[i] = 0.0f;
    }
  }
};

#pragma pack(push, 1)
struct BinarySensorPacket
{
  uint32_t readingsTimestamp;
  uint32_t ignitionTimestamp;
  float sensorValues[SENSOR_COUNT];
};
#pragma pack(pop)

struct BufferConfig
{
  static constexpr size_t BUFFER_SIZE = 1500;
  CircularBuffer<SensorData, BUFFER_SIZE> dataBuffer;
  portMUX_TYPE bufferMux = portMUX_INITIALIZER_UNLOCKED;

  void clear()
  {
    portENTER_CRITICAL(&bufferMux);
    while (!dataBuffer.isEmpty())
    {
      dataBuffer.pop();
    }
    portEXIT_CRITICAL(&bufferMux);
  }
};

extern SystemState systemState;
extern BufferConfig bufferConfig;

#endif