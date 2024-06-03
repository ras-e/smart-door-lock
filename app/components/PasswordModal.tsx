import React, { useState } from "react";
import { Modal, View, TextInput, Button, StyleSheet, Text } from "react-native";

interface PasswordModalProps {
  visible: boolean;
  onAuthenticate: (password: string) => void;
  onClose: () => void;
}

const PasswordModal: React.FC<PasswordModalProps> = ({
  visible,
  onAuthenticate,
  onClose,
}) => {
  const [password, setPassword] = useState<string>("");

  const handleAuthenticate = () => {
    onAuthenticate(password);
    setPassword(""); // Clear the password input after attempting authentication
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>Enter Password</Text>
          <TextInput
            style={styles.input}
            secureTextEntry
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
          />
          <View style={styles.buttonContainer}>
            <Button title="Authenticate" onPress={handleAuthenticate} />
            <View style={{ height: 10 }} /> 
            <Button title="Close" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    width: 300,
    padding: 20,
    backgroundColor: "white",
    borderRadius: 10,
    alignItems: "center",
  },
  title: {
    fontSize: 18,
    marginBottom: 10,
  },
  input: {
    width: "100%",
    padding: 10,
    borderColor: "gray",
    borderWidth: 1,
    marginBottom: 20,
    borderRadius: 5,
  },
  buttonContainer: {
    width: "100%",
    alignItems: "center", // Aligns buttons to be centered
  },
});

export default PasswordModal;
