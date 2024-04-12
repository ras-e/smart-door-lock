#include <stdio.h>
#include "sdkconfig.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/gpio.h"
//#include "esp_bt.h"

#define DELAY (200 / portTICK_PERIOD_MS)
#define PIN (2)

enum State {
    Locked,
    Opening,
    Open,
    Locking
};

void TaskBlink (void *pvParameters)
{
    enum State state = Locked; 
    uint8_t pinState = 0;
    while(1) {
        switch (state) {
            case Locked:
                pinState = 0;
                gpio_set_level(PIN, pinState);
                vTaskDelay(DELAY);
                state = Opening; 
                break;
            case Opening:
                state = Open;
                break;
            case Open:
                pinState = 1;
                gpio_set_level(PIN, pinState);
                vTaskDelay(DELAY);
                state = Locking;
                break;
            case Locking:
                state = Locked; 
                break; 
        }
    }
}

void app_main (void) {
    gpio_reset_pin(PIN);
    gpio_set_direction(PIN, GPIO_MODE_OUTPUT);
    xTaskCreate(TaskBlink, "Blink", 4096, NULL, 1, NULL);
}