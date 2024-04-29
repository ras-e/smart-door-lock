#include <stdio.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "nvs_flash.h"
#include "esp_bt.h"
#include "esp_bt_main.h"
#include "esp_gatt_common_api.h"
#include "esp_gap_ble_api.h"
#include "esp_gatts_api.h"
#include "esp_log.h"
#include "driver/gpio.h"

#define GATTS_SERVICE_UUID   0x00FF
#define GATTS_CHAR_UUID_LOCK 0xFF01
#define GATTS_NUM_HANDLE     4

#define RED_LED_PIN 2
#define GREEN_LED_PIN 15
#define DEVICE_NAME "SmartLock"

#define PREPARE_BUF_MAX_SIZE 1024

static uint8_t adv_config_done = 0;
static uint8_t raw_adv_data[] = {
    /* Flags */
    0x02, 0x01, 0x06,
    /* Complete List of 16-bit Service Class UUIDs */
    0x03, 0x03, 0xFF, 0x00 
};

static esp_ble_adv_params_t adv_params = {
    .adv_int_min       = 0x20,
    .adv_int_max       = 0x40,
    .adv_type          = ADV_TYPE_IND,
    .own_addr_type     = BLE_ADDR_TYPE_PUBLIC,
    .channel_map       = ADV_CHNL_ALL,
    .adv_filter_policy = ADV_FILTER_ALLOW_SCAN_ANY_CON_ANY,
};

typedef struct {
    uint8_t *prepare_buf;
    int      prepare_len;
} prepare_type_env_t;

static prepare_type_env_t prepare_write_env;

enum {
    LOCKED,
    UNLOCKED
} lock_state;

static void gatts_profile_event_handler(esp_gatts_cb_event_t event,
                                        esp_gatt_if_t gatts_if,
                                        esp_ble_gatts_cb_param_t *param);

static void gap_event_handler(esp_gap_ble_cb_event_t event, esp_ble_gap_cb_param_t *param) {
    switch (event) {
        case ESP_GAP_BLE_ADV_DATA_SET_COMPLETE_EVT:
            esp_ble_gap_start_advertising(&adv_params);
            break;
        case ESP_GAP_BLE_SCAN_RSP_DATA_SET_COMPLETE_EVT:
            // Handle scan response data set complete event
            break;
        case ESP_GAP_BLE_ADV_START_COMPLETE_EVT:
            // Check if advertising started successfully
            if (param->adv_start_cmpl.status != ESP_BT_STATUS_SUCCESS) {
                ESP_LOGE(DEVICE_NAME, "Advertising start failed");
            }
            break;
        default:
            break;
    }
}


void set_lock_state(bool lock) {
    lock_state = lock ? LOCKED : UNLOCKED;
    gpio_set_level(RED_LED_PIN, lock);
    gpio_set_level(GREEN_LED_PIN, !lock);
    ESP_LOGI(DEVICE_NAME, "Lock state: %s", lock ? "LOCKED" : "UNLOCKED");
}

static void esp_gatts_cb(esp_gatts_cb_event_t event, 
                         esp_gatt_if_t gatts_if, 
                         esp_ble_gatts_cb_param_t *param) {
    switch (event) {
    case ESP_GATTS_WRITE_EVT:
        if (!param->write.is_prep) {
            if (param->write.value[0] == 0x00) {
                set_lock_state(true);  // Lock
            } else if (param->write.value[0] == 0x01) {
                set_lock_state(false); // Unlock
            }
        }
        break;
    default:
        break;
    }
}

void app_main(void) {
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    esp_bt_controller_config_t bt_cfg = BT_CONTROLLER_INIT_CONFIG_DEFAULT();
    ret = esp_bt_controller_init(&bt_cfg);
    ESP_ERROR_CHECK(ret);

    ret = esp_bt_controller_enable(ESP_BT_MODE_BLE);
    ESP_ERROR_CHECK(ret);

    ret = esp_bluedroid_init();
    ESP_ERROR_CHECK(ret);

    ret = esp_bluedroid_enable();
    ESP_ERROR_CHECK(ret);

    esp_ble_gap_register_callback(gap_event_handler);
    esp_ble_gatts_register_callback(esp_gatts_cb);

    // Initialize LEDs
    gpio_reset_pin(RED_LED_PIN);
    gpio_set_direction(RED_LED_PIN, GPIO_MODE_OUTPUT);
    gpio_reset_pin(GREEN_LED_PIN);
    gpio_set_direction(GREEN_LED_PIN, GPIO_MODE_OUTPUT);

    set_lock_state(true); // Start as locked
}
