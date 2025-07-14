#ifndef SYSTEM_CONFIG_H
#define SYSTEM_CONFIG_H

#include <Arduino.h>
#include <CircularBuffer.hpp>
#include "sensor_config.h"

// Hardware pin definitions for ESP32-S3-ETH-PoE
struct PinConfig
{
  // Engine control pins
  static const int ENGINE_OUT_PIN = 2;
  static const int ENGINE_IN_PIN = 4;
  static const int PYRO_PIN = 5;

  // ADS1232 pins (for load cells)
  static const int ADS1232_SCLK_PIN = 18;
  static const int ADS1232_DOUT_PIN = 19;
  static const int ADS1232_POMN_PIN = 21;  // Power control
  static const int ADS1232_SPEED_PIN = 22; // Speed control
  static const int ADS1232_GAIN1_PIN = 23; // Gain selection
  static const int ADS1232_GAIN0_PIN = 25; // Gain selection

  // ADS1256 pins (for pressure sensors)
  static const int ADS1256_DRDY_PIN = 26;
  static const int ADS1256_RST_PIN = 27;
  static const int ADS1256_CS_PIN = 32;
  static const int ADS1256_SCLK_PIN = 33;
  static const int ADS1256_MISO_PIN = 35;
  static const int ADS1256_MOSI_PIN = 36;

  // MAX31855 shared pins (for thermocouples)
  static const int MAX31855_SCLK_PIN = 37;
  static const int MAX31855_MISO_PIN = 38;
  // Individual CS pins for each MAX31855
  static const int MAX31855_CS_PINS[TEMPERATURE_SENSOR_COUNT];
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