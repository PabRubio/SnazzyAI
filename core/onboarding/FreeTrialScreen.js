import { Ionicons } from "@expo/vector-icons";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import * as StoreReview from "expo-store-review";
import { usePlacement, useSuperwall } from "expo-superwall";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Linking,
  Platform,
  StatusBar as RNStatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "../../supabase/services/supabase";
import {
  saveOutfitAnalysis,
  saveRecommendations,
  syncAppleProfileFromCredential,
  uploadPhoto,
} from "../../supabase/services/supabaseHelpers";
import { useNavigation } from "../components/navigation/NavigationContext";
import Text from "../components/typography/Text";
import { useOnboarding } from "./OnboardingContext";

const { height } = Dimensions.get("window");
const BUTTON_SIZE = 60;

const GOOGLE_WEB_CLIENT_ID =
  "100333808813-h41jibhk6cffhqec6qosait664ib30mm.apps.googleusercontent.com";
const GOOGLE_IOS_CLIENT_ID =
  "100333808813-ad04fams427h7udjq5877dokoqmf8gss.apps.googleusercontent.com";

GoogleSignin.configure({
  iosClientId: GOOGLE_IOS_CLIENT_ID,
  scopes: ["profile", "email"],
  webClientId: GOOGLE_WEB_CLIENT_ID,
});

const safeHaptic = async (hapticFunction) => {
  try {
    await hapticFunction();
  } catch {
    // Haptics are optional and may be unavailable on some devices.
  }
};

