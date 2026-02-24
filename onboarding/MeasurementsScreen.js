import React from 'react';
import Text from '../components/Text';
import TextInput from '../components/TextInput';
import { StyleSheet, View, TouchableOpacity, Keyboard, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnboarding } from './OnboardingContext';

const TOTAL_STEPS = 15;
const CURRENT_STEP = 6;

// Conversion helpers
const cmToFt = (cm) => {
  if (!cm || isNaN(cm)) return null;
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  if (inches === 12) {
    return `${feet + 1}'0"`;
  }
  return `${feet}'${inches}"`;
};

const kgToLb = (kg) => {
  if (!kg || isNaN(kg)) return null;
  const lb = Math.round(kg * 2.20462);
  return `${lb} lbs`;
};

export default function MeasurementsScreen({ navigation }) {
  const { data, updateData } = useOnboarding();
  const insets = useSafeAreaInsets();

  const handleContinue = () => {
    Keyboard.dismiss();

    const heightVal = parseInt(data.height);
    const weightVal = parseInt(data.weight);

    if (heightVal < 150 || heightVal > 250) {
      Alert.alert(
        'Invalid Height',
        'Please enter a height between 150 and 250 cm.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (weightVal < 50 || weightVal > 200) {
      Alert.alert(
        'Invalid Weight',
        'Please enter a weight between 50 and 200 kg.',
        [{ text: 'OK' }]
      );
      return;
    }

    navigation.navigate('OnboardingQuestionnaire2');
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const isValid = data.height.length > 0 && data.weight.length > 0;
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
          <Text style={styles.title}>Your measurements</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Height (cm)</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Enter your height"
                placeholderTextColor="#999"
                value={data.height}
                onChangeText={(text) => updateData({ height: text.replace(/[^0-9]/g, '') })}
                keyboardType="number-pad"
                maxLength={3}
                returnKeyType="next"
              />
              {data.height && cmToFt(parseInt(data.height)) && (
                <Text style={styles.conversionText}>≈ {cmToFt(parseInt(data.height))}</Text>
              )}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Weight (kg)</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Enter your weight"
                placeholderTextColor="#999"
                value={data.weight}
                onChangeText={(text) => updateData({ weight: text.replace(/[^0-9]/g, '') })}
                keyboardType="number-pad"
                maxLength={3}
                returnKeyType="done"
                onSubmitEditing={() => Keyboard.dismiss()}
              />
              {data.weight && kgToLb(parseInt(data.weight)) && (
                <Text style={styles.conversionText}>≈ {kgToLb(parseInt(data.weight))}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Bottom bar with Continue button */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={[styles.continueButton, !isValid && styles.continueButtonDisabled]}
            onPress={handleContinue}
            activeOpacity={0.7}
            disabled={!isValid}
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
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3a3b3c',
    marginBottom: 8,
  },
  inputWrapper: {
    position: 'relative',
  },
  input: {
    fontSize: 16,
    color: '#3a3b3c',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    borderRadius: 8,
    padding: 12,
    paddingRight: 90,
    backgroundColor: '#f5f5f5',
  },
  conversionText: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    textAlignVertical: 'center',
    lineHeight: 46,
    fontSize: 14,
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
