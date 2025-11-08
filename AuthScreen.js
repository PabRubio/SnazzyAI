import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, ActivityIndicator, Alert, Dimensions, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { usePlacement } from 'expo-superwall';
import { supabase } from './lib/supabase';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

const { width } = Dimensions.get('window');

// Configure Google Sign-In
GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  scopes: ['profile', 'email'],
  offlineAccess: true,
});

export default function AuthScreen() {
  const [loading, setLoading] = useState(false);

  // Setup Superwall paywall
  const { registerPlacement } = usePlacement({
    onPresent: (info) => {
      console.log('Paywall presented:', info);
    },
    onDismiss: (info, result) => {
      console.log('Paywall dismissed:', info, 'Result:', result);
      // If user completed purchase, you can handle it here
      if (result?.state === 'purchased') {
        console.log('User purchased subscription!');
        // Continue to sign in flow
        handleGoogleSignIn();
      }
    },
    onError: (error) => {
      console.error('Paywall error:', error);
      Alert.alert('Error', 'Failed to show paywall. Please try again.');
    }
  });

  const handleGetStarted = async () => {
    try {
      // Trigger the paywall - use 'campaign_trigger' or your custom placement
      await registerPlacement({
        placement: 'campaign_trigger'
      });
    } catch (error) {
      console.error('Failed to show paywall:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);

      // Check if Google Play Services are available (Android)
      await GoogleSignin.hasPlayServices();

      // Sign out first to ensure account picker shows
      await GoogleSignin.signOut();

      // Sign in with Google
      const userInfo = await GoogleSignin.signIn();

      // Get Google ID token (check both possible locations)
      const idToken = userInfo.idToken || userInfo.data?.idToken;

      if (!idToken) {
        console.error('Sign-in response:', JSON.stringify(userInfo, null, 2));
        throw new Error('No ID token returned from Google Sign-In');
      }

      // Sign in to Supabase with Google ID token
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (error) {
        throw error;
      }

      console.log('Successfully signed in:', data.user.email);

      // Navigation will happen automatically via auth state change
      // Keep loading state active until navigation happens - don't set to false

    } catch (error) {
      console.error('Sign-in error:', error);

      let errorMessage = 'Failed to sign in with Google';

      if (error.code === 'SIGN_IN_CANCELLED') {
        errorMessage = 'Sign-in cancelled';
      } else if (error.code === 'IN_PROGRESS') {
        errorMessage = 'Sign-in already in progress';
      } else if (error.code === 'PLAY_SERVICES_NOT_AVAILABLE') {
        errorMessage = 'Google Play Services not available';
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert(
        'Sign-In Failed',
        errorMessage,
        [{ text: 'OK' }]
      );

      // Only set loading to false on error
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {loading ? (
        // Loading screen - matching HomeScreen pattern
        <View style={[styles.container, styles.centerContent]}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Logo at top */}
          <View style={styles.logoContainer}>
            <Image
              source={require('./assets/logo3.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* Screenshot2 under the logo */}
          <View style={styles.screenshotContainer}>
            <Image
              source={require('./assets/screenshot2.png')}
              style={styles.screenshot}
              resizeMode="contain"
            />
          </View>

          {/* Big tagline text */}
          <View style={styles.taglineContainer}>
            <Text style={styles.tagline}>The personal AI stylist in your pocket</Text>
          </View>

          {/* Get Started button */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.getStartedButton}
              onPress={handleGetStarted}
              activeOpacity={0.7}
            >
              <Text style={styles.getStartedButtonText}>Get Started</Text>
            </TouchableOpacity>

            {/* Already have an account text */}
            <View style={styles.signInContainer}>
              <Text style={styles.signInText}>Already have an account? </Text>
              <TouchableOpacity
                onPress={handleGoogleSignIn}
                disabled={loading}
                activeOpacity={0.7}
              >
                <Text style={styles.signInLink}>Sign in</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}

      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3a3b3c',
    marginTop: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  // Logo at top - matching HomeScreen exact styling
  logoContainer: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  logo: {
    width: width * 0.9,
    height: 300,
    marginTop: -60,
    marginBottom: -100,
  },
  // Screenshot2 container
  screenshotContainer: {
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 30,
  },
  screenshot: {
    width: width * 0.95,
    height: 360,
  },
  // Tagline text
  taglineContainer: {
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  tagline: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3a3b3c',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  // Button container
  buttonContainer: {
    paddingHorizontal: 20,
  },
  // Get Started button - matching Save Settings button styling
  getStartedButton: {
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
    marginBottom: 16,
  },
  getStartedButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Sign in text container
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signInText: {
    fontSize: 14,
    color: '#3a3b3c',
  },
  signInLink: {
    fontSize: 14,
    color: '#3a3b3c',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
});
