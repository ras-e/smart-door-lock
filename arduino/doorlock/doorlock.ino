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

#define SERVICE_UUID        "6f340e06-add8-495c-9da4-ce8558771834"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"
// use first channel of 16 channels (started from zero)
#define LEDC_CHANNEL_0     0

BLECharacteristic* pCharacteristic = NULL;
BLEServer* pServer = NULL;

// use 12 bit precission for LEDC timer
#define LEDC_TIMER_12_BIT  12

// use 5000 Hz as a LEDC base frequency
#define LEDC_BASE_FREQ     5000

int brightness = 0;    // how bright the LED is
std::string userInput = "";
std::string lastUserInput = "";

// fade LED PIN (replace with LED_BUILTIN constant for built-in LED)
#define LED_PIN            2 

void ledcAnalogWrite(uint8_t channel, uint32_t value, uint32_t valueMax = 255) {
  // calculate duty, 4095 from 2 ^ 12 - 1
  uint32_t duty = (4095 / valueMax) * min(value, valueMax);

  // write duty to LEDC
  ledcWrite(channel, duty);
}

bool deviceConnected = false;
bool oldDeviceConnected = false;

class MyServerCallbacks : public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
        deviceConnected = true;
    };

    void onDisconnect(BLEServer* pServer) {
        deviceConnected = false;
    }
};


enum State {
    LOCKED,
    OPENING,
    OPEN,
    LOCKING};

State state = LOCKED; 

void setup() {
  Serial.begin(115200);
  Serial.println("Starting BLE work!");

  ledcSetup(LEDC_CHANNEL_0, LEDC_BASE_FREQ, LEDC_TIMER_12_BIT);
  ledcAttachPin(LED_PIN, LEDC_CHANNEL_0);

  BLEDevice::init("VIRUS_PLEASE_CONNECT");
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());
  BLEService *pService = pServer->createService(SERVICE_UUID);
 pCharacteristic = pService->createCharacteristic(
                                         CHARACTERISTIC_UUID,
                                         BLECharacteristic::PROPERTY_READ |
                                         BLECharacteristic::PROPERTY_WRITE
                                       );

  pCharacteristic->setValue("Saa skal der bare laases!");
  pService->start();
  // BLEAdvertising *pAdvertising = pServer->getAdvertising();  // this still is working for backward compatibility
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);  // functions that help with iPhone connections issue
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
  Serial.println("Characteristic defined! Now you can read it in your phone!");
}

void loop() {
  // put your main code here, to run repeatedly:
  if (deviceConnected) {
    //1 open, 2 lock
    if (pCharacteristic->getValue() != lastUserInput) {
      userInput = pCharacteristic->getValue();
      lastUserInput = userInput;
    }
    if (userInput == "OPEN" && state == LOCKED) {
      state = OPENING;
      brightness = 50;
      userInput = "";
    } else if (state == OPENING) {
      long long startTime = millis();
      long long endTime = millis();
      long long delay = endTime - startTime;
      while (state != OPEN && delay < 10000) {
        endTime = millis();
        if (delay > 0) {
          state = OPEN;
        }
        delay = endTime - startTime;
      }
      if (state == OPENING) {
        state = LOCKED;
        brightness = 0;
      } else if (state == OPEN) {
        brightness = 255;
      }
    } else if (userInput == "LOCK" && state == OPEN) {
      state = LOCKING;
      brightness = 50;
      userInput = "";
    } else if (state == LOCKING) {
      brightness = 0;
      state = LOCKED;
    }
    
    /*
    switch (state) {
      case LOCKED:
        brightness = 0;
        state = OPENING;
        break;
      case OPENING:
        state = OPEN;
        brightness = 50;
        break;
      case OPEN:
        state = LOCKING;
        brightness = 255;
        break;
      case LOCKING:
        state = LOCKED;
        brightness = 50;
        break;
    }
    */
    ledcAnalogWrite(LEDC_CHANNEL_0, brightness);
    delay(3000);
  }
  
    // disconnecting
  if (!deviceConnected && oldDeviceConnected) {
    delay(500);
    pServer->startAdvertising();
    oldDeviceConnected = deviceConnected;
    Serial.println("Start advertising");
  }
  // connecting
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
    Serial.println("Device Connected");
  }

}