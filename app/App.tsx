import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DeviceModal from './components/DeviceModal';
import useBLE from './components/useBLE';
import LockButton from './components/LockButton';

export default function App() {
  const {
    requestPermissions,
    scanForPeripherals,
    connectToDevice,
    V2disconnectFromDevice,
    allDevices,
    connectedDevice,
  } = useBLE();
  
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);

  const hideModal = () => {
    setIsModalVisible(false);
  };

  const openModal = async () => {
    await requestPermissions();
    scanForPeripherals();
    setIsModalVisible(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.TitleWrapper}>

        {connectedDevice ? (
          <>
            <Text style={styles.TitleText}>The door status is</Text>
            <Text style={styles.statusText}>Status</Text>
             <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <LockButton />
    </SafeAreaView>
          </>
        ) : (

          <Text style={styles.TitleText}>
            Please Connect to a Smart lock
          </Text>
        )}
      </View>

      <TouchableOpacity
        onPress={connectedDevice ? V2disconnectFromDevice : openModal}
        style={connectedDevice ? styles.ctaButtonDisconnect : styles.ctaButtonConnect}
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
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  TitleWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 60
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
    color: "white"
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