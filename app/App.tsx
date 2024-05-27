import React, { useEffect, useState } from "react";
import {
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import DeviceModal from "./components/DeviceModal";
import useBLE from "./components/useBLE";
import LockButton from "./components/LockButton";
import PasswordModal from "./components/PasswordModal";
import { Device } from "react-native-ble-plx";

export default function App() {
  const {
    requestPermissions,
    scanForPeripherals,
    connectToDevice,
    V3disconnectFromDevice,
    allDevices,
    connectedDevice,
    doorStatus,
    writeLockState,
  } = useBLE();

  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [isPasswordModalVisible, setIsPasswordModalVisible] =
    useState<boolean>(false); // Password modal state
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasValidStatus, setHasValidStatus] = useState<boolean>(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null); // State to hold selected device

  useEffect(() => {
    if (connectedDevice) {
      console.log("Device connected with ID: ", connectedDevice.id);
      setIsLoading(true);
      setIsPasswordModalVisible(true); // Show password modal when a device is connected
    } else {
      console.log("No device is connected.");
      setIsLoading(false);
      setHasValidStatus(false);
    }
  }, [connectedDevice]);

  useEffect(() => {
    console.log("CONNECTED DEVICE STATUS CHANGED:", connectedDevice?.name);
    if (connectedDevice) {
      setIsLoading(false);
      setHasValidStatus(true);
    }
  }, [connectedDevice, doorStatus]);

  const hideModal = () => {
    setIsModalVisible(false);
    setIsLoading(false);
  };

  const openModal = async () => {
    setIsLoading(true);
    const isPermissionsEnabled = await requestPermissions();
    if (isPermissionsEnabled) {
      scanForPeripherals();
      setIsModalVisible(true);
    } else {
      Alert.alert(
        "Permission Error",
        "Bluetooth permissions are required to connect devices."
      );
      setIsLoading(false);
    }
  };

  const handleAuthenticate = async (password: string) => {
    if (selectedDevice) {
      await connectToDevice(selectedDevice, password);
      setIsPasswordModalVisible(false);
    }
  };

  const handleDeviceSelection = async (device: Device) => {
    setSelectedDevice(device);
    setIsModalVisible(false);
    setIsPasswordModalVisible(true); // Show password modal for selected device
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.TitleWrapper}>
        {connectedDevice && hasValidStatus ? (
          <>
            <Text style={styles.TitleText}>The door status is</Text>
            <Text style={styles.statusText}>{doorStatus}</Text>
            <LockButton
              writeLockState={writeLockState}
              initialState={doorStatus === "Locked"}
            />
          </>
        ) : (
          <>
            <Text style={styles.TitleText}>
              {isLoading ? "Loading..." : "Please Connect to a Smart Lock"}
            </Text>
            {isLoading && <ActivityIndicator size="large" color="#FFF" />}
          </>
        )}
      </View>

      <TouchableOpacity
        onPress={connectedDevice ? V3disconnectFromDevice : openModal}
        style={
          connectedDevice ? styles.ctaButtonDisconnect : styles.ctaButtonConnect
        }
      >
        <Text style={styles.ctaButtonText}>
          {connectedDevice ? "Disconnect" : "Connect"}
        </Text>
      </TouchableOpacity>

      <DeviceModal
        closeModal={hideModal}
        visible={isModalVisible}
        connectToPeripheral={handleDeviceSelection} // Updated to handle device selection
        devices={allDevices}
      />

      <PasswordModal
        visible={isPasswordModalVisible}
        onAuthenticate={handleAuthenticate}
        onClose={() => setIsPasswordModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  TitleWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 60,
  },
  TitleText: {
    fontSize: 30,
    fontWeight: "bold",
    textAlign: "center",
    marginHorizontal: 20,
    color: "white",
  },
  statusText: {
    fontSize: 25,
    marginTop: 15,
    color: "white",
  },
  ctaButtonDisconnect: {
    backgroundColor: "#FF6060",
    justifyContent: "center",
    alignItems: "center",
    height: 50,
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 8,
  },
  ctaButtonConnect: {
    backgroundColor: "#50C878",
    justifyContent: "center",
    alignItems: "center",
    height: 50,
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 8,
  },
  ctaButtonText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
  },
});
