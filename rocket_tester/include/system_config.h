#ifndef SYSTEM_CONFIG_H
#define SYSTEM_CONFIG_H

#include <Arduino.h>
#include <CircularBuffer.hpp>
#include "sensor_config.h"

// Hardware pin definitions
struct PinConfig
{
  static const int ENGINE_OUT_PIN = 5; // (GPIO 35 on wt32-eth01)
  static const int ENGINE_IN_PIN = 35; // (GPIO 5 on wt32-eth01)
  static const int PYRO_PIN = 17;

  // ADS1256 pins
  static const int ADC_DRDY_PIN = 39;
  static const int ADC_RST_PIN = 4;
  static const int ADC_CS_PIN = 14;
  static const int ADC_SCLK_PIN = 32;
  static const int ADC_MISO_PIN = 33;
  static const int ADC_MOSI_PIN = 2;
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

// System state structure
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

// Sensor data structure
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

// Binary packet structure for efficient data transfer
#pragma pack(push, 1)
struct BinarySensorPacket
{
  uint32_t readingsTimestamp;
  uint32_t ignitionTimestamp;
  float sensorValues[SENSOR_COUNT];
};
#pragma pack(pop)

// Buffer configuration
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

// Global system instances
extern SystemState systemState;
extern BufferConfig bufferConfig;

#endif