import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ActivityIndicator, Alert } from 'react-native';
import { usePlacement } from 'expo-superwall';

export default function PaywallScreen({ navigation }) {
  const [paywallShown, setPaywallShown] = useState(false);

  const { registerPlacement } = usePlacement({
    onDismiss: () => {
      // Go back to Auth when paywall is dismissed
      navigation.navigate('Auth');
    },
    onError: (error) => {
      console.error('Paywall error:', error);
      Alert.alert('Error', 'Failed to show paywall. Please try again.');
      navigation.navigate('Auth');
    }
  });

  const handleShowPaywall = async () => {
    try {
      await registerPlacement({
        placement: 'campaign_trigger'
      });
    } catch (error) {
      console.error('Failed to show paywall:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
      navigation.navigate('Auth');
    }
  };

  useEffect(() => {
    if (!paywallShown) {
      setPaywallShown(true);
      handleShowPaywall();
    }
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#007AFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
