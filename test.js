import React from 'react';
import { View, Text } from 'react-native';

// Test imports one by one
import ErrorBanner from './components/ErrorBanner';

export default function Test() {
  return (
    <View>
      <Text>Testing components</Text>
      <ErrorBanner message="test" visible={false} />
    </View>
  );
}