import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Text from "../components/typography/Text";
import { useOnboarding } from "./OnboardingContext";

const TOTAL_STEPS = 15;
const CURRENT_STEP = 10;

const SHIRT_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const PANTS_SIZES = ["28", "30", "32", "34", "36", "38", "40", "42"];
const SHOE_SIZES = ["6", "7", "8", "9", "10", "11", "12", "13"];

export default function ClothingSizesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { data, updateData } = useOnboarding();
  const hasCompleteSizeSelection = Boolean(
    data.shirtSize && data.pantsSize && data.shoeSize,
  );
  const progress = CURRENT_STEP / TOTAL_STEPS;

  const handleContinue = () => {
    if (hasCompleteSizeSelection) {
      navigation.navigate("OnboardingFavoriteStyles");
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

      <ScrollView showsVerticalScrollIndicator={false} style={styles.content}>
        <Text style={styles.title}>Your optimal sizes</Text>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Shirt Size</Text>
          <View style={styles.optionsContainer}>
            {SHIRT_SIZES.map((size) => (
              <TouchableOpacity
                activeOpacity={0.7}
                key={size}
                onPress={() => updateData({ shirtSize: size })}
                style={[
                  styles.sizeChip,
                  data.shirtSize === size && styles.chipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    data.shirtSize === size && styles.chipTextSelected,
                  ]}
                >
                  {size}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Pants Size</Text>
          <View style={styles.optionsContainer}>
            {PANTS_SIZES.map((size) => (
              <TouchableOpacity
                activeOpacity={0.7}
                key={size}
                onPress={() => updateData({ pantsSize: size })}
                style={[
                  styles.sizeChip,
                  data.pantsSize === size && styles.chipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    data.pantsSize === size && styles.chipTextSelected,
                  ]}
                >
                  {size}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Shoe Size</Text>
          <View style={styles.optionsContainer}>
            {SHOE_SIZES.map((size) => (
              <TouchableOpacity
                activeOpacity={0.7}
                key={size}
                onPress={() => updateData({ shoeSize: size })}
                style={[
                  styles.sizeChip,
                  data.shoeSize === size && styles.chipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    data.shoeSize === size && styles.chipTextSelected,
                  ]}
                >
                  {size}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          disabled={!hasCompleteSizeSelection}
          onPress={handleContinue}
          style={[
            styles.continueButton,
            !hasCompleteSizeSelection && styles.continueButtonDisabled,
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
  chipSelected: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  chipText: {
    color: "#3a3b3c",
    fontSize: 14,
    fontWeight: "500",
  },
  chipTextSelected: {
    color: "#fff",
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
  optionsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
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
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    color: "#3a3b3c",
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 12,
  },
  sizeChip: {
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderColor: "#f0f0f0",
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    minWidth: 50,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  title: {
    color: "#3a3b3c",
    fontSize: 32,
    fontWeight: "bold",
    letterSpacing: 0.5,
    marginBottom: 24,
  },
});