export default function FreeTrialScreen({ navigation }) {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [permissionRequested, setPermissionRequested] = useState(false);
  const { data: onboardingData } = useOnboarding();
  const userProfile = useMemo(() => {
    let birthDate = null;
    if (onboardingData.birth) {
      const year = onboardingData.birth.getFullYear();
      const month = String(onboardingData.birth.getMonth() + 1).padStart(
        2,
        "0",
      );
      const day = String(onboardingData.birth.getDate()).padStart(2, "0");
      birthDate = `${year}-${month}-${day}`;
    }

    return {
      birth: birthDate,
      currency: onboardingData.currency || null,
      favorite_brands: onboardingData.favoriteBrands || [],
      favorite_styles: onboardingData.favoriteStyles || [],
      gender: onboardingData.gender || null,
      height: onboardingData.height ? parseInt(onboardingData.height) : null,
      location: onboardingData.location || null,
      pants_size: onboardingData.pantsSize || null,
      price_max: onboardingData.priceMax
        ? parseInt(onboardingData.priceMax)
        : null,
      price_min: onboardingData.priceMin
        ? parseInt(onboardingData.priceMin)
        : null,
      response_1: onboardingData.questionnaire1 ?? null,
      response_2: onboardingData.questionnaire2 || null,
      response_3: onboardingData.questionnaire3 || null,
      shirt_size: onboardingData.shirtSize || null,
      shoe_size: onboardingData.shoeSize || null,
      weight: onboardingData.weight ? parseInt(onboardingData.weight) : null,
    };
  }, [onboardingData]);
  const { switchToAppStack } = useNavigation();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [, setIsCapturing] = useState(false);
  const [isProcessingCapture, setIsProcessingCapture] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [capturedPhotoUri, setCapturedPhotoUri] = useState(null);
  const [capturedPhotoBase64, setCapturedPhotoBase64] = useState(null);
  const [isGeneratingRecommendations, setIsGeneratingRecommendations] =
    useState(false);
  const [hasGeneratedRecommendations, setHasGeneratedRecommendations] =
    useState(false);
  const [recommendationClickCount, setRecommendationClickCount] = useState(0);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const hasCameraPermission = cameraPermission?.granted === true;
  const [showInstruction, setShowInstruction] = useState(true);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const cameraRef = useRef(null);
  const insets = useSafeAreaInsets();
  const captureTimerRef = useRef(null);
  const hapticIntervalRef = useRef(null);
  const delayedCaptureRef = useRef(null);
  const hasRequestedReviewRef = useRef(false);
  const analysisAbortControllerRef = useRef(null);
  const recommendationsAbortControllerRef = useRef(null);

  const { dismiss } = useSuperwall();
  const { registerPlacement } = usePlacement({
    onDismiss: (_info, result) => {
      if (["purchased", "restored"].includes(result?.type)) {
        switchToAppStack();
      }
    },
    onError: (_error) => {},
  });

  const showPaywall = async () => {
    try {
      await dismiss();
      await registerPlacement({
        placement: "campaign_trigger",
      });
    } catch {}
  };

  const bottomSheetRef = useRef(null);
  const snapPoints = useMemo(() => ["25%", "85%"], []);

  // Request an in-app review after the first upward expansion.
  const handleBottomSheetChange = useCallback(
    async (index) => {
      if (index === 1 && !hasRequestedReviewRef.current && analysisResult) {
        hasRequestedReviewRef.current = true;
        if (await StoreReview.hasAction()) {
          StoreReview.requestReview();
        }
      }
    },
    [analysisResult],
  );

  const handlePickImage = async () => {
    if (isProcessingCapture) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        base64: true,
        mediaTypes: ["images"],
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const photo = result.assets[0];

      setIsProcessingCapture(true);
      setCapturedPhotoUri(photo.uri);
      setCapturedPhotoBase64(photo.base64);

      setIsAnalyzing(true);
      setAnalysisResult(null);
      bottomSheetRef.current?.snapToIndex(0);

      const abortController = new AbortController();
      analysisAbortControllerRef.current = abortController;

      try {
        const { data, error } = await supabase.functions.invoke(
          "analyze-outfit",
          {
            body: {
              base64Image: photo.base64,
              userProfile: userProfile,
            },
          },
        );

        if (error) {
          throw new Error(error.message || "Analysis failed");
        }

        if (!data) {
          throw new Error("No analysis returned");
        }

        const analysisData = { analysis: data };

        if (analysisAbortControllerRef.current === abortController) {
          analysisAbortControllerRef.current = null;
        }

        setCapturedPhotoUri((currentUri) => {
          if (!currentUri) {
            setIsAnalyzing(false);
            setIsProcessingCapture(false);
            return currentUri;
          }

          setAnalysisResult({ ...analysisData.analysis });
          setIsProcessingCapture(false);
          setIsAnalyzing(false);

          return currentUri;
        });
      } catch (analysisError) {
        if (analysisAbortControllerRef.current === abortController) {
          analysisAbortControllerRef.current = null;
        }

        if (analysisError.name === "AbortError") {
          setIsAnalyzing(false);
          setIsProcessingCapture(false);
          return;
        }

        setCapturedPhotoUri((currentUri) => {
          if (!currentUri) {
            setIsAnalyzing(false);
            setIsProcessingCapture(false);
            return currentUri;
          }

          setIsAnalyzing(false);
          bottomSheetRef.current?.close();

          let errorMsg = "Connection error. Please check your network.";
          if (analysisError.message) {
            if (
              analysisError.message.includes("Network") ||
              analysisError.message.includes("connection") ||
              analysisError.message.includes("timeout")
            ) {
              errorMsg = "Connection error. Please check your network.";
            } else if (analysisError.message.includes("API key")) {
              errorMsg = "Configuration error. Please check API settings.";
            } else if (analysisError.message.includes("Rate limit")) {
              errorMsg = "Too many requests. Please try again.";
            }
          }

          Alert.alert("Analysis Failed", errorMsg, [{ text: "OK" }]);
          setTimeout(() => {
            setCapturedPhotoUri(null);
            setIsProcessingCapture(false);
          }, 500);

          return currentUri;
        });
      }
    } catch {
      setIsProcessingCapture(false);
    }
  };

  const handleOpenPurchaseUrl = useCallback(
    async (url) => {
      if (recommendationClickCount >= 1) {
        showPaywall();
        return;
      }

      setRecommendationClickCount((prev) => prev + 1);

      if (!url) {
        Alert.alert(
          "Link Unavailable",
          "No purchase link available for this item.",
          [{ text: "OK" }],
        );
        return;
      }

      try {
        const isValidUrl =
          url.startsWith("http://") || url.startsWith("https://");

        if (!isValidUrl) {
          Alert.alert(
            "Invalid Link",
            "The purchase link appears to be invalid.",
            [{ text: "OK" }],
          );
          return;
        }

        await Linking.openURL(url);
      } catch {
        Alert.alert(
          "Error",
          "Unable to open the link. Please try again later.",
          [{ text: "OK" }],
        );
      }
    },
    [recommendationClickCount],
  );

  const handleToggleFavorite = useCallback(() => {
    showPaywall();
  }, []);

  const handleRefresh = useCallback(() => {
    if (analysisAbortControllerRef.current) {
      analysisAbortControllerRef.current.abort();
      analysisAbortControllerRef.current = null;
    }
    if (recommendationsAbortControllerRef.current) {
      recommendationsAbortControllerRef.current.abort();
      recommendationsAbortControllerRef.current = null;
    }

    bottomSheetRef.current?.close();

    setTimeout(() => {
      setCapturedPhotoUri(null);
      setCapturedPhotoBase64(null);
      setAnalysisResult(null);
      setIsCapturing(false);
      setIsProcessingCapture(false);
      setIsAnalyzing(false);
      setHasGeneratedRecommendations(false);
      setIsGeneratingRecommendations(false);
      setIsDescriptionExpanded(false);
      setTorchEnabled(false);
    }, 250);
  }, []);

  const saveOnboardingProfile = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        ...userProfile,
      });

      if (error) throw error;

      if (capturedPhotoBase64 && analysisResult) {
        try {
          const { url: photoUrl } = await uploadPhoto(
            capturedPhotoBase64,
            "outfit-photos",
          );
          const analysisId = await saveOutfitAnalysis(analysisResult, photoUrl);
          setAnalysisResult((prev) => ({ ...prev, analysisId }));
        } catch {}
      }
    } catch {}
  };

  const generateRecommendationsAfterAuth = async () => {
    if (!analysisResult || !analysisResult.isValidPhoto) return;

    setIsGeneratingRecommendations(true);

    const abortController = new AbortController();
    recommendationsAbortControllerRef.current = abortController;

    try {
      const accumulatedProducts = [];

      for (let attempt = 0; attempt < 3; attempt++) {
        if (abortController.signal.aborted) break;

        const { data, error } = await supabase.functions.invoke(
          "search-products-2",
          {
            body: {
              base64Image: capturedPhotoBase64,
              outfitName: analysisResult?.outfitName || "",
              userProfile: userProfile,
            },
          },
        );

        if (error) {
          continue;
        }

        if (data?.products) {
          const existingUrls = new Set(
            accumulatedProducts.map((product) => product.purchaseUrl),
          );
          const newProducts = data.products.filter(
            (product) => !existingUrls.has(product.purchaseUrl),
          );
          newProducts.forEach((product) => {
            accumulatedProducts.push(product);
          });
        }

        if (accumulatedProducts.length >= 10) break;
      }

      const recommendations = accumulatedProducts.slice(0, 10);

      if (recommendations.length === 0) {
        throw new Error("No recommendations returned after 3 attempts");
      }

      if (recommendationsAbortControllerRef.current === abortController) {
        recommendationsAbortControllerRef.current = null;
      }

      setAnalysisResult((prevResult) => {
        const updatedResult = {
          ...prevResult,
          recommendations,
        };

        if (prevResult.analysisId) {
          saveRecommendations(prevResult.analysisId, recommendations).catch(
            () => {},
          );
        }

        return updatedResult;
      });

      setHasGeneratedRecommendations(true);
      setIsGeneratingRecommendations(false);
    } catch (error) {
      if (recommendationsAbortControllerRef.current === abortController) {
        recommendationsAbortControllerRef.current = null;
      }

      if (error.name === "AbortError") {
        setIsGeneratingRecommendations(false);
        return;
      }

      setIsGeneratingRecommendations(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsSigningIn(true);

      await GoogleSignin.hasPlayServices();
      await GoogleSignin.signOut();
      const userInfo = await GoogleSignin.signIn();

      const idToken = userInfo.idToken || userInfo.data?.idToken;
      if (!idToken) {
        throw new Error("No ID token returned from Google Sign-In");
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
      });

      if (error) throw error;

      const { data: profile } = await supabase
        .from("profiles")
        .select("shoe_size")
        .eq("id", data.user.id)
        .single();

      const isExistingUser = profile && profile.shoe_size;

      if (isExistingUser) {
        // Existing users skip onboarding persistence and the paywall.
        switchToAppStack();
      } else {
        setIsAuthenticated(true);
        await saveOnboardingProfile();
        await generateRecommendationsAfterAuth();
        // New users remain here to complete the paywall flow.
      }
    } catch (error) {
      let errorMsg = "Failed to sign in with Google";
      if (error.code === "SIGN_IN_CANCELLED") {
        errorMsg = "Sign-in cancelled";
      } else if (error.code === "IN_PROGRESS") {
        errorMsg = "Sign-in already in progress";
      } else if (error.code === "PLAY_SERVICES_NOT_AVAILABLE") {
        errorMsg = "Google Play Services not available";
      } else if (error.message) {
        errorMsg = error.message;
      }

      Alert.alert("Sign-In Failed", errorMsg, [{ text: "OK" }]);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setIsSigningIn(true);

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

      if (error) throw error;
      await syncAppleProfileFromCredential(credential, data.user);

      const { data: profile } = await supabase
        .from("profiles")
        .select("shoe_size")
        .eq("id", data.user.id)
        .single();

      const isExistingUser = profile && profile.shoe_size;

      if (isExistingUser) {
        // Existing users skip onboarding persistence and the paywall.
        switchToAppStack();
      } else {
        setIsAuthenticated(true);
        await saveOnboardingProfile();
        await generateRecommendationsAfterAuth();
        // New users remain here to complete the paywall flow.
      }
    } catch (error) {
      if (error.code === "ERR_REQUEST_CANCELED") {
        return;
      }

      let errorMsg = "Failed to sign in with Apple";
      if (error.message) {
        errorMsg = error.message;
      }

      Alert.alert("Sign-In Failed", errorMsg, [{ text: "OK" }]);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleGenerateRecommendations = useCallback(async () => {
    if (
      !analysisResult ||
      !analysisResult.isValidPhoto ||
      isGeneratingRecommendations ||
      hasGeneratedRecommendations
    ) {
      return;
    }

    if (!isAuthenticated) {
      if (Platform.OS === "ios") {
        handleAppleSignIn();
      }

      if (Platform.OS === "android") {
        handleGoogleSignIn();
      }
      return;
    }

    await generateRecommendationsAfterAuth();
  }, [
    analysisResult,
    isGeneratingRecommendations,
    hasGeneratedRecommendations,
    isAuthenticated,
  ]);

  // Keep dormant animation slots to preserve the established Hook order.
  const buttonScale = useSharedValue(1);
  useSharedValue(0);

  const borderOpacity = useSharedValue(0);
  useSharedValue(0);
  const borderPulse = useSharedValue(0);
  const borderGlow = useSharedValue(0);

  const handlePressIn = async () => {
    if (isProcessingCapture) return;

    if (delayedCaptureRef.current) {
      clearTimeout(delayedCaptureRef.current);
      delayedCaptureRef.current = null;
    }

    setIsCapturing(true);

    hapticIntervalRef.current = setInterval(async () => {
      await safeHaptic(() => Haptics.selectionAsync());
    }, 50);

    buttonScale.value = withTiming(0.85, { duration: 100 });

    borderOpacity.value = withTiming(1, {
      duration: 300,
      easing: Easing.out(Easing.ease),
    });
    // Keep the border opacity static while the capture is active.
    borderPulse.value = withTiming(0.5, {
      duration: 300,
      easing: Easing.out(Easing.ease),
    });
    borderGlow.value = withTiming(0.7, {
      duration: 300,
      easing: Easing.out(Easing.ease),
    });

    captureTimerRef.current = setTimeout(() => {
      if (hapticIntervalRef.current) {
        clearInterval(hapticIntervalRef.current);
        hapticIntervalRef.current = null;
      }

      captureTimerRef.current = null;
      buttonScale.value = withTiming(1, { duration: 200 });
      handleCapture();
    }, 2000);
  };

  const handlePressOut = () => {
    setIsCapturing(false);

    if (hapticIntervalRef.current) {
      clearInterval(hapticIntervalRef.current);
      hapticIntervalRef.current = null;
    }

    if (captureTimerRef.current) {
      clearTimeout(captureTimerRef.current);
      captureTimerRef.current = null;

      borderOpacity.value = withTiming(0, {
        duration: 200,
        easing: Easing.in(Easing.ease),
      });
      borderPulse.value = withTiming(0, {
        duration: 200,
        easing: Easing.in(Easing.ease),
      });
      borderGlow.value = withTiming(0, {
        duration: 200,
        easing: Easing.in(Easing.ease),
      });
      buttonScale.value = withTiming(1, { duration: 100 });
    } else {
      buttonScale.value = withTiming(1, { duration: 100 });
    }
  };

  const handleCapture = async () => {
    if (!cameraRef.current || !isCameraReady || isProcessingCapture) return;

    setIsProcessingCapture(true);

    if (delayedCaptureRef.current) {
      clearTimeout(delayedCaptureRef.current);
      delayedCaptureRef.current = null;
    }

    if (hapticIntervalRef.current) {
      clearInterval(hapticIntervalRef.current);
      hapticIntervalRef.current = null;
    }

    borderOpacity.value = withTiming(0, {
      duration: 200,
      easing: Easing.in(Easing.ease),
    });
    borderPulse.value = withTiming(0, {
      duration: 200,
      easing: Easing.in(Easing.ease),
    });
    borderGlow.value = withTiming(0, {
      duration: 200,
      easing: Easing.in(Easing.ease),
    });

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        exif: false,
        quality: 0.7,
        shutterSound: false,
      });

      setCapturedPhotoUri(photo.uri);
      setCapturedPhotoBase64(photo.base64);
      setIsCapturing(false);
      setIsAnalyzing(true);
      setAnalysisResult(null);
      bottomSheetRef.current?.snapToIndex(0);

      const abortController = new AbortController();
      analysisAbortControllerRef.current = abortController;

      try {
        const { data, error } = await supabase.functions.invoke(
          "analyze-outfit",
          {
            body: {
              base64Image: photo.base64,
              userProfile: userProfile,
            },
          },
        );

        if (error) {
          throw new Error(error.message || "Analysis failed");
        }

        if (!data) {
          throw new Error("No analysis returned");
        }

        const result = { analysis: data };

        if (analysisAbortControllerRef.current === abortController) {
          analysisAbortControllerRef.current = null;
        }

        // Ignore a stale result if the user reset the camera while it was pending.
        setCapturedPhotoUri((currentUri) => {
          if (!currentUri) {
            setIsAnalyzing(false);
            setIsProcessingCapture(false);
            return currentUri;
          }

          setAnalysisResult({ ...result.analysis });
          setIsProcessingCapture(false);
          setIsAnalyzing(false);

          return currentUri;
        });
      } catch (analysisError) {
        if (analysisAbortControllerRef.current === abortController) {
          analysisAbortControllerRef.current = null;
        }

        if (analysisError.name === "AbortError") {
          setIsAnalyzing(false);
          setIsProcessingCapture(false);
          return;
        }

        // Ignore a stale failure if the user reset the camera while it was pending.
        setCapturedPhotoUri((currentUri) => {
          if (!currentUri) {
            setIsAnalyzing(false);
            setIsProcessingCapture(false);
            return currentUri;
          }

          setIsAnalyzing(false);
          bottomSheetRef.current?.close();

          setIsProcessingCapture(false);

          setTimeout(() => {
            setAnalysisResult(null);
            setCapturedPhotoUri(null);
          }, 500);

          return currentUri;
        });
      }
    } catch {
      setIsCapturing(false);
      setIsProcessingCapture(false);

      Alert.alert("Capture Failed", "Unable to take photo. Please try again.", [
        { text: "OK" },
      ]);

      if (hapticIntervalRef.current) {
        clearInterval(hapticIntervalRef.current);
        hapticIntervalRef.current = null;
      }

      if (delayedCaptureRef.current) {
        clearTimeout(delayedCaptureRef.current);
        delayedCaptureRef.current = null;
      }
    }
  };

  useEffect(() => {
    const requestPermission = async () => {
      if (!cameraPermission?.granted && !permissionRequested) {
        setPermissionRequested(true);
        const result = await requestCameraPermission();
        if (!result.granted) {
          Alert.alert(
            "Camera Access Required",
            "SnazzyAI needs camera access to analyze your outfits. Please enable camera permissions in Settings.",
            [
              { onPress: () => navigation.goBack(), text: "Go Back" },
              { onPress: () => Linking.openSettings(), text: "Open Settings" },
            ],
          );
        }
      }
    };

    requestPermission();
    RNStatusBar.setHidden(true, "none");

    return () => {
      if (captureTimerRef.current) clearTimeout(captureTimerRef.current);
      if (delayedCaptureRef.current) clearTimeout(delayedCaptureRef.current);
      if (hapticIntervalRef.current) clearInterval(hapticIntervalRef.current);
      if (analysisAbortControllerRef.current)
        analysisAbortControllerRef.current.abort();
      if (recommendationsAbortControllerRef.current)
        recommendationsAbortControllerRef.current.abort();
    };
  }, []);

  useEffect(() => {
    cameraPermission?.granted && setIsCameraReady(false);
  }, [cameraPermission?.granted]);

  const buttonAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: buttonScale.value }],
    };
  });

  const buttonContainerStyle = {
    opacity: isCameraReady ? 1 : 0,
    pointerEvents: isCameraReady ? "auto" : "none",
  };

  const borderAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: borderOpacity.value,
    };
  });

  const borderGradientStyle = useAnimatedStyle(() => {
    const intensity = interpolate(
      borderPulse.value,
      [0, 0.3, 1],
      [0.3, 0.4, 0.5],
    );
    return {
      opacity: intensity,
    };
  });

  const buttonText = isAuthenticated
    ? "Generate Recommendations"
    : "Sign in with Apple";

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.container}>
        {capturedPhotoUri ? (
          <>
            <Image
              resizeMode="cover"
              source={{ uri: capturedPhotoUri }}
              style={StyleSheet.absoluteFillObject}
            />
            {!isProcessingCapture && (
              <View style={styles.imageOverlayIcons}>
                <Text style={styles.overlayTitle}>Snazzy AI</Text>
              </View>
            )}
          </>
        ) : (
          <>
            {hasCameraPermission && (
              <CameraView
                enableTorch={torchEnabled}
                faceDetectorSettings={{
                  mode: "none",
                }}
                facing="back"
                onCameraReady={() => {
                  // Allow the camera to finish initializing before enabling capture.
                  setTimeout(() => {
                    setIsCameraReady(true);
                  }, 500);
                }}
                ref={cameraRef}
                style={StyleSheet.absoluteFillObject}
              />
            )}
            <View pointerEvents="none" style={styles.cornerBracketsContainer}>
              <View style={[styles.cornerBracket, styles.cornerTopLeft]} />
              <View style={[styles.cornerBracket, styles.cornerTopRight]} />
              <View style={[styles.cornerBracket, styles.cornerBottomLeft]} />
              <View style={[styles.cornerBracket, styles.cornerBottomRight]} />
            </View>
            {showInstruction && (
              <View style={styles.instructionContainer}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setShowInstruction(false)}
                  style={styles.instructionCloseButton}
                >
                  <Ionicons color="#fff" name="close" size={18} />
                </TouchableOpacity>
                <Text style={styles.instructionText}>
                  Hold the capture button for 2 seconds to take a picture
                </Text>
              </View>
            )}
          </>
        )}

        <Animated.View
          pointerEvents="none"
          style={[styles.borderContainer, borderAnimatedStyle]}
        >
          <Animated.View style={[styles.borderWrapper, borderGradientStyle]}>
            <LinearGradient
              colors={[
                "#FF006E",
                "#8338EC",
                "#3A86FF",
                "#06FFB4",
                "#FFD60A",
                "#FF006E",
              ]}
              end={{ x: 1, y: 1 }}
              start={{ x: 0, y: 0 }}
              style={styles.borderOuter}
            >
              <View style={styles.borderInner} />
            </LinearGradient>
          </Animated.View>
        </Animated.View>

        {!capturedPhotoUri && (
          <View style={styles.captureButtonContainer}>
            <TouchableOpacity activeOpacity={0.7} onPress={handlePickImage}>
              <Ionicons color="#fff" name="images-outline" size={28} />
            </TouchableOpacity>

            <Animated.View
              style={[
                styles.captureButton,
                buttonAnimatedStyle,
                buttonContainerStyle,
              ]}
            >
              <TouchableOpacity
                activeOpacity={1}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                style={styles.captureButtonTouch}
              />
            </Animated.View>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setTorchEnabled((prev) => !prev)}
            >
              <Ionicons
                color={torchEnabled ? "#FFD60A" : "#fff"}
                name="sparkles"
                size={28}
              />
            </TouchableOpacity>
          </View>
        )}

        {(isAnalyzing || analysisResult) && (
          <BottomSheet
            animateOnMount={true}
            backdropComponent={null}
            backgroundStyle={styles.bottomSheetBackground}
            enableDynamicSizing={false}
            enableOverDrag={false}
            enablePanDownToClose={false}
            handleIndicatorStyle={styles.bottomSheetIndicator}
            index={0}
            maxDynamicContentSize={height * 0.85}
            onChange={handleBottomSheetChange}
            ref={bottomSheetRef}
            snapPoints={snapPoints}
          >
            <BottomSheetScrollView
              contentContainerStyle={styles.bottomSheetContent}
              showsVerticalScrollIndicator={false}
            >
              {isAnalyzing ? (
                <View style={styles.loadingContent}>
                  <ActivityIndicator color="#007AFF" size="large" />
                  <Text style={styles.loadingTitle}>Analyzing Outfit...</Text>
                  <Text style={styles.loadingSubtitle}>
                    AI is reviewing your style
                  </Text>
                </View>
              ) : analysisResult?.error ? (
                <View style={styles.errorContent}>
                  <Text style={styles.errorTitle}>Analysis Failed</Text>
                  <Text style={styles.errorMessage}>
                    {analysisResult.error}
                  </Text>
                </View>
              ) : analysisResult ? (
                <View style={styles.resultContent}>
                  <View style={styles.resultHeader}>
                    <Text style={styles.outfitName}>
                      {analysisResult.outfitName}
                    </Text>
                    <Text style={styles.rating}>
                      ⭐ {analysisResult.rating}/10
                    </Text>
                    <Text
                      ellipsizeMode="tail"
                      numberOfLines={isDescriptionExpanded ? undefined : 2}
                      style={styles.shortDescription}
                    >
                      {analysisResult.shortDescription}
                    </Text>
                    <TouchableOpacity
                      onPress={() =>
                        setIsDescriptionExpanded(!isDescriptionExpanded)
                      }
                    >
                      <Text style={styles.seeMoreText}>
                        {isDescriptionExpanded ? "see less" : "see more"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.recommendationsContainer}>
                    <Text style={styles.recommendationsTitle}>
                      Recommended Items
                    </Text>

                    {hasGeneratedRecommendations &&
                    analysisResult.recommendations &&
                    analysisResult.recommendations.length > 0
                      ? analysisResult.recommendations.map((item, index) => (
                          <TouchableOpacity
                            activeOpacity={0.8}
                            key={`rec-${index}`}
                            onPress={() =>
                              handleOpenPurchaseUrl(item.purchaseUrl)
                            }
                            style={[
                              styles.recommendationCard,
                              { marginBottom: 18 },
                            ]}
                          >
                            <View style={styles.recommendationImageContainer}>
                              <Image
                                resizeMode="cover"
                                source={{
                                  uri:
                                    item.imageUrl ||
                                    "https://via.placeholder.com/150",
                                }}
                                style={styles.recommendationImage}
                              />
                              <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={handleToggleFavorite}
                                style={styles.heartButton}
                              >
                                <Ionicons
                                  color="#999"
                                  name="heart-outline"
                                  size={24}
                                />
                              </TouchableOpacity>
                            </View>
                            <View style={styles.recommendationContent}>
                              <Text
                                numberOfLines={1}
                                style={styles.recommendationName}
                              >
                                {item.name}
                              </Text>
                              <Text
                                numberOfLines={1}
                                style={styles.recommendationBrand}
                              >
                                {item.brand}
                              </Text>
                              <Text
                                numberOfLines={2}
                                style={styles.recommendationDescription}
                              >
                                {item.description}
                              </Text>
                              <Text style={styles.recommendationPrice}>
                                {item.price}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ))
                      : !hasGeneratedRecommendations && (
                          <View
                            style={[
                              styles.placeholderContainer,
                              { paddingBottom: 15 },
                            ]}
                          >
                            <Ionicons
                              color="#ccc"
                              name="shirt-outline"
                              size={48}
                            />
                            <Text style={styles.placeholderText}>
                              Sign up to generate items!
                            </Text>
                          </View>
                        )}
                  </View>

                  {analysisResult.isValidPhoto === false && (
                    <View style={{ paddingBottom: insets.bottom + 12 }}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={handleRefresh}
                        style={styles.generateButton}
                      >
                        <Ionicons
                          color="#fff"
                          name="refresh"
                          size={20}
                          style={styles.buttonIcon}
                        />
                        <Text style={styles.generateButtonText}>
                          Retake Photo
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {!hasGeneratedRecommendations &&
                    analysisResult.isValidPhoto && (
                      <View style={{ paddingBottom: insets.bottom + 12 }}>
                        {Platform.OS === "ios" &&
                        !isAuthenticated &&
                        !isGeneratingRecommendations &&
                        !isSigningIn ? (
                          <AppleAuthentication.AppleAuthenticationButton
                            buttonStyle={
                              AppleAuthentication.AppleAuthenticationButtonStyle
                                .BLACK
                            }
                            buttonType={
                              AppleAuthentication.AppleAuthenticationButtonType
                                .SIGN_UP
                            }
                            cornerRadius={12}
                            onPress={handleGenerateRecommendations}
                            style={styles.appleGenerateButton}
                          />
                        ) : (
                          <TouchableOpacity
                            activeOpacity={0.7}
                            disabled={
                              isGeneratingRecommendations || isSigningIn
                            }
                            onPress={handleGenerateRecommendations}
                            style={[
                              styles.generateButton,
                              (isGeneratingRecommendations || isSigningIn) &&
                                styles.generateButtonDisabled,
                            ]}
                          >
                            {isGeneratingRecommendations || isSigningIn ? (
                              <>
                                <ActivityIndicator
                                  color="#fff"
                                  size="small"
                                  style={styles.buttonLoader}
                                />
                                <Text
                                  numberOfLines={1}
                                  style={styles.generateButtonText}
                                >
                                  Fetching Recommendations
                                </Text>
                              </>
                            ) : Platform.OS === "android" ? (
                              <>
                                <Image
                                  source={require("../../assets/logo-google.png")}
                                  style={styles.googleIconImage}
                                />
                                <Text
                                  numberOfLines={1}
                                  style={styles.generateButtonText}
                                >
                                  Generate Recommendations
                                </Text>
                              </>
                            ) : (
                              <Text
                                numberOfLines={1}
                                style={styles.generateButtonText}
                              >
                                {buttonText}
                              </Text>
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                  {hasGeneratedRecommendations && (
                    <View style={{ paddingBottom: insets.bottom + 12 }}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={showPaywall}
                        style={styles.generateButton}
                      >
                        <Ionicons
                          color="#fff"
                          name="sparkles"
                          size={20}
                          style={styles.buttonIcon}
                        />
                        <Text style={styles.generateButtonText}>
                          Regenerate
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ) : null}
            </BottomSheetScrollView>
          </BottomSheet>
        )}

        <StatusBar hidden />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  appleGenerateButton: {
    height: 48,
    width: "100%",
  },
  borderContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  borderInner: {
    backgroundColor: "transparent",
    borderRadius: 0,
    flex: 1,
  },
  borderOuter: {
    borderRadius: 0,
    flex: 1,
    padding: 0,
  },
  borderWrapper: {
    bottom: 0,
    elevation: 15,
    left: 0,
    position: "absolute",
    right: 0,
    shadowColor: "#FF006E",
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 25,
    top: 0,
  },
  bottomSheetBackground: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { height: -4, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  bottomSheetContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  bottomSheetIndicator: {
    backgroundColor: "#ddd",
    height: 4,
    width: 40,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonLoader: {
    marginRight: 8,
  },
  captureButton: {
    backgroundColor: "#fff",
    borderRadius: BUTTON_SIZE / 2,
    elevation: 8,
    height: BUTTON_SIZE,
    shadowColor: "#000",
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    width: BUTTON_SIZE,
  },
  captureButtonContainer: {
    alignItems: "center",
    bottom: 70,
    flexDirection: "row",
    justifyContent: "space-between",
    left: 0,
    paddingHorizontal: 40,
    position: "absolute",
    right: 0,
  },
  captureButtonTouch: {
    borderRadius: BUTTON_SIZE / 2,
    height: "100%",
    width: "100%",
  },
  container: {
    backgroundColor: "#3a3b3c",
    flex: 1,
  },
  cornerBottomLeft: {
    borderBottomLeftRadius: 20,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    bottom: 0,
    left: 0,
  },
  cornerBottomRight: {
    borderBottomRightRadius: 20,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    bottom: 0,
    right: 0,
  },
  cornerBracket: {
    borderColor: "#fff",
    height: 40,
    position: "absolute",
    width: 40,
  },
  cornerBracketsContainer: {
    bottom: "30%",
    left: "10%",
    position: "absolute",
    right: "10%",
    top: "25%",
  },
  cornerTopLeft: {
    borderLeftWidth: 3,
    borderTopLeftRadius: 20,
    borderTopWidth: 3,
    left: 0,
    top: 0,
  },
  cornerTopRight: {
    borderRightWidth: 3,
    borderTopRightRadius: 20,
    borderTopWidth: 3,
    right: 0,
    top: 0,
  },
  errorContent: {
    alignItems: "center",
    paddingVertical: 20,
  },
  errorMessage: {
    color: "#3a3b3c",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  errorTitle: {
    color: "#FF3B30",
    fontSize: 18,
    fontWeight: "500",
    marginBottom: 8,
  },
  generateButton: {
    alignItems: "center",
    backgroundColor: "#007AFF",
    borderRadius: 12,
    elevation: 3,
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 14,
    shadowColor: "#000",
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  generateButtonDisabled: {
    backgroundColor: "#999",
    opacity: 0.5,
  },
  generateButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  googleIconImage: {
    height: 20,
    marginRight: 8,
    width: 20,
  },
  heartButton: {
    alignItems: "center",
    height: 24,
    justifyContent: "center",
    marginBottom: "auto",
    marginTop: "auto",
    width: 24,
  },
  imageOverlayIcons: {
    flexDirection: "row",
    justifyContent: "center",
    left: 0,
    paddingHorizontal: 20,
    position: "absolute",
    right: 0,
    top: 50,
    zIndex: 100,
  },
  instructionCloseButton: {
    marginRight: 12,
  },
  instructionContainer: {
    alignItems: "center",
    backgroundColor: "rgba(58, 59, 60, 0.5)",
    borderRadius: 12,
    flexDirection: "row",
    left: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: "absolute",
    right: 20,
    top: 60,
  },
  instructionText: {
    color: "#fff",
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
  loadingContent: {
    alignItems: "center",
    paddingVertical: 20,
  },
  loadingSubtitle: {
    color: "#3a3b3c",
    fontSize: 14,
    textAlign: "center",
  },
  loadingTitle: {
    color: "#3a3b3c",
    fontSize: 18,
    fontWeight: "500",
    marginBottom: 4,
    marginTop: 16,
  },
  outfitName: {
    color: "#3a3b3c",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  overlayTitle: {
    alignSelf: "center",
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { height: 2, width: 0 },
    textShadowRadius: 4,
  },
  placeholderContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  placeholderText: {
    color: "#999",
    fontSize: 16,
    fontWeight: "500",
    marginTop: 12,
  },
  rating: {
    color: "#007AFF",
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 12,
  },
  recommendationBrand: {
    color: "#007AFF",
    fontSize: 14,
    marginBottom: 4,
  },
  recommendationCard: {
    alignItems: "flex-start",
    backgroundColor: "#fff",
    borderRadius: 12,
    elevation: 3,
    flexDirection: "row",
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  recommendationContent: {
    flex: 1,
    justifyContent: "space-between",
  },
  recommendationDescription: {
    color: "#3a3b3c",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  recommendationImage: {
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    height: 80,
    width: 80,
  },
  recommendationImageContainer: {
    alignItems: "center",
    alignSelf: "stretch",
    justifyContent: "flex-start",
    marginRight: 12,
    width: 80,
  },
  recommendationName: {
    color: "#3a3b3c",
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 2,
  },
  recommendationPrice: {
    color: "#3a3b3c",
    fontSize: 15,
    fontWeight: "bold",
  },
  recommendationsContainer: {
    flex: 1,
    marginTop: 10,
  },
  recommendationsTitle: {
    color: "#3a3b3c",
    fontSize: 18,
    fontWeight: "500",
    marginBottom: 15,
  },
  resultContent: {
    flex: 1,
  },
  resultHeader: {
    paddingHorizontal: 0,
    paddingVertical: 20,
  },
  seeMoreText: {
    color: "#007AFF",
    fontSize: 14,
    marginTop: 4,
  },
  shortDescription: {
    color: "#3a3b3c",
    fontSize: 16,
    lineHeight: 22,
  },
});
