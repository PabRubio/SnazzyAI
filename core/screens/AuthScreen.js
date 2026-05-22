import React, { useState } from 'react';
import Text from '../components/Text';
import { StyleSheet, View, TouchableOpacity, Image, ActivityIndicator, Alert, Dimensions, ScrollView, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlacement } from 'expo-superwall';
import { supabase } from '../../supabase/services/supabase';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useNavigation } from '../components/navigation/NavigationContext';

const { width } = Dimensions.get('window');

const GOOGLE_WEB_CLIENT_ID = '100333808813-h41jibhk6cffhqec6qosait664ib30mm.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID = '100333808813-ad04fams427h7udjq5877dokoqmf8gss.apps.googleusercontent.com';

GoogleSignin.configure({
  scopes: ['profile', 'email'],
  webClientId: GOOGLE_WEB_CLIENT_ID,
  iosClientId: GOOGLE_IOS_CLIENT_ID,
});

export default function AuthScreen({ navigation }) {
  const [language, setLanguage] = useState('en');
  const [loading, setLoading] = useState(false);
  const { switchToAppStack } = useNavigation();
  const insets = useSafeAreaInsets();

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
        if (Platform.OS === 'android') {
          handleGoogleSignIn();
        }

        if (Platform.OS === 'ios') {
          handleAppleSignIn();
        }
      }
    },
    onError: (error) => {
      console.error('Paywall error:', error);
      Alert.alert('Error', 'Failed to show paywall. Please try again.');
    }
  });

  const handleGetStarted = async () => {
    // Navigate to onboarding flow
    navigation.navigate('Onboarding');
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

      // Manually switch to app stack
      switchToAppStack();

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

      const okButton = [{ text: 'OK' }];

      Alert.alert(
        'Sign-In Failed',
        errorMessage,
        okButton
      );

      // Only set loading to false on error
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setLoading(true);

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error('No Apple identity token returned');
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        token: credential.identityToken,
        provider: 'apple',
      });

      if (error) {
        throw error;
      }

      console.log('Successfully signed in:', data.user.email);

      // Manually switch to app stack
      switchToAppStack();

    } catch (error) {
      if (error.code === 'ERR_REQUEST_CANCELED') {
        setLoading(false);
        return;
      }

      console.error('Sign-in error:', error);

      let errorMessage = 'Failed to sign in with Apple';

      if (error.message) {
        errorMessage = error.message;
      }

      const okButton = [{ text: 'OK' }];

      Alert.alert(
        'Sign-In Failed',
        errorMessage,
        okButton
      );

      // Only set loading to false on error
      setLoading(false);
    }
  };

  const authHandler = () => {
    if (Platform.OS === 'android') {
      handleGoogleSignIn();
    }

    if (Platform.OS === 'ios') {
      handleAppleSignIn();
    }
  };

  return (
    <View style={styles.container}>
      {loading ? (
        // Loading screen - matching HomeScreen pattern
        <View style={[styles.container, styles.centerContent]}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>{language === 'en'
            ? 'Loading...'
            : 'Cargando...'}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View>
            <View style={styles.logoContainer}>
              <Image
                source={require('../../assets/logo3-transparent.png')}
                resizeMode="contain"
                style={styles.logo}
              />
            </View>

            {/* <View style={styles.languageToggleContainer}>
              <View style={styles.languageToggle}>
                <TouchableOpacity
                  style={[styles.languageOption, language === 'en' && styles.languageOptionActive]}
                  onPress={() => setLanguage('en')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.flagEmoji}>🇺🇸</Text><Text style={styles.langText}> EN</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.languageOption, language === 'es' && styles.languageOptionActive]}
                  onPress={() => setLanguage('es')}
                  activeOpacity={0.7}
                  disabled
                >
                  <Text style={styles.flagEmoji}>🇪🇸</Text><Text style={styles.langText}> ES</Text>
                </TouchableOpacity>
              </View>
            </View> */}
          </View>

          <View style={styles.screenshotWrapper}>
            <View style={styles.screenshotContainer}>
              <Image
                source={require('../../assets/screenshot-transparent.png')}
                style={styles.screenshot}
                resizeMode="contain"
              />
            </View>
          </View>

          <View style={[styles.buttonContainer, { paddingBottom: insets.bottom + 12 }]}>
            <Text style={styles.tagline}>{language === 'en'
              ? 'The personal AI stylist in your pocket'
              : 'El estilista personal de IA en tu bolsillo'}</Text>

            <TouchableOpacity
              style={styles.getStartedButton}
              onPress={handleGetStarted}
              activeOpacity={0.7}
            >
              <Text style={styles.getStartedButtonText}>{language === 'en'
                ? 'Get Started'
                : 'Comenzar'}</Text>
            </TouchableOpacity>

            {Platform.OS === 'ios' ? (
              <View style={styles.appleSignInContainer}>
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  style={styles.appleSignInButton}
                  onPress={authHandler}
                  cornerRadius={12}
                />
              </View>
            ) : (
              <View style={styles.signInContainer}>
                <Text style={styles.signInText}>{language === 'en'
                  ? 'Already have an account? ' : '¿Ya tienes una cuenta? '}</Text>
                <TouchableOpacity
                  disabled={loading}
                  activeOpacity={0.7}
                  onPress={authHandler}
                >
                  <Text style={styles.signInLink}>{language === 'en' ? 'Sign in' : 'Iniciar sesión'}</Text>
                </TouchableOpacity>
              </View>
            )}
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
    fontWeight: '500',
    color: '#3a3b3c',
    marginTop: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    minHeight: '100%',
  },
  screenshotWrapper: {
    justifyContent: 'center',
    flex: 1,
  },
  buttonContainer: {
    paddingHorizontal: 20,
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
  // Language toggle
  languageToggleContainer: {
    alignItems: 'center',
    zIndex: 1,
  },
  languageToggle: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    padding: 2,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  languageOptionActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  flagEmoji: {
    fontSize: 14,
  },
  langText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#3a3b3c',
  },
  // Screenshot2 container
  screenshotContainer: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  screenshot: {
    width: width * 0.95,
    height: 360,
  },
  // Tagline text
  tagline: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3a3b3c',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 16,
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
    fontWeight: '500',
  },
  // Sign in text container
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  appleSignInContainer: {
    alignItems: 'center',
  },
  appleSignInButton: {
    width: '100%',
    height: 48,
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
