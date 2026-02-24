import React from 'react';
import { Text as RNText } from 'react-native';
import { StyleSheet } from 'react-native';

const getFontFamily = (weight) => {
  if (weight === 'bold' || weight === '700') {
    return 'DMSans_700Bold';
  }
  return 'DMSans_500Medium';
};

export default function Text({ style, children, ...props }) {
  const fontFamily = getFontFamily(StyleSheet.flatten(style)?.fontWeight);

  return (
    <RNText
      {...props}
      style={[style, { fontFamily, fontWeight: 'normal' }]}
    >
      {children}
    </RNText>
  );
}
