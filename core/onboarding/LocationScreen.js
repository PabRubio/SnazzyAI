import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Text from "../components/typography/Text";
import { useOnboarding } from "./OnboardingContext";

const TOTAL_STEPS = 15;
const CURRENT_STEP = 5;

export default function LocationScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { data, updateData } = useOnboarding();
  const [loading, setLoading] = useState(false);

  const handleDetectLocation = async () => {
    setLoading(true);

    try {
      const { status: existingStatus } =
        await Location.getForegroundPermissionsAsync();
      let hasPermission = existingStatus === "granted";

      if (!hasPermission) {
        const { status: requestedStatus } =
          await Location.requestForegroundPermissionsAsync();
        hasPermission = requestedStatus === "granted";
      }

      if (!hasPermission) {
        setLoading(false);
        Alert.alert(
          "Location Access Required",
          "To auto-detect your location, please enable location permissions in Settings.",
          [
            { style: "cancel", text: "Cancel" },
            { onPress: () => Linking.openSettings(), text: "Open Settings" },
          ],
        );
        return;
      }

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 5000),
      );

      const locationPromise = (async () => {
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Low,
        });

        const [address] = await Location.reverseGeocodeAsync({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });

        return address;
      })();

      const address = await Promise.race([locationPromise, timeoutPromise]);

      if (address) {
        const city = address.city || address.subregion || "";
        const country = address.country || "";
        const locationString =
          city && country ? `${city}, ${country}` : city || country || "";
        updateData({ location: locationString });
      }
    } catch (error) {
      if (error.message === "timeout") {
        Alert.alert(
          "Timeout",
          "Location detection took too long. Please try again.",
        );
      } else {
        Alert.alert("Error", "Failed to get location. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    navigation.navigate("OnboardingMeasurements");
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const progress = CURRENT_STEP / TOTAL_STEPS;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleBack}
          style={styles.backButton}
        >
          <Ionicons color="#3a3b3c" name="chevron-back" size={28} />
        </TouchableOpacity>

        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarTrack}>
            <View
              style={[styles.progressBarFill, { width: `${progress * 100}%` }]}
            />
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>
          {"Where are you living?" + " (optional)"}
        </Text>

        <TouchableOpacity
          activeOpacity={0.7}
          disabled={loading}
          onPress={handleDetectLocation}
          style={styles.locationButton}
        >
          {loading ? (
            <ActivityIndicator color="#007AFF" size="small" />
          ) : (
            <Ionicons color="#007AFF" name="locate" size={24} />
          )}
          <Text style={styles.locationButtonText}>
            {loading ? "Detecting..." : "Detect my location"}
          </Text>
        </TouchableOpacity>

        {data.location && (
          <View style={styles.locationResult}>
            <Ionicons color="#007AFF" name="location" size={20} />
            <Text style={styles.locationText}>{data.location}</Text>
          </View>
        )}
      </View>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleContinue}
          style={styles.continueButton}
        >
          <Text style={styles.continueButtonText}>
            {data.location ? "Continue" : "Skip"}
          </Text>
        </TouchableOpacity>
      </View>

      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: "center",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    marginRight: 16,
    width: 44,
  },
  bottomBar: {
    backgroundColor: "#fff",
    borderTopColor: "#f0f0f0",
    borderTopWidth: 1,
    elevation: 8,
    paddingHorizontal: 20,
    paddingTop: 12,
    shadowColor: "#000",
    shadowOffset: { height: -2, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  container: {
    backgroundColor: "#fff",
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 30,
  },
  continueButton: {
    alignItems: "center",
    backgroundColor: "#007AFF",
    borderRadius: 12,
    elevation: 3,
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 14,
    shadowColor: "#000",
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  continueButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  locationButton: {
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderColor: "#f0f0f0",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  locationButtonText: {
    color: "#007AFF",
    fontSize: 16,
    fontWeight: "500",
  },
  locationResult: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: 24,
  },
  locationText: {
    color: "#3a3b3c",
    fontSize: 18,
    fontWeight: "500",
  },
  progressBarContainer: {
    flex: 1,
    justifyContent: "center",
  },
  progressBarFill: {
    backgroundColor: "#007AFF",
    borderRadius: 2,
    height: "100%",
  },
  progressBarTrack: {
    backgroundColor: "#f0f0f0",
    borderRadius: 2,
    height: 4,
    overflow: "hidden",
  },
  title: {
    color: "#3a3b3c",
    fontSize: 32,
    fontWeight: "bold",
    letterSpacing: 0.5,
    marginBottom: 24,
  },
});
