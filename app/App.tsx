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
import useBLE from "./components/useBLE2";
import LockButton from "./components/LockButton";

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
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasValidStatus, setHasValidStatus] = useState<boolean>(false);

  useEffect(() => {
    if (connectedDevice) {
      console.log("Device connected with ID: ", connectedDevice.id);
      setIsLoading(true); // Remain in loading state until valid status is confirmed
    } else {
      console.log("No device is connected.");
      setIsLoading(false);
      setHasValidStatus(false);
    }
  }, [connectedDevice]);

  useEffect(() => {
    console.log("CONNECTED DEVICE STATUS CHANGED:", connectedDevice?.name);
    if (
      connectedDevice 
      // && (doorStatus === "Locked" || doorStatus === "Unlocked" || "")
    ) {
      setIsLoading(false);
      setHasValidStatus(true);
    }
  }, [connectedDevice, doorStatus]);

  const hideModal = () => {
    setIsModalVisible(false);
    setIsLoading(false);
  }

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
      setIsLoading(false); // Ensure to stop loading on permission error
    }
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
        connectToPeripheral={connectToDevice}
        devices={allDevices}
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
