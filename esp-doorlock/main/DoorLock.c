#include <stdio.h>
#include "sdkconfig.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/gpio.h"
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <BLE2902.h>

#define BLE_SERVICE_UUID        "91bad492-b950-4226-aa2b-4ede9fa42f59"
#define BLE_CHARACTERISTIC_UUID "cba1d466-344c-4be3-ab3f-189f80dd7518"

// GPIO pin definitions
#define RED_LED_PIN 2     // Red LED for Locked state
#define GREEN_LED_PIN 15  // Green LED for Unlocked state

enum State {
    Locked,
    Unlocked
};

State lockState = Locked;

// Setup callbacks for BLE events
class MyCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
        std::string value = pCharacteristic->getValue();
        if (value == "unlock") {
            lockState = Unlocked;
        } else if (value == "lock") {
            lockState = Locked;
        }
    }
};

void setupBLE() {
    BLEDevice::init("SmartLock");
    BLEServer *pServer = BLEDevice::createServer();
    BLEService *pService = pServer->createService(BLE_SERVICE_UUID);
    BLECharacteristic *pCharacteristic = pService->createCharacteristic(
                                         BLE_CHARACTERISTIC_UUID,
                                         BLECharacteristic::PROPERTY_READ | 
                                         BLECharacteristic::PROPERTY_WRITE |
                                         BLECharacteristic::PROPERTY_NOTIFY
                                       );
    pCharacteristic->setCallbacks(new MyCallbacks());
    pCharacteristic->setValue("Locked");
    pService->start();

    BLEAdvertising *pAdvertising = pServer->getAdvertising();
    pAdvertising->addServiceUUID(BLE_SERVICE_UUID);
    pAdvertising->start();
}

void setupGPIO() {
    gpio_reset_pin(RED_LED_PIN);
    gpio_set_direction(RED_LED_PIN, GPIO_MODE_OUTPUT);
    gpio_reset_pin(GREEN_LED_PIN);
    gpio_set_direction(GREEN_LED_PIN, GPIO_MODE_OUTPUT);
}

void app_main() {
    setupBLE();
    setupGPIO();
    while(1) {
        if (lockState == Locked) {
            gpio_set_level(RED_LED_PIN, 1);    // Turn on RED LED
            gpio_set_level(GREEN_LED_PIN, 0);  // Turn off GREEN LED
        } else if (lockState == Unlocked) {
            gpio_set_level(RED_LED_PIN, 0);    // Turn off RED LED
            gpio_set_level(GREEN_LED_PIN, 1);  // Turn on GREEN LED
        }
        vTaskDelay(pdMS_TO_TICKS(1000)); // Delay to reduce CPU usage
    }
}
