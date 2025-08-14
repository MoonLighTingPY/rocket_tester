#include "system_config.h"

// Multiplexer channels for MAX31855 chips (C0=0, C1=1, etc.)
const int PinConfig::MAX31855_MUX_CHANNELS[TEMPERATURE_SENSOR_COUNT] = {
    0, 1, 2, 3 // C0 for first MAX31855, C1 for second MAX31855
};

// Network configuration implementation
const char *NetworkConfig::hostname = "esp32s3-rockettester";
const IPAddress NetworkConfig::deviceIP(169, 254, 1, 1);
const IPAddress NetworkConfig::gateway(169, 254, 1, 100);
const IPAddress NetworkConfig::subnet(255, 255, 0, 0);
const IPAddress NetworkConfig::dns(8, 8, 8, 8);

// Global system instances
SystemState systemState;
BufferConfig bufferConfig;