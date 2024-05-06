#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

BLEServer* pServer = NULL;
BLECharacteristic* pSensorCharacteristic = NULL;
BLECharacteristic* pStateCharacteristic = NULL;
BLECharacteristic* pLedCharacteristic = NULL;
bool deviceConnected = false;
bool oldDeviceConnected = false;
uint32_t value = 0;

const int ledPin = 2; // Use the appropriate GPIO pin for your setup

#define SERVICE_UUID        "6f340e06-add8-495c-9da4-ce8558771834"
#define SENSOR_CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define LED_CHARACTERISTIC_UUID "19b10002-e8f2-537e-4f6c-d104768a1214"
#define STATE_CHARACTERISTIC_UUID "fab2345e-36e1-4688-b7f5-ff0001234567"

enum State {
    LOCKED,
    OPENING,
    OPEN,
    LOCKING
};

State lockState = LOCKED;

class MyServerCallbacks : public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
        deviceConnected = true;
    };

    void onDisconnect(BLEServer* pServer) {
        deviceConnected = false;
    }
};

class MyStateCharacteristicCallbacks : public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic* pCharacteristic) {
        std::string value = pCharacteristic->getValue();
        if (!value.empty()) {
            int newState = value[0] - '0';
            if(newState >= LOCKED && newState <= LOCKING) {
                lockState = static_cast<State>(newState);
                Serial.println("State updated to: " + String(newState));
                updateLED();
            }
        }
    }
};

void updateLED() {
    switch (lockState) {
        case LOCKED:
            analogWrite(ledPin, 0);
            break;
        case OPENING:
            analogWrite(ledPin, 85);
            break;
        case OPEN:
            analogWrite(ledPin, 170);
            break;
        case LOCKING:
            analogWrite(ledPin, 255);
            break;
    }
}

void setup() {
    Serial.begin(115200);
    pinMode(ledPin, OUTPUT);

    // Create the BLE Device
    BLEDevice::init("ESP32");

    // Create the BLE Server
    pServer = BLEDevice::createServer();
    pServer->setCallbacks(new MyServerCallbacks());

    // Create the BLE Service
    BLEService *pService = pServer->createService(SERVICE_UUID);

    // Create a BLE Characteristic for sensor data
    pSensorCharacteristic = pService->createCharacteristic(
                      SENSOR_CHARACTERISTIC_UUID,
                      BLECharacteristic::PROPERTY_READ |
                      BLECharacteristic::PROPERTY_NOTIFY
                    );

    // Create a BLE Characteristic for LED control
    pLedCharacteristic = pService->createCharacteristic(
                      LED_CHARACTERISTIC_UUID,
                      BLECharacteristic::PROPERTY_WRITE
                    );

    // Create a BLE Characteristic for lock state
    pStateCharacteristic = pService->createCharacteristic(
                      STATE_CHARACTERISTIC_UUID,
                      BLECharacteristic::PROPERTY_WRITE
                    );
    pStateCharacteristic->setCallbacks(new MyStateCharacteristicCallbacks());

    pSensorCharacteristic->addDescriptor(new BLE2902());
    pLedCharacteristic->addDescriptor(new BLE2902());
    pStateCharacteristic->addDescriptor(new BLE2902());

    // Start the service
    pService->start();

    // Start advertising
    BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(SERVICE_UUID);
    pAdvertising->setScanResponse(false);
    pAdvertising->setMinPreferred(0x0);  // set value to 0x00 to not advertise this parameter
    BLEDevice::startAdvertising();
    Serial.println("Waiting for a client connection to notify...");
}

void loop() {
    // notify changed value
    if (deviceConnected) {
        pSensorCharacteristic->setValue(String(value).c_str());
        pSensorCharacteristic->notify();
        value++;
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
