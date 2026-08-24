import { Ionicons } from "@expo/vector-icons";
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
  const [language, setLanguage] = useState("en");
  const [loading, setLoading] = useState(false);
  const { switchToAppStack } = useNavigation();
  const insets = useSafeAreaInsets();

  // Setup Superwall paywall
  const { registerPlacement } = usePlacement({
    onDismiss: (info, result) => {
      console.log("Paywall dismissed:", info, "Result:", result);
      // If user completed purchase, you can handle it here
      if (result?.state === "purchased") {
        console.log("User purchased subscription!");
        // Continue to sign in flow
        if (Platform.OS === "android") {
          handleGoogleSignIn();
        }

        if (Platform.OS === "ios") {
          handleAppleSignIn();
        }
      }
    },
    onError: (error) => {
      console.error("Paywall error:", error);
      Alert.alert("Error", "Failed to show paywall. Please try again.");
    },
    onPresent: (info) => {
      console.log("Paywall presented:", info);
    },
  });

  const handleGetStarted = async () => {
    // Navigate to onboarding flow
    navigation.navigate("Onboarding");
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
        console.error("Sign-in response:", JSON.stringify(userInfo, null, 2));
        throw new Error("No ID token returned from Google Sign-In");
      }

      // Sign in to Supabase with Google ID token
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
      });

      if (error) {
        throw error;
      }

      console.log("Successfully signed in:", data.user.email);

      // Manually switch to app stack
      switchToAppStack();
    } catch (error) {
      console.error("Sign-in error:", error);

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

      const okButton = [{ text: "OK" }];

      Alert.alert("Sign-In Failed", errorMessage, okButton);

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
        throw new Error("No Apple identity token returned");
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
      });

      if (error) {
        throw error;
      }

      console.log("Successfully signed in:", data.user.email);
      await syncAppleProfileFromCredential(credential, data.user);

      // Manually switch to app stack
      switchToAppStack();
    } catch (error) {
      if (error.code === "ERR_REQUEST_CANCELED") {
        setLoading(false);
        return;
      }

      console.error("Sign-in error:", error);

      let errorMessage = "Failed to sign in with Apple";

      if (error.message) {
        errorMessage = error.message;
      }

      const okButton = [{ text: "OK" }];

      Alert.alert("Sign-In Failed", errorMessage, okButton);

      // Only set loading to false on error
      setLoading(false);
    }
  };

  const authHandler = () => {
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
        // Loading screen - matching HomeScreen pattern
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
                  onPress={authHandler}
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
                  onPress={authHandler}
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
  // Get Started button - matching Save Settings button styling
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
  // Language toggle
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
  // Logo at top - matching HomeScreen exact styling
  logoContainer: {
    alignItems: "center",
    paddingHorizontal: 20,
  },
  screenshot: {
    height: 360,
    width: width * 0.95,
  },
  // Screenshot2 container
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
  // Sign in text container
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
  // Tagline text
  tagline: {
    color: "#3a3b3c",
    fontSize: 32,
    fontWeight: "bold",
    letterSpacing: 0.5,
    marginBottom: 16,
    textAlign: "center",
  },
});
