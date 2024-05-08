// bleServiceUtils.ts
import { Device } from "react-native-ble-plx";
import { ble_manager } from "../components/ble_manager";

/**
 * Fetches and logs the service and characteristic UUIDs for a specific service UUID.
 * This function is intended to be used with BLE devices to help identify and log available
 * services and characteristics.
 * Most importantly it will reduce the code in the main component.
 *
 * @param device The connected BLE device to query.
 * @param targetServiceUUID The target service UUID to find and log characteristics for.
 */


export async function logServiceDetails(
  device: Device,
  targetServiceUUID: string
): Promise<void> {
  console.log(
    `Discovered services and characteristics for device with ID: ${device.id}`
  );

  await device.discoverAllServicesAndCharacteristics();
  const services = await device.services();
  const serviceUUIDs = services.map((service) => service.uuid).join(", ");
  console.log("Service UUIDs: " + serviceUUIDs);

  const targetService = services.find((s) => s.uuid === targetServiceUUID);
  if (targetService) {
    const characteristics = await targetService.characteristics();
    const characteristicUUIDs = characteristics.map((c) => c.uuid).join(", ");
    console.log(
      "Characteristic UUIDs for " +
        targetServiceUUID +
        ": " +
        characteristicUUIDs
    );
  } else {
    console.log("No service found with UUID: " + targetServiceUUID);
  }
}

/* export async function checkBluetoothEnabled() {
  try {
    const isEnabled = await bleManager.isBluetoothEnabled();
    console.log("Is Bluetooth Enabled: ", isEnabled);
    return isEnabled;
  } catch (error) {
    console.error("Error checking Bluetooth status:", error);
    return false;
  }
} */

      // Util function - to be moved
      //const services = await deviceConnection.services();
      /* 
      const serviceUUIDs = services.map((service) => service.uuid).join(", ");
      console.log("Service UUIDs: " + serviceUUIDs);

      if (services.length > 0) {
        const service = services.find((s) => s.uuid === LOCK_UUID);
        if (service) {
          const characteristics = await service.characteristics();
          const characteristicUUIDs = characteristics
            .map((c) => c.uuid)
            .join(", ");
          console.log(
            "Characteristic UUIDs for " + LOCK_UUID + ": " + characteristicUUIDs
          );
        } else {
          console.log("No service found with UUID: " + LOCK_UUID);
        }
      } */

