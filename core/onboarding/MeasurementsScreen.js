import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import React from "react";
import {
  Alert,
  Keyboard,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Text from "../components/typography/Text";
import TextInput from "../components/typography/TextInput";
import { useOnboarding } from "./OnboardingContext";

const TOTAL_STEPS = 15;
const CURRENT_STEP = 6;

const cmToFt = (cm) => {
  if (!cm || isNaN(cm)) return null;
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  if (inches === 12) {
    return `${feet + 1}'0"`;
  }
  return `${feet}'${inches}"`;
};

const kgToLb = (kg) => {
  if (!kg || isNaN(kg)) return null;
  const pounds = Math.round(kg * 2.20462);
  return `${pounds} lbs`;
};

export default function MeasurementsScreen({ navigation }) {
  const { data, updateData } = useOnboarding();
  const insets = useSafeAreaInsets();

  const handleContinue = () => {
    Keyboard.dismiss();

    const heightValue = parseInt(data.height);
    const weightValue = parseInt(data.weight);

    if (heightValue < 150 || heightValue > 250) {
      Alert.alert(
        "Invalid Height",
        "Please enter a height between 150 and 250 cm.",
        [{ text: "OK" }],
      );
      return;
    }

    if (weightValue < 50 || weightValue > 200) {
      Alert.alert(
        "Invalid Weight",
        "Please enter a weight between 50 and 200 kg.",
        [{ text: "OK" }],
      );
      return;
    }

    navigation.navigate("OnboardingQuestionnaire2");
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const formattedHeight = data.height && cmToFt(parseInt(data.height));
  const formattedWeight = data.weight && kgToLb(parseInt(data.weight));
  const isValid = data.height.length > 0 && data.weight.length > 0;
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
        <Text style={styles.title}>Your measurements</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Height (cm)</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              keyboardType="number-pad"
              maxLength={3}
              onChangeText={(text) =>
                updateData({ height: text.replace(/[^0-9]/g, "") })
              }
              placeholder="Enter your height"
              placeholderTextColor="#999"
              returnKeyType="next"
              style={styles.input}
              value={data.height}
            />
            {formattedHeight && (
              <Text style={styles.conversionText}>≈ {formattedHeight}</Text>
            )}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Weight (kg)</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              keyboardType="number-pad"
              maxLength={3}
              onChangeText={(text) =>
                updateData({ weight: text.replace(/[^0-9]/g, "") })
              }
              onSubmitEditing={() => Keyboard.dismiss()}
              placeholder="Enter your weight"
              placeholderTextColor="#999"
              returnKeyType="done"
              style={styles.input}
              value={data.weight}
            />
            {formattedWeight && (
              <Text style={styles.conversionText}>≈ {formattedWeight}</Text>
            )}
          </View>
        </View>
      </View>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          disabled={!isValid}
          onPress={handleContinue}
          style={[
            styles.continueButton,
            !isValid && styles.continueButtonDisabled,
          ]}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
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
  continueButtonDisabled: {
    backgroundColor: "#999",
    opacity: 0.5,
  },
  continueButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  conversionText: {
    bottom: 0,
    color: "#999",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 46,
    position: "absolute",
    right: 12,
    textAlignVertical: "center",
    top: 0,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  input: {
    backgroundColor: "#f5f5f5",
    borderColor: "#f0f0f0",
    borderRadius: 8,
    borderWidth: 1,
    color: "#3a3b3c",
    fontSize: 16,
    padding: 12,
    paddingRight: 90,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputWrapper: {
    position: "relative",
  },
  label: {
    color: "#3a3b3c",
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
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
