#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>

// Constants for the LED control
#define LEDC_BASE_FREQ     5000       // PWM base frequency
#define LEDC_TIMER_12_BIT  12         // PWM resolution (12 bits)

// UUIDs for the BLE service and characteristic
#define SERVICE_UUID        "6f340e06-add8-495c-9da4-ce8558771834"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define HEARTBEAT_UUID "12345678-90ab-cdef-1234-567890abcdef"
#define AUTH_UUID "1e4bae79-843f-4bd6-b6ca-b4c99188cfca"

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
BLECharacteristic* pAuthCharacteristic = NULL;

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
bool isAuthenticated = false;  // Global flag to track authentication status
unsigned long lastHeartbeatMillis = 0;
const long heartbeatInterval = 10000; // Update the heartbeat every 10 second



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

class AuthCallbacks: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pAuthCharacteristic) {
    std::string value = pAuthCharacteristic->getValue();
    if (value.length() > 0) {
      Serial.print("Received Value: ");
      Serial.println(value.c_str());

      // Handle password authentication
      if (value == "123") {  // Assuming '123' is the required password
          isAuthenticated = true;
          pAuthCharacteristic->setValue("Authenticated");
          Serial.println("Authenticated successfully.");
          return; // Exit early after authentication
      }

      if (!isAuthenticated) {
          Serial.println("Not authenticated: Ignoring command.");
          return; // Ignore further processing if not authenticated
      }
    }
  }
};

// Callback class for BLE characteristic
class MyCallbacks: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) {
    if (isAuthenticated) {  
      std::string value = pCharacteristic->getValue();
      Serial.print("Current State: ");
      Serial.println(state);
      commandStartTime = millis(); // Start command processing timer
      commandInProgress = true;

      if ((value == "Unlocked" && state == LOCKED) || (value == "Locked" && state == OPEN)) {
          if (value == "Unlocked" && state == LOCKED) {
              state = OPENING;
          } else if (value == "Locked" && state == OPEN) {
              state = LOCKING;
          }
          changeColor();
      } else if (value == "Reset") {
        state = RESET;
        changeColor();
        delay(1000);
        pServer->disconnect(pServer->getConnId());
      } else {
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
        isAuthenticated = false;  // Reset authentication status
        pAuthCharacteristic->setValue("Not Authenticated");
        deviceConnected = false;
    }
};


void setup() {
  Serial.begin(115200);
  Serial.println("Starting BLE work!");

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

  pHeartbeatCharacteristic = pService->createCharacteristic(
                                        HEARTBEAT_UUID,
                                        BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  pHeartbeatCharacteristic->setValue("0");  // Initial value

  pAuthCharacteristic = pService->createCharacteristic(
                                        AUTH_UUID,
                                        BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_WRITE);
  pAuthCharacteristic->setValue("Not Authenticated");  // Initial value
  pAuthCharacteristic->setCallbacks(new AuthCallbacks());


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