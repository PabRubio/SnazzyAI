import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { supabase } from './lib/supabase';
import AuthScreen from './AuthScreen';
import HomeScreen from './HomeScreen';
import CameraScreen from './CameraScreen';

const Stack = createStackNavigator();

export default function AppNavigator() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Show loading spinner while checking auth state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={session ? "Home" : "Auth"}
        screenOptions={{
          headerShown: false,
          gestureEnabled: false,
          animationEnabled: false,
          cardStyle: { backgroundColor: '#fff' }
        }}
      >
        {!session ? (
          // Auth Stack - User not logged in
          <Stack.Screen name="Auth" component={AuthScreen} />
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
