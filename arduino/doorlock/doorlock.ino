#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>

class MyCallbacks : public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
        std::string value = pCharacteristic->getValue();
        if (!value.empty()) {
            Serial.println("Received command: " + String(value.c_str()));
            if (value == "LOCK") {
                state = LOCKED;
            } else if (value == "OPENING") {
                state = OPENING;
            } else if (value == "OPEN") {
                state = OPEN;
            } else if (value == "LOCKING") {
                state = LOCKING;
            }
        }
    }
};

#define SERVICE_UUID                "6f340e06-add8-495c-9da4-ce8558771834"
#define CHARACTERISTIC_UUID         "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define HEARTBEAT_CHARACTERISTIC_UUID "feedc0de-0000-0000-0000-000000000000"

// use first channel of 16 channels (started from zero)
#define LEDC_CHANNEL_0     0
// use 12 bit precision for LEDC timer
#define LEDC_TIMER_12_BIT  12
// use 5000 Hz as a LEDC base frequency
#define LEDC_BASE_FREQ     5000

// fade LED PIN (replace with LED_BUILTIN constant for built-in LED)
#define LED_PIN            2 

int brightness = 0;    // how bright the LED is

BLECharacteristic *heartbeatCharacteristic;

void ledcAnalogWrite(uint8_t channel, uint32_t value, uint32_t valueMax = 255) {
  // calculate duty, 4095 from 2^12 - 1
  uint32_t duty = (4095 / valueMax) * min(value, valueMax);
  // write duty to LEDC
  ledcWrite(channel, duty);
}

enum State {
    LOCKED,
    OPENING,
    OPEN,
    LOCKING
};

State state = LOCKED;

void setup() {
  Serial.begin(115200);
  Serial.println("Starting BLE work!");

  ledcSetup(LEDC_CHANNEL_0, LEDC_BASE_FREQ, LEDC_TIMER_12_BIT);
  ledcAttachPin(LED_PIN, LEDC_CHANNEL_0);

  BLEDevice::init("BLUETOOTHGROUP15");
  BLEServer *pServer = BLEDevice::createServer();
  BLEService *pService = pServer->createService(SERVICE_UUID);

  BLECharacteristic *pCharacteristic = pService->createCharacteristic(
                                         CHARACTERISTIC_UUID,
                                         BLECharacteristic::PROPERTY_READ |
                                         BLECharacteristic::PROPERTY_WRITE
                                       );
  pCharacteristic->setValue("Hello World says Neil");

  heartbeatCharacteristic = pService->createCharacteristic(
                                         HEARTBEAT_CHARACTERISTIC_UUID,
                                         BLECharacteristic::PROPERTY_NOTIFY
                                       );
  uint8_t heartBeatValue[1] = {0};
  heartbeatCharacteristic->setValue(heartBeatValue, 1);

  pService->start();
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);  // functions that help with iPhone connections issue
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();

  Serial.println("Characteristic defined! Now you can read it in your phone!");
}

void loop() {
  // Heartbeat update
  static unsigned long lastHeartbeatMillis = 0;
  if (millis() - lastHeartbeatMillis > 1000) { // Send heartbeat every second
    lastHeartbeatMillis = millis();
    uint8_t heartBeatValue[1] = {1};  // Toggle heartbeat value for visibility
    heartbeatCharacteristic->setValue(heartBeatValue, 1);
    heartbeatCharacteristic->notify();
  }

  // State management logic
  switch (state) {
    case LOCKED:
      brightness = 0;
      state = OPENING;
      break;
    case OPENING:
      brightness = 50;
      state = OPEN;
      break;
    case OPEN:
      brightness = 255;
      state = LOCKING;
      break;
    case LOCKING:
      brightness = 50;
      state = LOCKED;
      break;
  }

  ledcAnalogWrite(LEDC_CHANNEL_0, brightness);
  delay(5000);  // Main loop delay
}
