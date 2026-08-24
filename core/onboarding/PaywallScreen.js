import { usePlacement } from "expo-superwall";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, View } from "react-native";

export default function PaywallScreen({ navigation }) {
  const [paywallShown, setPaywallShown] = useState(false);

  const { registerPlacement } = usePlacement({
    onDismiss: () => {
      // Go back to Auth when paywall is dismissed
      navigation.navigate("Auth");
    },
    onError: (error) => {
      console.error("Paywall error:", error);
      Alert.alert("Error", "Failed to show paywall. Please try again.");
      navigation.navigate("Auth");
    },
  });

  const handleShowPaywall = async () => {
    try {
      await registerPlacement({
        placement: "campaign_trigger",
      });
    } catch (error) {
      console.error("Failed to show paywall:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
      navigation.navigate("Auth");
    }
  };

  useEffect(() => {
    if (!paywallShown) {
      setPaywallShown(true);
      handleShowPaywall();
    }
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator color="#007AFF" size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: "#fff",
    flex: 1,
    justifyContent: "center",
  },
});
