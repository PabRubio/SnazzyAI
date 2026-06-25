import React from 'react';
import { useState } from 'react';
import Text from '../components/Text';
import TextInput from '../components/TextInput';
import { StyleSheet, View, TouchableOpacity, Keyboard } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnboarding } from './OnboardingContext';

const TOTAL_STEPS = 15;
const CURRENT_STEP = 11;

const STYLE_OPTIONS = ['Casual', 'Formal', 'Streetwear', 'Sporty'];

const parseFavoriteText = (text) =>
  text
    .split(',')
    .map(item => item.trim())
    .filter(item => item.length > 0);

export default function FavoriteStylesScreen({ navigation }) {
  const { data, updateData } = useOnboarding();
  const insets = useSafeAreaInsets();

  const [stylesText, setStylesText] = useState((data.favoriteStyles || []).join(', '));
  const selectedStyles = parseFavoriteText(stylesText);

  const handleContinue = () => {
    Keyboard.dismiss(); // Dismiss keyboard
    updateData({ favoriteStyles: selectedStyles });
    navigation.navigate('OnboardingFavoriteBrands');
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const toggleStyle = (style) => {
    if (selectedStyles.includes(style)) {
      setStylesText(selectedStyles.filter(s => s !== style).join(', '));
    } else {
      setStylesText([...selectedStyles, style].join(', '));
    }
  };

  const isStyleSelected = (style) => {
    return selectedStyles.includes(style);
  };

  const progress = CURRENT_STEP / TOTAL_STEPS;

  return (
    <View style={styles.container}>
      {/* Header with back arrow and progress bar */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={28} color="#3a3b3c" />
          </TouchableOpacity>

          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
            </View>
          </View>
        </View>

        {/* Main content */}
        <View style={styles.content}>
          <Text style={styles.title}>Favorite styles?</Text>

          <View style={styles.inputGroup}>
            <TextInput
              style={styles.input}
              placeholder="e.g., Old Money style"
              placeholderTextColor="#999"
              value={stylesText}

              onChangeText={(text) => {
                let filtered = text.replace(/[^a-zA-Z\s,]/g, '');
                filtered = filtered.replace(/^[,\s]+/, '');
                filtered = filtered.replace(/\s+/g, ' ');
                filtered = filtered.replace(/,+/g, ',');
                filtered = filtered.replace(/\s+,/g, ',');
                filtered = filtered.replace(/,(?!\s)/g, ', ');
                setStylesText(filtered);
              }}
              onBlur={() => setStylesText(stylesText.replace(/[,\s]+$/, ''))}
              multiline
              numberOfLines={3}
              autoCapitalize="words"
              textAlignVertical="top"
              blurOnSubmit={true}
              maxLength={100}
            />
          </View>

          <Text style={styles.popularLabel}>Popular styles</Text>
          <View style={styles.stylesContainer}>
            {STYLE_OPTIONS.map((style) => (
              <TouchableOpacity
                key={style}
                style={[
                  styles.styleChip,
                  isStyleSelected(style) && styles.styleChipSelected,
                ]}
                onPress={() => toggleStyle(style)}
                activeOpacity={0.7}
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

        {/* Bottom bar with Continue button */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={[styles.continueButton, !selectedStyles.length && styles.continueButtonDisabled]}
            disabled={!selectedStyles.length}
            onPress={handleContinue}
            activeOpacity={0.7}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>

      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  progressBarContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: '#f0f0f0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3a3b3c',
    letterSpacing: 0.5,
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  input: {
    fontSize: 16,
    color: '#3a3b3c',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f5f5f5',
    minHeight: 80,
    paddingTop: 12,
  },
  popularLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3a3b3c',
    marginBottom: 12,
  },
  stylesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  styleChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderColor: '#f0f0f0',
    borderWidth: 1,
  },
  styleChipSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  styleChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3a3b3c',
  },
  styleChipTextSelected: {
    color: '#fff',
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  continueButtonDisabled: {
    backgroundColor: '#999',
    opacity: 0.5,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
});
