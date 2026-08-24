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
const CURRENT_STEP = 9;

const CURRENCY_OPTIONS = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD"];

const getCurrencySymbol = (currency) => {
  switch (currency) {
    case "AUD":
    case "CAD":
    case "USD":
      return "$";
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    case "JPY":
      return "¥";
    default:
      return "$";
  }
};

export default function CurrencyPriceScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { data, updateData } = useOnboarding();

  const handleContinue = () => {
    Keyboard.dismiss();

    if (data.currency && data.priceMin && data.priceMax) {
      const minPrice = parseInt(data.priceMin);
      const maxPrice = parseInt(data.priceMax);

      if (minPrice >= maxPrice) {
        Alert.alert(
          "Invalid Price Range",
          "Minimum price must be less than maximum price.",
          [{ text: "OK" }],
        );
        return;
      }

      navigation.navigate("OnboardingClothingSizes");
    }
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
        <Text style={styles.title}>Shopping preferences</Text>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Currency</Text>
          <View style={styles.optionsContainer}>
            {CURRENCY_OPTIONS.map((currency) => (
              <TouchableOpacity
                activeOpacity={0.7}
                key={currency}
                onPress={() => updateData({ currency })}
                style={[
                  styles.currencyChip,
                  data.currency === currency && styles.chipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    data.currency === currency && styles.chipTextSelected,
                  ]}
                >
                  {currency}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Price Range</Text>
          <View style={styles.priceRangeContainer}>
            <View style={styles.priceInputWrapper}>
              <Text style={styles.pricePrefix}>
                {getCurrencySymbol(data.currency || "USD")}
              </Text>
              <TextInput
                keyboardType="number-pad"
                maxLength={5}
                onChangeText={(text) =>
                  updateData({ priceMin: text.replace(/[^0-9]/g, "") })
                }
                placeholder="Min"
                placeholderTextColor="#999"
                returnKeyType="next"
                style={styles.priceInput}
                value={data.priceMin}
              />
            </View>
            <Text style={styles.priceSeparator}>—</Text>
            <View style={styles.priceInputWrapper}>
              <Text style={styles.pricePrefix}>
                {getCurrencySymbol(data.currency || "USD")}
              </Text>
              <TextInput
                keyboardType="number-pad"
                maxLength={5}
                onChangeText={(text) =>
                  updateData({ priceMax: text.replace(/[^0-9]/g, "") })
                }
                onSubmitEditing={() => Keyboard.dismiss()}
                placeholder="Max"
                placeholderTextColor="#999"
                returnKeyType="done"
                style={styles.priceInput}
                value={data.priceMax}
              />
            </View>
          </View>
        </View>
      </View>

      {/* Bottom bar with Continue button */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          disabled={!data.currency || !data.priceMin || !data.priceMax}
          onPress={handleContinue}
          style={[
            styles.continueButton,
            (!data.currency || !data.priceMin || !data.priceMax) &&
              styles.continueButtonDisabled,
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
  currencyChip: {
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderColor: "#f0f0f0",
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    minWidth: 60,
    paddingHorizontal: 16,
    paddingVertical: 8,
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
  priceInput: {
    color: "#3a3b3c",
    flex: 1,
    fontSize: 16,
    padding: 12,
    paddingLeft: 0,
  },
  priceInputWrapper: {
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderColor: "#f0f0f0",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    paddingHorizontal: 12,
  },
  pricePrefix: {
    color: "#3a3b3c",
    fontSize: 16,
    fontWeight: "500",
    marginRight: 4,
  },
  priceRangeContainer: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  priceSeparator: {
    color: "#999",
    fontSize: 16,
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
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    color: "#3a3b3c",
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 12,
  },
  title: {
    color: "#3a3b3c",
    fontSize: 32,
    fontWeight: "bold",
    letterSpacing: 0.5,
    marginBottom: 24,
  },
});
