import { useEffect, useMemo, useRef, useState } from "react";
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
  connectedDevice: Device | null;
  doorStatus: string;
  allDevices: Device[];
  writeLockState(isLocked: boolean): void;
  initialState: Boolean;

  //setDoorState: (openDoor: boolean) => void;

  // monitorLockStatus(): void;
}

function useBLE(): BluetoothLowEnergyApi {
  const bleManager = ble_manager;
  //const bleManager = useMemo(() => new BleManager(), []);

  //Device name, e.g., Smart Lock
  const deviceName = "";

  // UUID's for CUSTOM UUID 0000181C-0000-1000-8000-00805F9B34FB

/*   const LOCK_UUID = "0000180D-0000-1000-8000-00805F9B34FB";
  const CHAR = "00002A38-0000-1000-8000-00805F9B34FB"; */

  
    //-- Our Smart Lock Door UUID's
  const LOCK_UUID = "6f340e06-add8-495c-9da4-ce8558771834";
  const CHAR = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

  const [allDevices, setAllDevices] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [doorStatus, setDoorStatus] = useState<string>("Unknown");
  const [initialState, setInitialState] = useState<Boolean>(false);


  const connectedDeviceRef = useRef<Device | null>(null);

  useEffect(() => {
    connectedDeviceRef.current = connectedDevice;
  }, [connectedDevice]);

  let intervalHandle: ReturnType<typeof setTimeout>;

  const delay = (ms: number | undefined) =>
    new Promise((resolve) => setTimeout(resolve, ms));

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
      const apiLevel = parseInt(Platform.Version.toString(), 10);
      if (apiLevel < 31) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: "Location Permission",
            message: "Bluetooth Low Energy requires Location",
            buttonPositive: "OK",
          }
        );
        console.log("ACCESS_FINE_LOCATION GRANTED", granted);
        return granted === PermissionsAndroid.RESULTS.GRANTED;
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
    console.log("Scanning....");
    bleManager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.log(error);
      }

      //DeviceName reference
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
      clearInterval(intervalHandle); // Ensure any existing interval is cleared before starting a new connection attempt
      const deviceConnection = await bleManager.connectToDevice(device.id);
      if (!deviceConnection) {
        console.error("Failed to connect to device:", device.id);
        return; // Exit if no device connection could be established
      }
      setConnectedDevice(deviceConnection);
      await deviceConnection.discoverAllServicesAndCharacteristics();
      bleManager.stopDeviceScan(); // Stop scanning as soon as a connection is established
      console.log("stopped scanning");

      console.log("--Fetched first time--");
      fetchDoorData(deviceConnection); // Initial fetch

      intervalHandle = setInterval(async () => {
        const isConnected = await bleManager.isDeviceConnected(device.id);
        if (isConnected) {
          console.log("Current device state: " + isConnected);
          console.log("Fetching data...");
          //fetchDoorData(deviceConnection); // Use the direct deviceConnection reference here
          if (connectedDeviceRef.current) {
            fetchDoorData(connectedDeviceRef.current); // Use the ref here
          }
        } else {
          console.log("Device not connected. Stopping attempts to fetch data.");
          clearInterval(intervalHandle); // Clear the interval as soon as the device is not connected
          if (connectedDeviceRef.current) {
            // Check if the disconnection was unexpected

            console.log("Attempting to reconnect...");
            setDoorStatus("Attempting to reconnect...");
            await delay(2000); // Wait for 5 seconds before reconnecting
            connectToDevice(device);
          }
        }
      }, 10000);
    } catch (e) {
      console.error("Failed to connect:", e);
      setConnectedDevice(null); // Ensure the state is cleared on connection failure
    }
  };

  const V3disconnectFromDevice = () => {
    if (connectedDeviceRef.current) {
      console.log(
        "Disconnection initiated for device ID:",
        connectedDeviceRef.current.id
      );

      bleManager.cancelDeviceConnection(connectedDeviceRef.current.id);
      setConnectedDevice(null);
      setDoorStatus("Disconnected");
      clearInterval(intervalHandle);
    }
  };

  const handleResponse = (characteristic: Characteristic | null) => {
    if (!characteristic?.value) {
      console.log("No Data was recieved");
      return -1;
    }

    const rawData = base64.decode(characteristic.value);
    console.log("Received data:", rawData);

    //const doorIsOpen = rawData.charCodeAt(0) == 0x01;

    //const isLocked = rawData === "Locked";

    //const isLocked = rawData === "Locked";
    //Determine if the lock is in the "Locked" state
    const isLocked = rawData === "Locked"; // 

    // Set the door status based on whether the lock is locked or unlocked
    setDoorStatus(isLocked ? "Locked" : "Unlocked");

    // Set the initial state as true if locked, false otherwise
    setInitialState(isLocked);
  };

  const fetchDoorData = async (device: Device) => {
    if (device) {
      let char = device.readCharacteristicForService(LOCK_UUID, CHAR);
      try {
        let c = await char;
        handleResponse(c);
        console.log("--Updating Door Status--");
      } catch (e) {
        if (e instanceof BleError) {
          if (e.errorCode == BleErrorCode.DeviceNotConnected) {
            try {
              setDoorStatus("Device not connected");
              console.log("Disconnect error in fetch");
              V3disconnectFromDevice();
            } catch (e) {
              setDoorStatus("Error in device connected: " + e);
              console.log(e);
            }
          } else if (e.errorCode == BleErrorCode.DeviceDisconnected) {
            setDoorStatus("Device disconnected: " + e);
          } else {
            setDoorStatus("Unkown BLEError: " + e);
          }
        }
      }
    }
  };

  const writeLockState = async (isLocked: boolean) => {
    if (!connectedDevice) {
      console.log("No device connected to write lock state.");
      return;
    }

    const command = isLocked ? "Locked" : "Unlocked"; // Command to lock or unlock
    const encodedCommand = base64.encode(command);
    try {
      await connectedDevice.writeCharacteristicWithResponseForService(
        LOCK_UUID,
        CHAR,
        encodedCommand
      );
      fetchDoorData(connectedDevice);
      console.log(
        "Lock state sent successfully:",
        isLocked ? "Locked" : "Unlocked"
      );
    } catch (error) {
      console.error("Failed to write to characteristic:", error);
    }
  };

/*   const fetchInitialState = async (device: Device) => {
    try {
      const characteristic = await device.readCharacteristicForService(
        LOCK_UUID,
        CHAR
      );
      const valueDecoded = base64.decode(characteristic.value);
      const isLocked = valueDecoded === "01"; // Assuming "01" means locked
      setInitialLockState(isLocked);
    } catch (error) {
      console.error("Failed to fetch initial lock state:", error);
      setInitialLockState(false); // Default or handle error appropriately
    }
  }; */

  return {
    scanForPeripherals,
    requestPermissions,
    connectToDevice,
    allDevices,
    connectedDevice,
    V3disconnectFromDevice,
    //monitorLockStatus,
    doorStatus,
    writeLockState,
    initialState
  };
}

export default useBLE;
