// // dont forget server.h patch (referenced in readne lil bro.txt)

// #include <SPI.h>
// #include <Ethernet_Generic.h>

// // Define W5500 pin assignments
// #define W5500_CS 14   // Chip Select pin
// #define W5500_RST 9   // Reset pin
// #define W5500_INT 10  // Interrupt pin
// #define W5500_MISO 12 // MISO pin
// #define W5500_MOSI 11 // MOSI pin
// #define W5500_SCK 13  // Clock pin

// // MAC address (can be arbitrary or set according to network requirements)
// byte mac[] = {0xDE, 0xAD, 0xBE, 0xEF, 0xFE, 0xED};
// EthernetServer server(80);

// void setup()
// {
//   Serial.begin(115200);
//   Serial.print("Starting Ethernet server... ");

//   SPI.begin(W5500_SCK, W5500_MISO, W5500_MOSI, W5500_CS);
//   Serial.println("SPI initialized");
//   Ethernet.init(W5500_CS);

//   // DHCP
//   IPAddress ip(192, 168, 9, 200);      // Static IP address
//   IPAddress serverdns(192, 168, 9, 1); // DNS server
//   IPAddress gateway(192, 168, 9, 1);   // Gateway address
//   IPAddress subnet(255, 255, 255, 0);  // Subnet mask

//   Serial.println("Initializing Ethernet with W5500...");

//   Ethernet.begin(mac, ip, serverdns, gateway, subnet); // Use all parameters
//   Serial.print("IP Address (static): ");
//   Serial.println(Ethernet.localIP());

//   Serial.print("IP Address: ");
//   Serial.println(Ethernet.localIP());

//   if (Ethernet.hardwareStatus() == EthernetNoHardware)
//   {
//     Serial.println("Ethernet shield was not found. Check wiring.");
//     while (true)
//     {
//       delay(1);
//     }
//   }
//   if (Ethernet.linkStatus() == LinkOFF)
//   {
//     Serial.println("Ethernet cable is not connected.");
//   }

//   server.begin(); // <-- Fix: use begin() with no arguments
// }

// void loop()
// {
//   EthernetClient client = server.available();
//   if (client)
//   {
//     // Wait for data from client
//     while (client.connected() && !client.available())
//     {
//       delay(1);
//     }
//     // Read and ignore HTTP request
//     while (client.available())
//     {
//       client.read();
//     }
//     // Respond with Hello World HTML
//     client.println("HTTP/1.1 200 OK");
//     client.println("Content-Type: text/html");
//     client.println("Connection: close");
//     client.println();
//     client.println("<!DOCTYPE html><html><body><h1>Hello World</h1></body></html>");
//     client.stop();
//   }
// }