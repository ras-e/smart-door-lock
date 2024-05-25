#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <Arduino.h>
#include <PubSubClient.h>
#include <WiFi.h>

// Constants for the LED control
#define LEDC_BASE_FREQ     5000       // PWM base frequency
#define LEDC_TIMER_12_BIT  12         // PWM resolution (12 bits)

// UUIDs for the BLE service and characteristic
#define SERVICE_UUID        "6f340e06-add8-495c-9da4-ce8558771834"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define HEARTBEAT_UUID "12345678-90ab-cdef-1234-567890abcdef"


// GPIO pins for the RGB LED
#define RED_PIN   27
#define GREEN_PIN 26
#define BLUE_PIN  25

// LEDC channels for PWM control
#define LEDC_CHANNEL_RED   1
#define LEDC_CHANNEL_GREEN 2
#define LEDC_CHANNEL_BLUE  3

BLECharacteristic* pCharacteristic = NULL;
BLEServer* pServer = NULL;
BLECharacteristic* pHeartbeatCharacteristic = NULL;


enum State {
    LOCKED,
    OPENING,
    OPEN,
    LOCKING,
    RESET
};

State state = LOCKED;
bool deviceConnected = false;
bool oldDeviceConnected = false;
unsigned long commandStartTime = 0;
bool commandInProgress = false;
unsigned long lastHeartbeatMillis = 0;
const long heartbeatInterval = 10000; // Update the heartbeat every 10 second

//setup wifi and mqtt
WiFiClient espClient;
PubSubClient client(espClient);
long lastMsg = 0;
char msg[50];
int value = 0;

const char* ssid = "O S 1019";
const char* password = "Sigrid1234";

// Add your MQTT Broker IP address, example:
//const char* mqtt_server = "192.168.1.144";
const char* mqtt_server = "broker.hivemq.com";
int        port     = 1883;
const char topic[]  = "kanon_topic_123";
const long interval = 8000;
unsigned long previousMillis = 0;



// Function to control LED brightness
void ledcAnalogWrite(uint8_t channel, uint32_t value, uint32_t valueMax = 255) {
    uint32_t duty = (4095 / valueMax) * min(value, valueMax);
    ledcWrite(channel, duty);
}


void changeColor() {
  if (state == OPEN) {
    digitalWrite(RED_PIN, HIGH); // OFF
    digitalWrite(GREEN_PIN, LOW); // ON
    digitalWrite(BLUE_PIN, HIGH); // OFF
    Serial.println("Transitioned to OPEN state.");
  } else if (state == OPENING || state == LOCKING) {
    digitalWrite(RED_PIN, LOW); // ON
    digitalWrite(GREEN_PIN, LOW); // ON
    digitalWrite(BLUE_PIN, HIGH); // OFF
  } else if (state == LOCKED) {
    digitalWrite(RED_PIN, LOW);  // ON
    digitalWrite(GREEN_PIN, HIGH); // OFF
    digitalWrite(BLUE_PIN, HIGH); // OFF
    Serial.println("Transitioned to LOCKED state.");
  } else if (state = RESET) {
  digitalWrite(RED_PIN, HIGH); // OFF
    digitalWrite(GREEN_PIN, HIGH); // OFF
    digitalWrite(BLUE_PIN, LOW); // ON
    Serial.println("Transitioned to RESET state.");
  }
}


// Callback class for BLE characteristic
class MyCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
        std::string value = pCharacteristic->getValue();
        if (value.length() > 0) {
            Serial.print("Received Value: ");
            Serial.println(value.c_str());
            Serial.print("Current State: ");
            Serial.println(state);
            
            // Start command processing timer
            commandStartTime = millis();
            commandInProgress = true;

             if ((value == "Unlocked" && state == LOCKED) || (value == "Locked" && state == OPEN)) {
                if (value == "Unlocked" && state == LOCKED) {
                    state = OPENING;
                    changeColor();
                } else if (value == "Locked" && state == OPEN) {
                    state = LOCKING;
                    changeColor();
                }
                // Schedule immediate state transition for demonstration purposes
                // Real implementation might involve asynchronous operations
             } else if (value == "Reset") {
            state = RESET;
            changeColor();
            delay(1000); // Simulate delay for reset
            state = LOCKED;
            changeColor();
            pCharacteristic->setValue("Locked"); // Update characteristic to reflect locked state
            Serial.println("System reset and locked.");
             }
            else {
                commandInProgress = false; // No valid command for current state
                Serial.println("Invalid command for current state.");
            }
        }
    }
};


