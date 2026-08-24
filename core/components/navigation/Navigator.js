import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import Constants from "expo-constants";
import { SuperwallProvider } from "expo-superwall";
import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import AuthScreen from "../../screens/AuthScreen";
import CameraScreen from "../../screens/CameraScreen";
import HomeScreen from "../../screens/HomeScreen";
import Onboarding from "../../screens/Onboarding";
import SuperwallIdentity from "../AuthBridge";
import { NavigationProvider, useNavigation } from "./NavigationContext";

const Stack = createStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationProvider>
      <AppNavigatorContent />
    </NavigationProvider>
  );
}

function AppNavigatorContent() {
  const { isLoading, showAppStack } = useNavigation();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#007AFF" size="large" />
      </View>
    );
  }

  const superwallAndroidApiKey = Constants.expoConfig?.extra?.superwallApiKey;
  const superwallIosApiKey = Constants.expoConfig?.extra?.superwallIosKey;

  return (
    <SuperwallProvider
      apiKeys={{
        android: superwallAndroidApiKey,
        ios: superwallIosApiKey,
      }}
    >
      <SuperwallIdentity />
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={showAppStack ? "Home" : "Auth"}
          screenOptions={{
            animationEnabled: false,
            cardStyle: { backgroundColor: "#fff" },
            gestureEnabled: false,
            headerShown: false,
          }}
        >
          {!showAppStack ? (
            <>
              <Stack.Screen component={AuthScreen} name="Auth" />
              <Stack.Screen component={Onboarding} name="Onboarding" />
            </>
          ) : (
            <>
              <Stack.Screen component={HomeScreen} name="Home" />
              <Stack.Screen
                component={CameraScreen}
                name="Camera"
                options={{
                  animationEnabled: false,
                  cardStyle: { backgroundColor: "#3a3b3c" },
                  cardStyleInterpolator: () => ({}),
                }}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SuperwallProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    alignItems: "center",
    backgroundColor: "#fff",
    flex: 1,
    justifyContent: "center",
  },
});
