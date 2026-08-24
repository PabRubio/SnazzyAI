import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import { Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Text from "../components/typography/Text";
import { useOnboarding } from "./OnboardingContext";

const TOTAL_STEPS = 15;
const CURRENT_STEP = 3;

export default function BirthScreen({ navigation }) {
  const { data, updateData } = useOnboarding();
  const [showPicker, setShowPicker] = useState(Platform.OS === "ios");
  const insets = useSafeAreaInsets();

  // Limit birth-date selection to ages 13 through 100.
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() - 13);

  const minDate = new Date();
  minDate.setFullYear(minDate.getFullYear() - 100);

  const handleContinue = () => {
    navigation.navigate("OnboardingGender");
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleDateChange = (_event, selectedDate) => {
    if (Platform.OS === "android") {
      setShowPicker(false);
    }
    if (selectedDate) {
      updateData({ birth: selectedDate });
    }
  };

  const formatDate = (date) => {
    if (!date) return "";
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
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
        <Text style={styles.title}>When is your DoB?</Text>

        {Platform.OS === "android" && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setShowPicker(true)}
            style={styles.dateButton}
          >
            <Text
              style={[
                styles.dateButtonText,
                !data.birth && styles.dateButtonPlaceholder,
              ]}
            >
              {data.birth ? formatDate(data.birth) : "Select your birthday"}
            </Text>
            <Ionicons color="#007AFF" name="calendar-outline" size={24} />
          </TouchableOpacity>
        )}

        {showPicker && (
          <View style={styles.pickerContainer}>
            <DateTimePicker
              display={Platform.OS === "ios" ? "spinner" : "default"}
              maximumDate={maxDate}
              minimumDate={minDate}
              mode="date"
              onChange={handleDateChange}
              style={styles.picker}
              value={data.birth || maxDate}
            />
          </View>
        )}
      </View>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          disabled={!data.birth}
          onPress={handleContinue}
          style={[
            styles.continueButton,
            !data.birth && styles.continueButtonDisabled,
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
  dateButton: {
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderColor: "#f0f0f0",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
  },
  dateButtonPlaceholder: {
    color: "#999",
  },
  dateButtonText: {
    color: "#3a3b3c",
    fontSize: 16,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  picker: {
    height: 200,
  },
  pickerContainer: {
    marginTop: 16,
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
