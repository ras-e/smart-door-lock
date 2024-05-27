import React, { useState, useRef, useEffect } from "react";
import { TouchableOpacity, Animated, Text } from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";

interface LockButtonProps {
  writeLockState: (isLocked: boolean) => void;
  initialState: boolean; // Initial lock state received from BLE
}

const LockButton: React.FC<LockButtonProps> = ({
  writeLockState,
  initialState,
}) => {
  const [isLocked, setIsLocked] = useState<boolean>(initialState);
  const borderColor = useRef(new Animated.Value(initialState ? 0 : 1)).current;

  useEffect(() => {
    // Adjust the internal state and animate based on the initial state from props
    setIsLocked(initialState);
    Animated.timing(borderColor, {
      toValue: initialState ? 0 : 1, // 0 for locked (red), 1 for unlocked (green)
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [initialState]);

  const toggleLock = async (): Promise<void> => {
    const newLockState = !isLocked;
    setIsLocked(newLockState);
    writeLockState(newLockState);

    Animated.timing(borderColor, {
      toValue: newLockState ? 0 : 1,
      duration: 500,
      useNativeDriver: false,
    }).start();
  };

  const borderInterpolate = borderColor.interpolate({
    inputRange: [0, 1],
    outputRange: ["red", "green"], // Red for locked, green for unlocked
  });

  const buttonSize = 300;

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
        <Icon name={isLocked ? "lock" : "unlock"} size={90} color="#fff" />
        <Text style={{ color: "#fff", fontSize: 30, fontWeight: "bold" }}>
          {isLocked ? "Locked" : "Unlocked"}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

export default LockButton;
