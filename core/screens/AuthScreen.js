import { GoogleSignin } from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import { StatusBar } from "expo-status-bar";
import { usePlacement } from "expo-superwall";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "../../supabase/services/supabase";
import { syncAppleProfileFromCredential } from "../../supabase/services/supabaseHelpers";
import { useNavigation } from "../components/navigation/NavigationContext";
import Text from "../components/typography/Text";

const { width } = Dimensions.get("window");

const GOOGLE_WEB_CLIENT_ID =
  "100333808813-h41jibhk6cffhqec6qosait664ib30mm.apps.googleusercontent.com";
const GOOGLE_IOS_CLIENT_ID =
  "100333808813-ad04fams427h7udjq5877dokoqmf8gss.apps.googleusercontent.com";

GoogleSignin.configure({
  iosClientId: GOOGLE_IOS_CLIENT_ID,
  scopes: ["profile", "email"],
  webClientId: GOOGLE_WEB_CLIENT_ID,
});

export default function AuthScreen({ navigation }) {
  // Retained for the paused language selector below.
  // eslint-disable-next-line no-unused-vars
  const [language, setLanguage] = useState("en");
  const [loading, setLoading] = useState(false);
  const { switchToAppStack } = useNavigation();
  const insets = useSafeAreaInsets();

  usePlacement({
    onDismiss: (info, result) => {
      if (result?.state === "purchased") {
        if (Platform.OS === "android") {
          handleGoogleSignIn();
        }

        if (Platform.OS === "ios") {
          handleAppleSignIn();
        }
      }
    },
    onError: (_error) => {
      Alert.alert("Error", "Failed to show paywall. Please try again.");
    },
    onPresent: (_info) => {},
  });

  const handleGetStarted = async () => {
    navigation.navigate("Onboarding");
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);

      await GoogleSignin.hasPlayServices();

      // Ensure the account picker is shown for every sign-in attempt.
      await GoogleSignin.signOut();

      const userInfo = await GoogleSignin.signIn();

      // Support both response shapes returned by compatible library versions.
      const idToken = userInfo.idToken || userInfo.data?.idToken;

      if (!idToken) {
        throw new Error("No ID token returned from Google Sign-In");
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
      });

      if (error) {
        throw error;
      }

      switchToAppStack();
    } catch (error) {
      let errorMessage = "Failed to sign in with Google";

      if (error.code === "SIGN_IN_CANCELLED") {
        errorMessage = "Sign-in cancelled";
      } else if (error.code === "IN_PROGRESS") {
        errorMessage = "Sign-in already in progress";
      } else if (error.code === "PLAY_SERVICES_NOT_AVAILABLE") {
        errorMessage = "Google Play Services not available";
      } else if (error.message) {
        errorMessage = error.message;
      }

      const alertButtons = [{ text: "OK" }];

      Alert.alert("Sign-In Failed", errorMessage, alertButtons);

      // Keep the loading state active after success while the app stack switches.
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
        throw new Error("No Apple identity token returned");
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
      });

      if (error) {
        throw error;
      }

      await syncAppleProfileFromCredential(credential, data.user);

      switchToAppStack();
    } catch (error) {
      if (error.code === "ERR_REQUEST_CANCELED") {
        setLoading(false);
        return;
      }

      let errorMessage = "Failed to sign in with Apple";

      if (error.message) {
        errorMessage = error.message;
      }

      const alertButtons = [{ text: "OK" }];

      Alert.alert("Sign-In Failed", errorMessage, alertButtons);

      // Keep the loading state active after success while the app stack switches.
      setLoading(false);
    }
  };

  const handleSignIn = () => {
    if (Platform.OS === "android") {
      handleGoogleSignIn();
    }

    if (Platform.OS === "ios") {
      handleAppleSignIn();
    }
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={[styles.container, styles.centerContent]}>
          <ActivityIndicator color="#007AFF" size="large" />
          <Text style={styles.loadingText}>
            {language === "en" ? "Loading..." : "Cargando..."}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          style={styles.scrollView}
        >
          <View>
            <View style={styles.logoContainer}>
              <Image
                resizeMode="contain"
                source={require("../../assets/logo3-transparent.png")}
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
                resizeMode="contain"
                source={require("../../assets/screenshot-transparent.png")}
                style={styles.screenshot}
              />
            </View>
          </View>

          <View
            style={[
              styles.buttonContainer,
              { paddingBottom: insets.bottom + 12 },
            ]}
          >
            <Text style={styles.tagline}>
              {language === "en"
                ? "The personal AI stylist in your pocket"
                : "El estilista personal de IA en tu bolsillo"}
            </Text>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleGetStarted}
              style={styles.getStartedButton}
            >
              <Text style={styles.getStartedButtonText}>
                {language === "en" ? "Get Started" : "Comenzar"}
              </Text>
            </TouchableOpacity>

            {Platform.OS === "ios" ? (
              <View style={styles.appleSignInContainer}>
                <AppleAuthentication.AppleAuthenticationButton
                  buttonStyle={
                    AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                  }
                  buttonType={
                    AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                  }
                  cornerRadius={12}
                  onPress={handleSignIn}
                  style={styles.appleSignInButton}
                />
              </View>
            ) : (
              <View style={styles.signInContainer}>
                <Text style={styles.signInText}>
                  {language === "en"
                    ? "Already have an account? "
                    : "¿Ya tienes una cuenta? "}
                </Text>
                <TouchableOpacity
                  activeOpacity={0.7}
                  disabled={loading}
                  onPress={handleSignIn}
                >
                  <Text style={styles.signInLink}>
                    {language === "en" ? "Sign in" : "Iniciar sesión"}
                  </Text>
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
  appleSignInButton: {
    height: 48,
    width: "100%",
  },
  appleSignInContainer: {
    alignItems: "center",
  },
  buttonContainer: {
    paddingHorizontal: 20,
  },
  centerContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    backgroundColor: "#fff",
    flex: 1,
  },
  flagEmoji: {
    fontSize: 14,
  },
  getStartedButton: {
    alignItems: "center",
    backgroundColor: "#007AFF",
    borderRadius: 12,
    elevation: 3,
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 16,
    paddingHorizontal: 24,
    paddingVertical: 14,
    shadowColor: "#000",
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  getStartedButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  langText: {
    color: "#3a3b3c",
    fontSize: 10,
    fontWeight: "bold",
  },
  languageOption: {
    alignItems: "center",
    borderRadius: 10,
    flexDirection: "row",
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  languageOptionActive: {
    backgroundColor: "#fff",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { height: 1, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  languageToggle: {
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
    flexDirection: "row",
    padding: 2,
  },
  languageToggleContainer: {
    alignItems: "center",
    zIndex: 1,
  },
  loadingText: {
    color: "#3a3b3c",
    fontSize: 18,
    fontWeight: "500",
    marginTop: 16,
  },
  logo: {
    height: 300,
    marginBottom: -100,
    marginTop: -60,
    width: width * 0.9,
  },
  logoContainer: {
    alignItems: "center",
    paddingHorizontal: 20,
  },
  screenshot: {
    height: 360,
    width: width * 0.95,
  },
  screenshotContainer: {
    alignItems: "center",
    paddingHorizontal: 20,
  },
  screenshotWrapper: {
    flex: 1,
    justifyContent: "center",
  },
  scrollContent: {
    flexGrow: 1,
    minHeight: "100%",
  },
  scrollView: {
    flex: 1,
  },
  signInContainer: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  signInLink: {
    color: "#3a3b3c",
    fontSize: 14,
    fontWeight: "bold",
    textDecorationLine: "underline",
  },
  signInText: {
    color: "#3a3b3c",
    fontSize: 14,
  },
  tagline: {
    color: "#3a3b3c",
    fontSize: 32,
    fontWeight: "bold",
    letterSpacing: 0.5,
    marginBottom: 16,
    textAlign: "center",
  },
});
