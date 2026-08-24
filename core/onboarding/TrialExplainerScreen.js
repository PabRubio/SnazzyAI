import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Text from "../components/typography/Text";

const TOTAL_STEPS = 15;
const CURRENT_STEP = 15;

export default function TrialExplainerScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const handleContinue = () => {
    navigation.navigate("OnboardingFreeTrial");
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const progress = CURRENT_STEP / TOTAL_STEPS;

  return (
    <View style={styles.container}>
      {/* Header with back arrow and progress bar */}
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

      {/* Main content */}
      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <Ionicons color="#007AFF" name="sparkles" size={80} />
        </View>

        {/* Title */}
        <Text style={styles.title}>Try It Free...</Text>

        {/* Features list */}
        <View style={styles.featuresList}>
          <View style={styles.featureItem}>
            <Ionicons color="#007AFF" name="camera-outline" size={24} />
            <Text style={styles.featureText}>
              Take a mirror selfie of your #FitCheck
            </Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons color="#007AFF" name="star-outline" size={24} />
            <Text style={styles.featureText}>
              Get your style rating & outfit feedback
            </Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons color="#007AFF" name="shirt-outline" size={24} />
            <Text style={styles.featureText}>
              See personalized item recommendations
            </Text>
          </View>
        </View>
      </View>

      {/* Bottom bar with Continue button */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleContinue}
          style={styles.continueButton}
        >
          <Text style={styles.continueButtonText}>{"Let's Go!"}</Text>
          <Ionicons
            color="#fff"
            name="arrow-forward"
            size={20}
            style={styles.buttonIcon}
          />
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
  buttonIcon: {
    marginLeft: 8,
  },
  container: {
    backgroundColor: "#fff",
    flex: 1,
  },
  content: {
    alignItems: "center",
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 40,
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
  featureItem: {
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    flexDirection: "row",
    marginBottom: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  featuresList: {
    marginBottom: 30,
    width: "100%",
  },
  featureText: {
    color: "#3a3b3c",
    flex: 1,
    fontSize: 16,
    marginLeft: 16,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  iconContainer: {
    alignItems: "center",
    backgroundColor: "#F0F7FF",
    borderRadius: 70,
    height: 140,
    justifyContent: "center",
    marginBottom: 30,
    width: 140,
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
    marginBottom: 24,
    textAlign: "center",
  },
});
