/*
    Based on Neil Kolban example for IDF: https://github.com/nkolban/esp32-snippets/blob/master/cpp_utils/tests/BLE%20Tests/SampleServer.cpp
    Ported to Arduino ESP32 by Evandro Copercini
    updates by chegewara
*/

#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>

// See the following for generating UUIDs:
// https://www.uuidgenerator.net/

// UUIDs for the BLE service and characteristic
#define SERVICE_UUID        "6f340e06-add8-495c-9da4-ce8558771834"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// Constants for the LED control
#define LEDC_BASE_FREQ     5000       // PWM base frequency
#define LEDC_TIMER_12_BIT  12         // PWM resolution (12 bits)

BLECharacteristic* pCharacteristic = NULL;
BLEServer* pServer = NULL;

// GPIO pins for the RGB LED
#define RED_PIN   27
#define GREEN_PIN 26
#define BLUE_PIN  25

// LEDC channels for PWM control
#define LEDC_CHANNEL_RED   1
#define LEDC_CHANNEL_GREEN 2
#define LEDC_CHANNEL_BLUE  3

enum State {
  LOCKED,
  OPENING,
  OPEN,
  LOCKING,
  RESET
};

State state = LOCKED; 

// Function to control LED brightness
void ledcAnalogWrite(uint8_t channel, uint32_t value, uint32_t valueMax = 255) {
    uint32_t duty = (4095 / valueMax) * min(value, valueMax);
    ledcWrite(channel, duty);
}

void changeColor() {
  if (state == OPEN) {
    ledcAnalogWrite(LEDC_CHANNEL_RED, 255);
    ledcAnalogWrite(LEDC_CHANNEL_GREEN, 0);
    ledcAnalogWrite(LEDC_CHANNEL_BLUE, 0);
    Serial.println("Transitioned to OPEN state.");
  } else if (state == OPENING || state == LOCKING) {
    ledcAnalogWrite(LEDC_CHANNEL_RED, 150);
    ledcAnalogWrite(LEDC_CHANNEL_GREEN, 200);
    ledcAnalogWrite(LEDC_CHANNEL_BLUE, 0);
  } else if (state == LOCKED) {
    ledcAnalogWrite(LEDC_CHANNEL_RED, 0);
    ledcAnalogWrite(LEDC_CHANNEL_GREEN, 0);
    ledcAnalogWrite(LEDC_CHANNEL_BLUE, 0);
    Serial.println("Transitioned to LOCKED state.");
  } else if (state = reset) {
    ledcAnalogWrite(LEDC_CHANNEL_RED, 0);
    ledcAnalogWrite(LEDC_CHANNEL_GREEN, 0);
    ledcAnalogWrite(LEDC_CHANNEL_BLUE, 255);
    Serial.println("Transitioned to RESET state.");
  }
}

bool deviceConnected = false;
bool oldDeviceConnected = false;
unsigned long commandStartTime = 0;
bool commandInProgress = false;

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
            } else if (value == "reset") {
              state = RESET;
              changeColor();
              pServer->disconnect();
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

  // Set up PWM for each color
  ledcSetup(LEDC_CHANNEL_RED, LEDC_BASE_FREQ, LEDC_TIMER_12_BIT);
  ledcAttachPin(RED_PIN, LEDC_CHANNEL_RED);
  ledcSetup(LEDC_CHANNEL_GREEN, LEDC_BASE_FREQ, LEDC_TIMER_12_BIT);
  ledcAttachPin(GREEN_PIN, LEDC_CHANNEL_GREEN);
  ledcSetup(LEDC_CHANNEL_BLUE, LEDC_BASE_FREQ, LEDC_TIMER_12_BIT);
  ledcAttachPin(BLUE_PIN, LEDC_CHANNEL_BLUE);

  changeColor();

  BLEDevice::init("HVAD SAA MAAAAAND");
  pServer = BLEDevice::createServer();
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());
  BLEService *pService = pServer->createService(SERVICE_UUID);
  pCharacteristic = pService->createCharacteristic(
                                      CHARACTERISTIC_UUID,
                                      BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_WRITE);
  pCharacteristic->setCallbacks(new MyCallbacks());
  pCharacteristic->setValue("Ready for commands");
  pService->start();
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
  Serial.println("Characteristic defined! Now you can read it in your phone!");
}

void loop() {
  if (commandInProgress) {
    //delay(11000); delay for testing
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
  // Handle device connection and reconnection logic
  if (!deviceConnected && oldDeviceConnected) {
      delay(500); // Small delay to ensure stability
      pServer->startAdvertising(); // Restart advertising
      oldDeviceConnected = deviceConnected;
      Serial.println("Start advertising");
  }
  if (deviceConnected && !oldDeviceConnected) {
      oldDeviceConnected = deviceConnected;
      Serial.println("Device Connected");
      if (state == RESET) {
        state == LOCKED;
        changeColor();
      }
  }
}