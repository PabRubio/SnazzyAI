import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, Keyboard } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnboarding } from './OnboardingContext';

const TOTAL_STEPS = 15;
const CURRENT_STEP = 11;

const POPULAR_BRANDS = ['Nike', 'Adidas', 'Uniqlo', 'Zara', 'H&M', 'Calvin Klein', 'Ralph Lauren', 'Tommy Hilfiger'];

export default function FavoriteBrandsScreen({ navigation }) {
  const { data, updateData } = useOnboarding();
  const insets = useSafeAreaInsets();

  const handleContinue = () => {
    Keyboard.dismiss();
    navigation.navigate('OnboardingFavoriteStyles');
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const toggleBrand = (brand) => {
    const currentBrands = data.favoriteBrands || [];
    if (currentBrands.includes(brand)) {
      updateData({ favoriteBrands: currentBrands.filter(b => b !== brand) });
    } else {
      updateData({ favoriteBrands: [...currentBrands, brand] });
    }
  };

  const isBrandSelected = (brand) => {
    return (data.favoriteBrands || []).includes(brand);
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
          <Text style={styles.title}>Favorite brands?</Text>

          <View style={styles.inputGroup}>
            <TextInput
              style={styles.input}
              placeholder="e.g., Nike, Adidas, Zara"
              placeholderTextColor="#999"
              value={(data.favoriteBrands || []).join(', ')}
              onChangeText={(text) => {
                let filtered = text.replace(/[^a-zA-Z\s,]/g, '');
                filtered = filtered.replace(/^[,\s]+/, '');
                filtered = filtered.replace(/\s+/g, ' ');
                filtered = filtered.replace(/,+/g, ',');
                filtered = filtered.replace(/\s+,/g, ',');
                filtered = filtered.replace(/,(?!\s)/g, ', ');
                const brandsArray = filtered.split(',').map(b => b.trim()).filter(b => b);
                updateData({ favoriteBrands: brandsArray });
              }}
              multiline
              numberOfLines={3}
              autoCapitalize="words"
              textAlignVertical="top"
              blurOnSubmit={true}
              maxLength={100}
            />
          </View>

          <Text style={styles.popularLabel}>Popular brands</Text>
          <View style={styles.brandsContainer}>
            {POPULAR_BRANDS.map((brand) => (
              <TouchableOpacity
                key={brand}
                style={[
                  styles.brandChip,
                  isBrandSelected(brand) && styles.brandChipSelected,
                ]}
                onPress={() => toggleBrand(brand)}
                activeOpacity={0.7}
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

        {/* Bottom bar with Continue button */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={[styles.continueButton, !(data.favoriteBrands || []).length && styles.continueButtonDisabled]}
            onPress={handleContinue}
            activeOpacity={0.7}
            disabled={!(data.favoriteBrands || []).length}
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
    fontWeight: '600',
    color: '#3a3b3c',
    marginBottom: 12,
  },
  brandsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  brandChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  brandChipSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  brandChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3a3b3c',
  },
  brandChipTextSelected: {
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
    fontWeight: '600',
  },
});
