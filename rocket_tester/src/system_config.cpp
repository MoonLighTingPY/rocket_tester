#include "system_config.h"

// Network configuration implementation
const char *NetworkConfig::hostname = "esp32-rockettester";
const IPAddress NetworkConfig::deviceIP(169, 254, 1, 1);
const IPAddress NetworkConfig::gateway(169, 254, 1, 100);
const IPAddress NetworkConfig::subnet(255, 255, 0, 0);
const IPAddress NetworkConfig::dns(8, 8, 8, 8);

// Global system instances
SystemState systemState;
BufferConfig bufferConfig;