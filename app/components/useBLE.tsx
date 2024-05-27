import { useEffect, useRef, useState } from "react";
import { Alert, PermissionsAndroid, Platform } from "react-native";
import {
  BleError,
  BleErrorCode,
  Characteristic,
  Device,
} from "react-native-ble-plx";
import base64 from "react-native-base64";
import { ble_manager } from "./ble_manager";

interface BluetoothLowEnergyApi {
  requestPermissions(): Promise<boolean>;
  scanForPeripherals(): void;
  connectToDevice: (deviceId: Device, password: string) => Promise<void>;
  V3disconnectFromDevice: () => void;
  connectedDevice: Device | null;
  doorStatus: string;
  allDevices: Device[];
  writeLockState(isLocked: boolean): void;
  initialState: boolean;
  authenticate: (password: string) => Promise<boolean>;
  //timer: number;
}

function useBLE(): BluetoothLowEnergyApi {
  const bleManager = ble_manager;
  const deviceName = "";

  const LOCK_UUID = "6f340e06-add8-495c-9da4-ce8558771834";
  const CHAR = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
  //const HEARTBEAT_UUID = "12345678-90ab-cdef-1234-567890abcdef";
  const AUTHZ_UUID = "1e4bae79-843f-4bd6-b6ca-b4c99188cfca";

  const [allDevices, setAllDevices] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [doorStatus, setDoorStatus] = useState<string>("Unknown");
  const [initialState, setInitialState] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  //const [timer, setTime] = useState<number>(0);

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

    const bluetoothConnectPermission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      {
        title: "Location Permission",
        message: "Bluetooth Low Energy requires Location",
        buttonPositive: "OK",
      }
    );

    const fineLocationPermission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: "Location Permission",
        message: "Bluetooth Low Energy requires Location",
        buttonPositive: "OK",
      }
    );

    return (
      bluetoothScanPermission === "granted" &&
      bluetoothConnectPermission === "granted" &&
      fineLocationPermission === "granted"
    );
  };

  const requestPermissions = async () => {
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
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        return await requestAndroid31Permissions();
      }
    } else {
      return true;
    }
  };

  const isDuplicateDevice = (devices: Device[], nextDevice: Device) =>
    devices.findIndex((device) => nextDevice.id === device.id) > -1;

  const scanForPeripherals = () => {
    bleManager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.log(error);
      }

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

  const connectToDevice = async (device: Device, password: string) => {
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
      console.log("Stopped scanning");

      //Delay to ensure connection has been set
      await delay(500);

      // Attempt to authenticate after connecting
      const isAuthenticated = await authenticate(password);
      if (isAuthenticated) {
        console.log("Device authenticated successfully");
        fetchDoorData(deviceConnection); // Initial fetch after successful authentication

        // Set interval to check connection status and fetch data
        intervalHandle = setInterval(async () => {
          const isConnected = await bleManager.isDeviceConnected(device.id);
          if (isConnected) {
            console.log("Current device state: " + isConnected);
            console.log("Fetching data...");
            if (connectedDeviceRef.current) {
              fetchDoorData(connectedDeviceRef.current); // Use the ref here
            }
          } else {
            console.log(
              "Device not connected. Stopping attempts to fetch data."
            );
            clearInterval(intervalHandle); // Clear the interval as soon as the device is not connected
            if (connectedDeviceRef.current) {
              // Check if the disconnection was unexpected
              console.log("Attempting to reconnect...");
              setDoorStatus("Attempting to reconnect...");
              await delay(5000); // Wait for 5 seconds before reconnecting
              connectToDevice(device, password); // Reconnect with password
            }
          }
        }, 1000);
      } else {
        console.log("Authentication failed");
        setConnectedDevice(null); // Clear connected device if authentication fails
        Alert.alert("Authentication Failed", "The password is incorrect.");
      }
    } catch (e) {
      console.error("Failed to connect:", e);
      setConnectedDevice(null); // Ensure the state is cleared on connection failure
    }
  };

  const V3disconnectFromDevice = () => {
    if (connectedDeviceRef.current) {
      bleManager.cancelDeviceConnection(connectedDeviceRef.current.id);
      setConnectedDevice(null);
      setDoorStatus("Disconnected");
      clearInterval(intervalHandle);
    }
  };

  const handleResponse = (characteristic: Characteristic | null) => {
    if (!characteristic?.value) {
      console.log("No data was received");
      return -1;
    }

    const rawData = base64.decode(characteristic.value);
    console.log("Received data:", rawData);

    const isLocked = rawData === "Locked";
    setDoorStatus(isLocked ? "Locked" : "Unlocked");
    //setTime(timer);
    setInitialState(isLocked);
  };

  const fetchDoorData = async (device: Device) => {
    if (device) {
      let char = device.readCharacteristicForService(
        LOCK_UUID,
        CHAR,
        //HEARTBEAT_UUID
      );
      try {
        let c = await char;
        handleResponse(c);
        console.log("--Updating Door Status--");
      } catch (e) {
        if (e instanceof BleError) {
          if (e.errorCode === BleErrorCode.DeviceNotConnected) {
            try {
              setDoorStatus("Device not connected");
              V3disconnectFromDevice();
            } catch (e) {
              setDoorStatus("Error in device connected: " + e);
              console.log(e);
            }
          } else if (e.errorCode === BleErrorCode.DeviceDisconnected) {
            setDoorStatus("Device disconnected: " + e);
          } else {
            setDoorStatus("Unknown BLEError: " + e);
          }
        }
      }
    }
  };

  const writeLockState = async (isLocked: boolean) => {
    if (!connectedDevice || !isAuthenticated) {
      console.log(
        "No device connected or not authenticated to write lock state."
      );
      return;
    }

    const command = isLocked ? "Locked" : "Unlocked";
    const encodedCommand = base64.encode(command);
    try {
      await connectedDevice.writeCharacteristicWithResponseForService(
        LOCK_UUID,
        CHAR,
        encodedCommand
      );
      console.log(
        "Lock state sent successfully:",
        isLocked ? "Locked" : "Unlocked"
      );
    } catch (error) {
      console.error("Failed to write to characteristic:", error);
    }
  };

  const authenticate = async (password: string): Promise<boolean> => {
    if (!connectedDeviceRef.current) {
      console.log("No device connected to authenticate.");
      return false;
    }

    const encodedPassword = base64.encode(password);

    try {
      console.log("write WITH PASSwORD");
      await connectedDeviceRef.current.writeCharacteristicWithResponseForService(
        LOCK_UUID,
        AUTHZ_UUID,
        encodedPassword
      );
      console.log("Read with password first");
      const response =
        await connectedDeviceRef.current.readCharacteristicForService(
          LOCK_UUID,
          AUTHZ_UUID
        );
      //fetchDoorData(connectedDeviceRef.current)
      if (response.value === null) {
        console.log("No response received for authentication.");
        return false;
      }

      //Decode and Verify Response
      //if it matches "Authenticated", the function updates the isAuthenticated state to true or false
      const decodedResponse = base64.decode(response.value);

      if (decodedResponse === "Authenticated") {
        setIsAuthenticated(true);
        console.log("Authentication successful");
        return true;
      } else {
        console.log("Authentication failed");
        return false;
      }
    } catch (error) {
      console.error("Authentication error:", error);
      return false;
    }
  };

  return {
    scanForPeripherals,
    requestPermissions,
    connectToDevice,
    allDevices,
    connectedDevice,
    V3disconnectFromDevice,
    doorStatus,
    writeLockState,
    initialState,
    authenticate,
    //timer,
  };
}

export default useBLE;