// Callback class for BLE server
class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) override {
        Serial.println("Client Connected");
        deviceConnected = true;
    }

    void onDisconnect(BLEServer* pServer) override {
        Serial.println("Client Disconnected");
        deviceConnected = false;
    }
};

void setup() {
    Serial.begin(115200);
    Serial.println("Starting BLE work!");
  while (!Serial) {
    ; 
  }
  setup_wifi();
  client.setServer(mqtt_server, port);
  pinMode(RED_PIN, OUTPUT);
  pinMode(GREEN_PIN, OUTPUT);
  pinMode(BLUE_PIN, OUTPUT);
  changeColor();

    BLEDevice::init("Smart lock group 15");
    pServer = BLEDevice::createServer();
    pServer->setCallbacks(new MyServerCallbacks());
    BLEService *pService = pServer->createService(SERVICE_UUID);
    pCharacteristic = pService->createCharacteristic(
                                        CHARACTERISTIC_UUID,
                                        BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_WRITE);
    pCharacteristic->setCallbacks(new MyCallbacks());
    pCharacteristic->setValue("Ready for commands");

    // Create and setup the Heartbeat characteristic
    pHeartbeatCharacteristic = pService->createCharacteristic(
                                        HEARTBEAT_UUID,
                                        BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
    pHeartbeatCharacteristic->setValue("0");  // Initial value

   // Set the initial characteristic value based on the lock's state
    String initialState = (state == LOCKED) ? "Locked" : "Unlocked";
    pCharacteristic->setValue(initialState.c_str());
    pCharacteristic->setCallbacks(new MyCallbacks());

    pService->start();
    BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(SERVICE_UUID);
    pAdvertising->setScanResponse(true);
    pAdvertising->setMinPreferred(0x06);
    pAdvertising->setMinPreferred(0x12);
    BLEDevice::startAdvertising();
    Serial.println("Characteristic defined! Now you can read it in your phone!");
}
void setup_wifi() {
  delay(10);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }
}

void reconnect() {
  // Loop until we're reconnected
  while (!client.connected()) {
    // Attempt to connect
    if (client.connect("OLIVERMEGAUNIKIDCLIENTLULE")) {
      // Subscribe
      client.subscribe(topic);
    } else {
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      // Wait 5 seconds before retrying
      delay(5000);
    }
  }
}


void loop() {
  if (commandInProgress) {
    //delay(11000); //delay for testing
    unsigned long currentTime = millis();
    if (currentTime - commandStartTime > 10000) { // 10 seconds timeout
        // Command timeout
        Serial.println("Command timed out, reverting state changes.");
        commandInProgress = false;
        state = LOCKED; // Revert to a safe state, adjust as necessary
        changeColor();
    } else if (state == OPENING || state == LOCKING) {
        // Complete the state transition
        state = (state == OPENING) ? OPEN : LOCKED;
        commandInProgress = false;
        Serial.print("State transition completed to ");
        Serial.println(state == OPEN ? "OPEN" : "LOCKED");
        changeColor();
    }
  }
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  long now = millis();
  if (now - lastMsg > 5000) {
    lastMsg = now;
    client.publish(topic, "HB");
  }

    unsigned long currentMillis = millis();
    if (currentMillis - lastHeartbeatMillis >= heartbeatInterval) {
        lastHeartbeatMillis = currentMillis;  // Reset the timer

        // Update the heartbeat characteristic with the current uptime in milliseconds
        String heartbeatValue = String(currentMillis);
        pHeartbeatCharacteristic->setValue(heartbeatValue.c_str());
        pHeartbeatCharacteristic->notify(); // Notify any connected client
        Serial.println("Heartbeat sent: " + heartbeatValue + " ms");
    }

 // Handle device connection and reconnection logic
  if (!deviceConnected && oldDeviceConnected) {
      delay(500); // Small delay to ensure stability
      pServer->startAdvertising(); // Restart advertising
      oldDeviceConnected = deviceConnected;
      Serial.println("Start advertising");
      if (state == RESET) {
        state = LOCKED;
        changeColor();
      }
  }
  if (deviceConnected && !oldDeviceConnected) {
      oldDeviceConnected = deviceConnected;
      Serial.println("Device Connected");
  }
}

