import { useEffect, useMemo, useState } from "react";
import { Alert, PermissionsAndroid, Platform } from "react-native";
import {
  BleError,
  BleErrorCode,
  Characteristic,
  Device,
} from "react-native-ble-plx";
import base64 from "react-native-base64";
import { ble_manager } from "./ble_manager";

import * as ExpoDevice from "expo-device";

interface BluetoothLowEnergyApi {
  requestPermissions(): Promise<boolean>;
  scanForPeripherals(): void;
  connectToDevice: (deviceId: Device) => Promise<void>;
  V3disconnectFromDevice: () => void;
  // monitorLockStatus(): void;

  connectedDevice: Device | null;

  doorStatus: string;

  allDevices: Device[];
}

function useBLE(): BluetoothLowEnergyApi {
  const bleManager = ble_manager;
  //const bleManager = useMemo(() => new BleManager(), []);

  //Device name, e.g., Smart Lock
  const deviceName = "";
  // UUID's for CUSTOM UUID
   const LOCK_UUID = "00001111-0000-1000-8000-00805F9B34FB";
   const CHAR = "00002222-0000-1000-8000-00805F9B34FB";


  const [allDevices, setAllDevices] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [doorStatus, setDoorStatus] = useState<string>("Unknown");

  let intervalHandle: ReturnType<typeof setTimeout>;

  const requestAndroid31Permissions = async () => {
    const bluetoothScanPermission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      {
        title: "Location Permission",
        message: "Bluetooth Low Energy requires Location",
        buttonPositive: "OK",
      }
    );
    console.log(
      `BLUETOOTH_SCAN permission granted: ${
        bluetoothScanPermission === PermissionsAndroid.RESULTS.GRANTED
      }`
    );

    const bluetoothConnectPermission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      {
        title: "Location Permission",
        message: "Bluetooth Low Energy requires Location",
        buttonPositive: "OK",
      }
    );
    console.log(
      `BLUETOOTH_CONNECT permission granted: ${
        bluetoothConnectPermission === PermissionsAndroid.RESULTS.GRANTED
      }`
    );

    const fineLocationPermission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: "Location Permission",
        message: "Bluetooth Low Energy requires Location",
        buttonPositive: "OK",
      }
    );
    console.log(
      `fineLocationPermission permission granted: ${
        fineLocationPermission === PermissionsAndroid.RESULTS.GRANTED
      }`
    );

    return (
      bluetoothScanPermission === "granted" &&
      bluetoothConnectPermission === "granted" &&
      fineLocationPermission === "granted"
    );
  };

  const requestPermissions = async () => {
    //Need to check Android API level
    console.log("Requesting permissions");
    if (Platform.OS === "ios") {
      return true;
    }

    if (Platform.OS === "android") {
      console.log(
        `Detected Android API level: ${ExpoDevice.platformApiLevel ?? -1}`
      );
      if ((ExpoDevice.platformApiLevel ?? -1) < 31) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: "Location Permission",
            message: "Bluetooth Low Energy requires Location",
            buttonPositive: "OK",
          }
        );
        const result = granted === PermissionsAndroid.RESULTS.GRANTED;
        console.log(`ACCESS_FINE_LOCATION permission granted: ${result}`);
        return result;
        //return granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        const isAndroid31PermissionsGranted =
          await requestAndroid31Permissions();

        return isAndroid31PermissionsGranted;
      }
    } else {
      return true;
    }
  };

  //Check for duplicates in the list - plx does not always filter
  const isDuplicateDevice = (devices: Device[], nextDevice: Device) =>
    devices.findIndex((device) => nextDevice.id === device.id) > -1;

  const scanForPeripherals = () => {
    console.log("starts to scan");
    bleManager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.log(error);
      }

      //Device name reference
      if (device && device.name?.includes(deviceName)) {
        setAllDevices((prevState: Device[]) => {
          if (!isDuplicateDevice(prevState, device)) {
            return [...prevState, device];
          }
          return prevState;
        });
      }
    });
  };

  const connectToDevice = async (device: Device) => {
    try {
      console.log(`Attempting to connect to device with ID: ${device.id}`);
      console.log(`Service UUID: ${LOCK_UUID}`);
      console.log(`Characteristic UUID: ${CHAR}`);
      //Pairs the device
      const deviceConnection = await bleManager.connectToDevice(device.id);
      console.log(`Connected to device with ID: ${deviceConnection.id}`);

      setConnectedDevice(deviceConnection);
      console.log("connectedToDevice" + connectedDevice?.id);

      console.log(
        `Discovered services and characteristics for device with ID: ${deviceConnection.id}`
      );
  
      //Discover
      await deviceConnection.discoverAllServicesAndCharacteristics();

      // Util function - to be moved
      const services = await deviceConnection.services();

      const serviceUUIDs = services.map(service => service.uuid).join(", ");
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
      }
      //Stop device scan
      await bleManager.stopDeviceScan();
      console.log("Device scan stopped after connection.");

      console.log("device connected");
      console.log("fetched first time");
      V2fetchData(deviceConnection);

      clearInterval(intervalHandle);
      console.log("Cleared any existing interval.");

      intervalHandle = setInterval(() => {
        //console.log("Interval tick for device:", device.id);
        V2fetchData(deviceConnection);
      }, 5000);
      console.log("New interval set");
    } catch (e) {
      console.log("FAILED TO CONNECT", e);
      Alert.alert("Connection Error", "Failed to connect to device");
    }
  };


  const V3disconnectFromDevice = () => {
    if (connectedDevice) {
      console.log("Disconnection initiated for device ID:", connectedDevice.id);
      bleManager.cancelDeviceConnection(connectedDevice.id);
      setConnectedDevice(null); // Update state immediately
      clearInterval(intervalHandle);
    }
  };

  const handleResponse = (response: Characteristic | null) => {
    if (!response?.value) {
      console.log("error");
    } else {
      const decodedValue = base64.decode(response.value);
      console.log("Received data:", decodedValue);
      return;
    }
  };

  const V2fetchData = async (device: Device) => {
    if (device) {
      console.log(device.id);
      console.log(connectedDevice?.id);
      let response = device.readCharacteristicForService(LOCK_UUID, CHAR);
      try {
        console.log(`Fetching data from device with ID: ${device.id}`);
        console.log(`Service UUID: ${LOCK_UUID}`);
        console.log(`Characteristic UUID: ${CHAR}`);
        let value = await response;
        handleResponse(value);

      } catch (e) {
        if (e instanceof BleError) {
          if (e.errorCode === BleErrorCode.DeviceNotConnected) {
            console.log("disconnected status");

            try {
              V3disconnectFromDevice();
            } catch (e) {
              console.log("error", e);
            }
          } else if (e.errorCode === BleErrorCode.DeviceDisconnected) {
            setDoorStatus("Device disconnected: " + e);
          } else {
            setDoorStatus("Unknown BLE Error: " + e);
          }
        } else if (e instanceof Error) {
          console.log("Error:", e.message);
        } else {
          console.log("An unexpected error occurred");
        }
      }
    }
  };

  return {
    scanForPeripherals,
    requestPermissions,
    connectToDevice,
    allDevices,
    connectedDevice,
    V3disconnectFromDevice,
    //monitorLockStatus,
    doorStatus,
  };
}

export default useBLE;
