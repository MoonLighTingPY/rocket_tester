# Model Rocket Engine Test Stand 🚀

Created for testing rocket engines. Captures thrust, pressure, and temperature readings during tests with high sampling rates and microsecond timing precision, controlled and configured using a web interface

## Overview

ESP32 is used to handle high-speed sensor readings and real-time data streaming to the client side(web interface). Data is acquired at high speed using ADS1256, buffered using a circular buffer to prevent data loss, and streamed in real-time. Web Interface is hosted on ESP32. You can start the test, ignite the engine, see the data on the chart in real time, and save it as CSV for further analysis. Additionaly, there's routes for fitlering the saved data using configurable Kalman/Gauss filters and for Analysing the filtered data (Calculate partial/full integrals, see min/max/avg stats for each sensor)

### Key Features

- Up to 8 independent sensor channels with configurable settings on the web interface:
  - Sensor Name
  - Sensor Type (load/pressure/temperature)
  - ADC Channel
  - Conversion factor
  - Offset
- Automatic ignition timing detection using physical wire break method
- Real-time data visualization with auto-scaling, zoomable charts
- Post-test data filtering and analysis:
  - Kalman filter for noise reduction
  - Gaussian smoothing
  - Statistical analysis (min, max, avg)
  - Integral calculations for each sensor, grouped by type
- Over-the-air (OTA) firmware and filesystem updates
- Web-based sensor configuration
- CSV export with microsecond precision timestamps

## Installation

### Hardware Setup
1. Wire sensors to ADS1256 inputs according to channel configuration
2. Connect pyro channel to ignition system
3. Install physical wire break detector for ignition timing
4. Power system with stable 5V supply



### Frontend
1. Build the frontend
```bash
cd frontend
npm install
npm build
```
2. Move the static files to the rocket_tester/data folder to upload into SPIFFS
```bash
cp -r dist/* ../rocket_tester/data
```


### Firmware
1. Install PlatformIO IDE extension in VS Code
2. Open rocket_tester directory
```bash
cd ../rocket_tester
```
   
4. Build and upload firmware:
```bash
pio run -t upload
```
4. Upload SPIFFS data:
```bash
pio run -t uploadfs
```

## Usage

1. Connect ESP32 to a stable 5V Power source, and a computer, using Ethernet cable
2. Access web interface at http://esp32-rockettester.local
3. Configure sensors in Edit Config modal
4. Start readings
5. Ignition the engine when ready
6. Monitor real-time data
7. Export data after test completion
8. Use Filter CSV page for data processing
9. Use Analysis page for Integration and stats


## System Architecture

### Hardware
- ESP32 microcontroller (dual-core, 240MHz)
- ADS1256 24-bit ADC:
  - Up to 30,000 SPS
  - 8 differential/single-ended channels
  - 2.5V voltage reference
  **Important Note:** I've modified the ADS1256 library due to critical issues in the original:
  - Original library was made by a degenerate that decided to initialize SPI in constructor which hangs ESP32
  - Fixed by moving SPI initialization to setup and adjusting timing parameters (tutorial commented in main.cpp)
- Load cells for thrust measurement (0-1000kg)
- Pressure sensors (0-1000bar)
- Temperature sensors (0-800C)
- Pyro channel for engine ignition

### Software Components

#### Firmware (`rocket_tester/main.cpp`)
- Multi-threaded architecture:
  - Core 0: High-priority sensor reading task (7.68MHz ADC clock)
  - Core 1: WebSocket communication and system control
- Features:
  - Real-time data acquisition at up to 30000 SPS
  - Circular buffer implementation to prevent data loss
  - WebSocket streaming with JSON formatting
  - OTA updates for both firmware and SPIFFS
  - SPIFFS-based configuration storage
  - Microsecond precision timing for ignition detection
  - Automatic sensor calibration and offset compensation

#### Frontend (`frontend/src`)
- Features:
  - Real-time data visualization using Chart.js
  - Filtering capabilities:
    - Kalman filter with configurable parameters
    - Gaussian smoothing with adjustable window size
  - Analysis tools:
    - Integrals Calculation for each sensor
    - Defining start/end integration points based on:
      - Real ignition Moment (Start)
      - Pressure/load rise/drop
      - First/Last timestamp
    - Min/max/avg Stats for each sensor
    - Statistical calculations
  - Json export with detailed metadata


### Key Files
- `rocket_tester/src/main.cpp`: Core functionality
  - ADC handling
  - WebSocket handling
  - Web interface hosting
- `rocket_tester/src/SensorConfig.h`: Sensor configuration
- `frontend/src/components/`: UI components
- `frontend/src/hooks/`: Hooks for data management

## Contributing

Please, create an issue in the repository for:
- Bug reports
- Feature requests
- Questions
