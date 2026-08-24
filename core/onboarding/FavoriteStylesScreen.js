import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import { Keyboard, StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Text from "../components/typography/Text";
import TextInput from "../components/typography/TextInput";
import { useOnboarding } from "./OnboardingContext";

const TOTAL_STEPS = 15;
const CURRENT_STEP = 11;

const STYLE_OPTIONS = ["Casual", "Formal", "Streetwear", "Sporty"];

const parseFavoriteText = (text) =>
  text
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

export default function FavoriteStylesScreen({ navigation }) {
  const { data, updateData } = useOnboarding();
  const insets = useSafeAreaInsets();

  const [stylesText, setStylesText] = useState(
    (data.favoriteStyles || []).join(", "),
  );
  const selectedStyles = parseFavoriteText(stylesText);
  const hasSelectedStyles = selectedStyles.length > 0;
  const progress = CURRENT_STEP / TOTAL_STEPS;

  const updateStylesText = (text) => {
    updateData({ favoriteStyles: parseFavoriteText(text) });
    setStylesText(text);
  };

  const handleContinue = () => {
    Keyboard.dismiss();
    updateData({ favoriteStyles: selectedStyles });
    navigation.navigate("OnboardingFavoriteBrands");
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const toggleStyle = (style) => {
    if (selectedStyles.includes(style)) {
      updateStylesText(
        selectedStyles
          .filter((selectedStyle) => selectedStyle !== style)
          .join(", "),
      );
    } else {
      updateStylesText([...selectedStyles, style].join(", "));
    }
  };

  const isStyleSelected = (style) => selectedStyles.includes(style);

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
        <Text style={styles.title}>Favorite styles?</Text>

        <View style={styles.inputGroup}>
          <TextInput
            autoCapitalize="words"
            blurOnSubmit
            maxLength={100}
            multiline
            numberOfLines={3}
            onBlur={() => updateStylesText(stylesText.replace(/[,\s]+$/, ""))}
            onChangeText={(text) => {
              let filteredText = text.replace(/[^a-zA-Z\s,]/g, "");
              filteredText = filteredText.replace(/^[,\s]+/, "");
              filteredText = filteredText.replace(/\s+/g, " ");
              filteredText = filteredText.replace(/,+/g, ",");
              filteredText = filteredText.replace(/\s+,/g, ",");
              filteredText = filteredText.replace(/,(?!\s)/g, ", ");
              updateStylesText(filteredText);
            }}
            placeholder="e.g., Old Money style"
            placeholderTextColor="#999"
            style={styles.input}
            textAlignVertical="top"
            value={stylesText}
          />
        </View>

        <Text style={styles.popularLabel}>Popular styles</Text>
        <View style={styles.stylesContainer}>
          {STYLE_OPTIONS.map((style) => (
            <TouchableOpacity
              activeOpacity={0.7}
              key={style}
              onPress={() => toggleStyle(style)}
              style={[
                styles.styleChip,
                isStyleSelected(style) && styles.styleChipSelected,
              ]}
            >
              <Text
                style={[
                  styles.styleChipText,
                  isStyleSelected(style) && styles.styleChipTextSelected,
                ]}
              >
                {style}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          disabled={!hasSelectedStyles}
          onPress={handleContinue}
          style={[
            styles.continueButton,
            !hasSelectedStyles && styles.continueButtonDisabled,
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
  styleChip: {
    backgroundColor: "#f5f5f5",
    borderColor: "#f0f0f0",
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  styleChipSelected: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  styleChipText: {
    color: "#3a3b3c",
    fontSize: 14,
    fontWeight: "500",
  },
  styleChipTextSelected: {
    color: "#fff",
  },
  stylesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  title: {
    color: "#3a3b3c",
    fontSize: 32,
    fontWeight: "bold",
    letterSpacing: 0.5,
    marginBottom: 24,
  },
});
