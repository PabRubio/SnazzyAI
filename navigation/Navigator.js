import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SuperwallProvider } from 'expo-superwall';
import Constants from 'expo-constants';
import { NavigationProvider, useNavigation } from './NavigationContext';
import Onboarding from '../screens/Onboarding';
import AuthScreen from '../screens/AuthScreen';
import HomeScreen from '../screens/HomeScreen';
import CameraScreen from '../screens/CameraScreen';

const Stack = createStackNavigator();

function AppNavigatorContent() {
  const { showAppStack, isLoading } = useNavigation();

  // Show loading spinner while checking auth state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const superwallApiKey = Constants.expoConfig?.extra?.superwallApiKey;

  return (
    <SuperwallProvider
      apiKeys={{
        ios: superwallApiKey,
        android: superwallApiKey
      }}
    >
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={showAppStack ? "Home" : "Auth"}
          screenOptions={{
            headerShown: false,
            gestureEnabled: false,
            animationEnabled: false,
            cardStyle: { backgroundColor: '#fff' }
          }}
        >
          {!showAppStack ? (
            // Auth Stack - User not logged in
            <>
              <Stack.Screen name="Auth" component={AuthScreen} />
              <Stack.Screen name="Onboarding" component={Onboarding} />
            </>
          ) : (
            // App Stack - User logged in
            <>
              <Stack.Screen name="Home" component={HomeScreen} />
              <Stack.Screen
                name="Camera"
                component={CameraScreen}
                options={{
                  animationEnabled: true,
                  presentation: 'transparentModal',
                  cardStyle: { backgroundColor: '#3a3b3c' }
                }}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SuperwallProvider>
  );
}

export default function AppNavigator() {
  return (
    <NavigationProvider>
      <AppNavigatorContent />
    </NavigationProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
});
