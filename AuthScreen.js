import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, ActivityIndicator, Alert, Dimensions, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
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


  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);

      // Check if Google Play Services are available (Android)
      await GoogleSignin.hasPlayServices();

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
      // in Navigator.js

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
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo - matching HomeScreen exact styling */}
        <View style={styles.logoContainer}>
          <Image
            source={require('./assets/logo3.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Welcome Section - card-based like Settings */}
        <View style={styles.welcomeSection}>
          <View style={styles.welcomeCard}>
            <Text style={styles.title}>Welcome to Snazzy AI</Text>
            <Text style={styles.subtitle}>
              AI-powered fashion analysis and style recommendations
            </Text>
          </View>

          {/* Sign-In Card */}
          <View style={styles.signInCard}>
            <Text style={styles.signInLabel}>Get Started</Text>
            <TouchableOpacity
              style={[styles.googleButton, loading && styles.googleButtonDisabled]}
              onPress={handleGoogleSignIn}
              disabled={loading}
              activeOpacity={0.7}
            >
              {loading ? (
                <>
                  <ActivityIndicator size="small" color="#fff" style={styles.googleIcon} />
                  <Text style={styles.googleButtonText}>Signing in...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="logo-google" size={20} color="#fff" style={styles.googleIcon} />
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Privacy Text */}
            <Text style={styles.privacyText}>
              By continuing, you agree to our Terms of Service and Privacy Policy
            </Text>
          </View>
        </View>
      </ScrollView>

      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  // Logo container - matching HomeScreen exact styling
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
  // Welcome section - matching Settings section spacing
  welcomeSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  // Welcome card - matching Settings card styling
  welcomeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3a3b3c',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#3a3b3c',
    textAlign: 'center',
    lineHeight: 22,
  },
  // Sign-In card - matching Settings card styling
  signInCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  signInLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3a3b3c',
    marginBottom: 12,
  },
  // Google button - matching Save Settings button styling
  googleButton: {
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
    marginBottom: 12,
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleIcon: {
    marginRight: 8,
  },
  googleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  privacyText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 18,
  },
});
