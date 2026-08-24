import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Text from "../components/typography/Text";
import { useOnboarding } from "./OnboardingContext";

const TOTAL_STEPS = 15;
const CURRENT_STEP = 13;

const SOURCE_OPTIONS = [
  { icon: "logo-tiktok", label: "TikTok" },
  { icon: "logo-google", label: "Internet" },
  { icon: "logo-instagram", label: "Instagram" },
  { icon: "people", label: "Friends" },
];

export default function Questionnaire3Screen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { data, updateData } = useOnboarding();
  const progress = CURRENT_STEP / TOTAL_STEPS;

  const handleContinue = () => {
    if (data.questionnaire3) {
      navigation.navigate("OnboardingValueProp3");
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

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
        <Text style={styles.title}>How did you hear about us?</Text>

        <View style={styles.optionsContainer}>
          {SOURCE_OPTIONS.map((option) => (
            <TouchableOpacity
              activeOpacity={0.7}
              key={option.label}
              onPress={() => updateData({ questionnaire3: option.label })}
              style={[
                styles.optionChip,
                data.questionnaire3 === option.label &&
                  styles.optionChipSelected,
              ]}
            >
              <Ionicons
                color={
                  data.questionnaire3 === option.label ? "#fff" : "#3a3b3c"
                }
                name={option.icon}
                size={18}
                style={styles.optionIcon}
              />
              <Text
                style={[
                  styles.optionChipText,
                  data.questionnaire3 === option.label &&
                    styles.optionChipTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          disabled={!data.questionnaire3}
          onPress={handleContinue}
          style={[
            styles.continueButton,
            !data.questionnaire3 && styles.continueButtonDisabled,
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
  header: {
    alignItems: "center",
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  optionChip: {
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderColor: "#f0f0f0",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  optionChipSelected: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  optionChipText: {
    color: "#3a3b3c",
    fontSize: 14,
    fontWeight: "500",
  },
  optionChipTextSelected: {
    color: "#fff",
  },
  optionIcon: {
    marginRight: 6,
  },
  optionsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
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
