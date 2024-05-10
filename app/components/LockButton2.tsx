// Imports
import React, { useState, useRef } from "react";
import { TouchableOpacity, Animated, Text } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome"; // FontAwesome for lock icons

interface LockButtonProps {
  writeLockState: (isLocked: boolean) => void;
}

const LockButton: React.FC<LockButtonProps> = ({ writeLockState }) => {
  const [isLocked, setIsLocked] = useState(true);
  const borderColor = useRef(new Animated.Value(0)).current; // Animation reference

  const toggleLock = async (): Promise<void> => {
    Animated.timing(borderColor, {
      toValue: isLocked ? 1 : 0,
      duration: 500,
      useNativeDriver: false,
    }).start();

    setIsLocked(!isLocked);
    await writeLockState(!isLocked); // Call the function to write the new state to the ESP device
  };

  const borderInterpolate = borderColor.interpolate({
    inputRange: [0, 1],
    outputRange: ["green", "red"],
  });

  const buttonSize = 300; // You can adjust the size as needed

  return (
    <TouchableOpacity onPress={toggleLock} style={{ margin: 10 }}>
      <Animated.View
        style={{
          width: buttonSize,
          height: buttonSize,
          borderWidth: 15,
          borderColor: borderInterpolate,
          borderRadius: buttonSize / 2,
          alignItems: "center",
          justifyContent: "center",
          padding: 10,
        }}
      >
        <Icon name={isLocked ? "lock" : "unlock"} size={90} color="#ffff" />
        <Text style={{ color: "#ffff", fontSize: 30, fontWeight: "bold" }}>
          {isLocked ? "Locked" : "Unlocked"}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

export default LockButton;
