import React from 'react';
import Text from '../components/Text';
import TextInput from '../components/TextInput';
import { StyleSheet, View, TouchableOpacity, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnboarding } from './OnboardingContext';

const TOTAL_STEPS = 15;
const CURRENT_STEP = 9;

const CURRENCY_OPTIONS = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'];

const getCurrencySymbol = (currency) => {
  switch (currency) {
    case 'USD':
    case 'CAD':
    case 'AUD':
      return '$';
    case 'EUR':
      return '€';
    case 'GBP':
      return '£';
    case 'JPY':
      return '¥';
    default:
      return '$';
  }
};

export default function CurrencyPriceScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { data, updateData } = useOnboarding();

  const handleContinue = () => {
    if (data.currency && data.priceMin && data.priceMax) {
      const minPrice = parseInt(data.priceMin);
      const maxPrice = parseInt(data.priceMax);

      if (minPrice >= maxPrice) {
        Alert.alert(
          'Invalid Price Range',
          'Minimum price must be less than maximum price.',
          [{ text: 'OK' }]
        );
        return;
      }

      navigation.navigate('OnboardingClothingSizes');
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
          <Text style={styles.title}>Shopping preferences</Text>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Currency</Text>
            <View style={styles.optionsContainer}>
              {CURRENCY_OPTIONS.map((currency) => (
                <TouchableOpacity
                  key={currency}
                  style={[
                    styles.currencyChip,
                    data.currency === currency && styles.chipSelected,
                  ]}
                  onPress={() => updateData({ currency })}
                  activeOpacity={0.7}
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
                <Text style={styles.pricePrefix}>{getCurrencySymbol(data.currency || 'USD')}</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder="Min"
                  placeholderTextColor="#999"
                  value={data.priceMin}
                  onChangeText={(text) => updateData({ priceMin: text.replace(/[^0-9]/g, '') })}
                  keyboardType="number-pad"
                  maxLength={5}
                />
              </View>
              <Text style={styles.priceSeparator}>—</Text>
              <View style={styles.priceInputWrapper}>
                <Text style={styles.pricePrefix}>{getCurrencySymbol(data.currency || 'USD')}</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder="Max"
                  placeholderTextColor="#999"
                  value={data.priceMax}
                  onChangeText={(text) => updateData({ priceMax: text.replace(/[^0-9]/g, '') })}
                  keyboardType="number-pad"
                  maxLength={5}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Bottom bar with Continue button */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={[styles.continueButton, (!data.currency || !data.priceMin || !data.priceMax) && styles.continueButtonDisabled]}
            onPress={handleContinue}
            activeOpacity={0.7}
            disabled={!data.currency || !data.priceMin || !data.priceMax}
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
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3a3b3c',
    marginBottom: 12,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  currencyChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3a3b3c',
  },
  chipTextSelected: {
    color: '#fff',
  },
  priceRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  priceInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
  },
  pricePrefix: {
    fontSize: 16,
    color: '#3a3b3c',
    fontWeight: '500',
    marginRight: 4,
  },
  priceInput: {
    flex: 1,
    fontSize: 16,
    color: '#3a3b3c',
    padding: 12,
    paddingLeft: 0,
  },
  priceSeparator: {
    fontSize: 16,
    color: '#999',
    fontWeight: '500',
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
