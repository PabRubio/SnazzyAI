import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import { Keyboard, StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Text from "../components/typography/Text";
import TextInput from "../components/typography/TextInput";
import { useOnboarding } from "./OnboardingContext";

const TOTAL_STEPS = 15;
const CURRENT_STEP = 12;

const POPULAR_BRANDS = [
  "Nike",
  "Adidas",
  "Zara",
  "Uniqlo",
  "H&M",
  "Mango",
  "Calvin Klein",
  "Ralph Lauren",
];

const parseFavoriteText = (text) =>
  text
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

export default function FavoriteBrandsScreen({ navigation }) {
  const { data, updateData } = useOnboarding();
  const insets = useSafeAreaInsets();

  const [brandsText, setBrandsText] = useState(
    (data.favoriteBrands || []).join(", "),
  );
  const selectedBrands = parseFavoriteText(brandsText);
  const hasSelectedBrands = selectedBrands.length > 0;
  const progress = CURRENT_STEP / TOTAL_STEPS;

  const updateBrandsText = (text) => {
    updateData({ favoriteBrands: parseFavoriteText(text) });
    setBrandsText(text);
  };

  const handleContinue = () => {
    Keyboard.dismiss();
    updateData({ favoriteBrands: selectedBrands });
    navigation.navigate("OnboardingQuestionnaire3");
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const toggleBrand = (brand) => {
    if (selectedBrands.includes(brand)) {
      updateBrandsText(
        selectedBrands
          .filter((selectedBrand) => selectedBrand !== brand)
          .join(", "),
      );
    } else {
      updateBrandsText([...selectedBrands, brand].join(", "));
    }
  };

  const isBrandSelected = (brand) => selectedBrands.includes(brand);

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
        <Text style={styles.title}>Favorite brands?</Text>

        <View style={styles.inputGroup}>
          <TextInput
            autoCapitalize="words"
            blurOnSubmit
            maxLength={100}
            multiline
            numberOfLines={3}
            onBlur={() => updateBrandsText(brandsText.replace(/[,\s]+$/, ""))}
            onChangeText={(text) => {
              let filteredText = text.replace(/[^a-zA-Z\s,]/g, "");
              filteredText = filteredText.replace(/^[,\s]+/, "");
              filteredText = filteredText.replace(/\s+/g, " ");
              filteredText = filteredText.replace(/,+/g, ",");
              filteredText = filteredText.replace(/\s+,/g, ",");
              filteredText = filteredText.replace(/,(?!\s)/g, ", ");
              updateBrandsText(filteredText);
            }}
            placeholder="e.g., Nike, Adidas, Zara"
            placeholderTextColor="#999"
            style={styles.input}
            textAlignVertical="top"
            value={brandsText}
          />
        </View>

        <Text style={styles.popularLabel}>Popular brands</Text>
        <View style={styles.brandsContainer}>
          {POPULAR_BRANDS.map((brand) => (
            <TouchableOpacity
              activeOpacity={0.7}
              key={brand}
              onPress={() => toggleBrand(brand)}
              style={[
                styles.brandChip,
                isBrandSelected(brand) && styles.brandChipSelected,
              ]}
            >
              <Text
                style={[
                  styles.brandChipText,
                  isBrandSelected(brand) && styles.brandChipTextSelected,
                ]}
              >
                {brand}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          disabled={!hasSelectedBrands}
          onPress={handleContinue}
          style={[
            styles.continueButton,
            !hasSelectedBrands && styles.continueButtonDisabled,
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
  brandChip: {
    backgroundColor: "#f5f5f5",
    borderColor: "#f0f0f0",
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  brandChipSelected: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  brandChipText: {
    color: "#3a3b3c",
    fontSize: 14,
    fontWeight: "500",
  },
  brandChipTextSelected: {
    color: "#fff",
  },
  brandsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
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
  input: {
    backgroundColor: "#f5f5f5",
    borderColor: "#f0f0f0",
    borderRadius: 8,
    borderWidth: 1,
    color: "#3a3b3c",
    fontSize: 16,
    minHeight: 80,
    padding: 12,
    paddingTop: 12,
  },
  inputGroup: {
    marginBottom: 20,
  },
  popularLabel: {
    color: "#3a3b3c",
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 12,
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
