import { useEffect, useMemo, useState } from "react";
import { Alert, PermissionsAndroid, Platform } from "react-native";
import {
  BleError,
  BleManager,
  Device,
} from "react-native-ble-plx";
import base64 from 'react-native-base64';

import * as ExpoDevice from "expo-device";

interface BluetoothLowEnergyApi {
    requestPermissions(): Promise<boolean>;
    scanForPeripherals(): void;
    connectToDevice: (deviceId: Device) => Promise<void>;
    disconnectFromDevice: () => void;
   // monitorLockStatus(): void;
   
    
    
    
   // doorStatus: string;
    connectedDevice: Device | null;
    allDevices: Device[];
}

function useBLE(): BluetoothLowEnergyApi {
    //Device name, e.g., Smart Lock
    const deviceName = '';
    const LOCK_UUID = '5BC80EC4-C256-4817-A214-7C7752918BD0';
    const STATUS_CHAR = '';

    const bleManager = useMemo(() => new BleManager(), []);
    const [allDevices, setAllDevices] = useState<Device[]>([]);
    const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
    const [doorStatus, setDoorStatus] = useState<string>("Unknown");

  
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
    //Need to check Android API level
    if (Platform.OS === "android") {
      if ((ExpoDevice.platformApiLevel ?? -1) < 31) {
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

  const scanForPeripherals = () =>
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

  const connectToDevice = async (device: Device) => {
    try {
      const deviceConnection = await bleManager.connectToDevice(device.id);
      setConnectedDevice(deviceConnection);
      await deviceConnection.discoverAllServicesAndCharacteristics();
      //var data = await deviceConnection.discoverAllServicesAndCharacteristics();

      bleManager.stopDeviceScan();
      //getData(deviceConnection);
    } catch (e) {
      console.log("FAILED TO CONNECT", e);
      Alert.alert("Connection Error", "Failed to connect to device");
    }
  };
/*
  useEffect(() => {
        if (connectedDevice) {
            const unsubscribe = monitorLockStatus();
            return () => unsubscribe();
        }
    }, [connectedDevice]);
*/
  


  const disconnectFromDevice = () => {
    if (connectedDevice) {
      bleManager.cancelDeviceConnection(connectedDevice.id).then(() => {
        setConnectedDevice(null)
        setDoorStatus("Disconnected")
        
      }).catch(e => {
        console.error("Disconnect failed", e);
      })
    }
  };

  //Subscription on characteristics of device
  // For battery utilization an option is read.. instead of monitor
  /*const monitorLockStatus = () => {
    if (connectedDevice) {
      const subscription = connectedDevice.monitorCharacteristicForService(
        LOCK_UUID,
        STATUS_CHAR,
          (error, characteristic) => {
            if (error) {
              console.error("Error monitoring lock status:", error);
                return;
              }
              if (characteristic?.value) {
                const decodedStatus = base64.decode(characteristic.value);
                setDoorStatus(decodedStatus);
              }
          }
      );
      return () => subscription.remove();
    }
    return () => {};
  }; 
  */

  //Alternative monitor with useEffect
  // This useEffect is triggered whenever the connectedDevice state changes.
 /*  useEffect(() => {
      if (connectedDevice) {
          const monitor = async () => {
              try {
                  // Subscribe to changes on a specific characteristic of the connected device.
                  const subscription = await connectedDevice.monitorCharacteristicForService(
                      LOCK_UUID,
                      STATUS_CHAR,
                      (error, characteristic) => {  // Callback function
                          if (error) {
                              console.error("Monitoring error:", error);
                              return;
                          }
                          if (characteristic?.value) { // Valid value?
                              const decodedStatus = base64.decode(characteristic.value);
                              // Update the door status state with the new value from the device.
                              setDoorStatus(decodedStatus);
                          }
                      }
                  );
                  // Cleanup
                  return () => subscription.remove();
              } catch (e) {
                  console.error("Failed to subscribe", e);
              }
          };
          const unsubscribe = monitor();
          // Return a cleanup function from useEffect, which ensures that the subscription is 
          // removed when the connectedDevice changes state
          return () => {
              unsubscribe.then(remove => remove());
          };
      }
  }, [connectedDevice]); */

  return {
    scanForPeripherals,
    requestPermissions,
    connectToDevice,
    allDevices,
    connectedDevice,
    disconnectFromDevice,
    //monitorLockStatus,
  };

}

export default useBLE;