import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Text from "../components/typography/Text";
import { useOnboarding } from "./OnboardingContext";

const TOTAL_STEPS = 15;
const CURRENT_STEP = 1;

const EMOJIS = [
  "😫",
  "😢",
  "😞",
  "😕",
  "😐",
  "🙂",
  "😊",
  "😄",
  "😁",
  "🤗",
  "🤩",
];

export default function Questionnaire1Screen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { data, updateData } = useOnboarding();
  const [sliderValue, setSliderValue] = useState(data.questionnaire1 ?? 5);

  const handleSliderChange = (value) => {
    updateData({ questionnaire1: Math.round(value) });
    setSliderValue(value);
  };

  const handleContinue = () => {
    updateData({ questionnaire1: Math.round(sliderValue) });
    navigation.navigate("OnboardingValueProp1");
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
          How satisfied are you with your {/* current */}style?
        </Text>

        <Text style={styles.sliderValue}>
          {EMOJIS[Math.round(sliderValue)]}
        </Text>

        <View style={styles.sliderContainer}>
          <Slider
            maximumTrackTintColor="#E0E0E0"
            maximumValue={10}
            minimumTrackTintColor="#007AFF"
            minimumValue={0}
            onValueChange={handleSliderChange}
            step={1}
            style={styles.slider}
            thumbTintColor="#007AFF"
            value={sliderValue}
          />
          <View style={styles.sliderLabels}>
            <Text style={styles.sliderLabelText}>0</Text>
            <Text style={styles.sliderLabelText}>10</Text>
          </View>
        </View>
      </View>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleContinue}
          style={styles.continueButton}
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
  slider: {
    height: 40,
    width: "100%",
  },
  sliderContainer: {
    paddingHorizontal: 10,
    width: "100%",
  },
  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -5,
    paddingHorizontal: 5,
  },
  sliderLabelText: {
    color: "#666",
    fontSize: 14,
    fontWeight: "500",
  },
  sliderValue: {
    color: "#007AFF",
    fontSize: 64,
    fontWeight: "bold",
    marginBottom: 30,
    marginTop: 20,
    textAlign: "center",
  },
  title: {
    color: "#3a3b3c",
    fontSize: 32,
    fontWeight: "bold",
    letterSpacing: 0.5,
    marginBottom: 24,
  },
});
