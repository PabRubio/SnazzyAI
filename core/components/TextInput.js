import React from 'react';
import { TextInput as RNTextInput } from 'react-native';
import { StyleSheet } from 'react-native';

const getFontFamily = (weight) => {
  if (weight === 'bold' || weight === '700') {
    return 'DMSans_700Bold';
  }
  return 'DMSans_500Medium';
};

export default function TextInput({ style, ...props }) {
  const fontFamily = getFontFamily(StyleSheet.flatten(style)?.fontWeight);
  const fontStyle = { fontFamily, fontWeight: 'normal' };

  return (
    <RNTextInput {...props} style={[style, fontStyle]} />
  );
}
