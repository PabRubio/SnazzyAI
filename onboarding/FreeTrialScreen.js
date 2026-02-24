import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Text from '../components/Text';
import { CameraView } from 'expo-camera';
import { StatusBar } from 'expo-status-bar';
import { StatusBar as RNStatusBar } from 'react-native';
import { StyleSheet, View, TouchableOpacity, Dimensions, Alert, ActivityIndicator, FlatList, Image, Linking } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence, interpolate, Easing, runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import BottomSheet from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetView, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useNavigation } from '../navigation/NavigationContext';
import { uploadPhoto, saveOutfitAnalysis, saveRecommendations } from '../services/supabaseHelpers';
import { useCameraPermissions } from 'expo-camera';
import { useOnboarding } from './OnboardingContext';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { usePlacement, useSuperwall } from 'expo-superwall';

const { width, height } = Dimensions.get('window');
const BUTTON_SIZE = 60;
const BUTTON_BORDER_SIZE = 4;

// Configure Google Sign-In
GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  scopes: ['profile', 'email'],
});

// Utility function for safe haptic feedback
const safeHaptic = async (hapticFunction) => {
  try {
    await hapticFunction();
  } catch (error) {
    // Silently handle haptic not supported on device
    console.log('Haptics not available on this device');
  }
};

export default function FreeTrialScreen({ navigation }) {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [permissionRequested, setPermissionRequested] = useState(false);
  const { data: onboardingData } = useOnboarding();
  const { switchToAppStack } = useNavigation();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessingCapture, setIsProcessingCapture] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [capturedPhotoUri, setCapturedPhotoUri] = useState(null);
  const [capturedPhotoBase64, setCapturedPhotoBase64] = useState(null);
  const [isGeneratingRecommendations, setIsGeneratingRecommendations] = useState(false);
  const [hasGeneratedRecommendations, setHasGeneratedRecommendations] = useState(false);
  const [recommendationClickCount, setRecommendationClickCount] = useState(0);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [showInstruction, setShowInstruction] = useState(true);
  const cameraRef = useRef(null);
  const insets = useSafeAreaInsets();
  const captureTimerRef = useRef(null);
  const hapticIntervalRef = useRef(null);
  const delayedCaptureRef = useRef(null);
  const analysisAbortControllerRef = useRef(null);
  const recommendationsAbortControllerRef = useRef(null);

  const { dismiss } = useSuperwall();
  const { registerPlacement } = usePlacement({
    onDismiss: () => {
      console.log('Paywall dismissed');
    },
    onError: (error) => {
      console.error('Paywall error:', error);
    }
  });

  // Show paywall for premium features
  const showPaywall = async () => {
    try {
      await dismiss();
      await registerPlacement({
        placement: 'campaign_trigger'
      });
    } catch (error) {
      console.error('Failed to show paywall:', error);
    }
  };

  // BottomSheet setup
  const bottomSheetRef = useRef(null);
  const snapPoints = useMemo(() => ['25%', '85%'], []);

  // Handle opening purchase URLs in browser
  const handleOpenPurchaseUrl = useCallback(async (url) => {
    if (recommendationClickCount >= 1) {
      showPaywall();
      return;
    }

    setRecommendationClickCount(prev => prev + 1);

    if (!url) {
      Alert.alert(
        'Link Unavailable',
        'No purchase link available for this item.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      const isValidUrl = url.startsWith('http://') || url.startsWith('https://');

      if (!isValidUrl) {
        Alert.alert(
          'Invalid Link',
          'The purchase link appears to be invalid.',
          [{ text: 'OK' }]
        );
        return;
      }

      await Linking.openURL(url);
    } catch (error) {
      console.error('Error opening URL:', error);
      Alert.alert(
        'Error',
        'Unable to open the link. Please try again later.',
        [{ text: 'OK' }]
      );
    }
  }, [recommendationClickCount]);

  // Handle favourite button - triggers paywall
  const handleToggleFavorite = useCallback(() => {
    showPaywall();
  }, []);

  // Save onboarding profile to Supabase after sign-in
  const saveOnboardingProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      let birthDate = null;
      if (onboardingData.birth) {
        const date = new Date(onboardingData.birth);
        birthDate = date.toISOString().split('T')[0];
      }

      const profileData = {
        birth: birthDate,
        gender: onboardingData.gender || null,
        location: onboardingData.location || null,
        height: onboardingData.height ? parseInt(onboardingData.height) : null,
        weight: onboardingData.weight ? parseInt(onboardingData.weight) : null,
        currency: onboardingData.currency || null,
        price_min: onboardingData.priceMin ? parseInt(onboardingData.priceMin) : null,
        price_max: onboardingData.priceMax ? parseInt(onboardingData.priceMax) : null,
        shirt_size: onboardingData.shirtSize || null,
        pants_size: onboardingData.pantsSize || null,
        shoe_size: onboardingData.shoeSize || null,
        favorite_brands: onboardingData.favoriteBrands || [],
        favorite_styles: onboardingData.favoriteStyles || [],
        response_1: onboardingData.questionnaire1 || null,
        response_2: onboardingData.questionnaire2 || null,
        response_3: onboardingData.questionnaire3 || null,
      };

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          ...profileData
        });

      if (error) throw error;
      console.log('Onboarding profile saved successfully');

      // Upload photo and save analysis
      if (capturedPhotoBase64 && analysisResult) {
        try {
          const { url: photoUrl } = await uploadPhoto(capturedPhotoBase64, 'outfit-photos');
          const analysisId = await saveOutfitAnalysis(analysisResult, photoUrl);
          setAnalysisResult(prev => ({ ...prev, analysisId }));
        } catch (err) {
          console.error('Failed to save photo/analysis:', err);
        }
      }
    } catch (error) {
      console.error('Error saving onboarding profile:', error);
    }
  };

  // Generate recommendations after authentication
  const generateRecommendationsAfterAuth = async () => {
    if (!analysisResult || !analysisResult.isValidPhoto) return;

    setIsGeneratingRecommendations(true);

    const abortController = new AbortController();
    recommendationsAbortControllerRef.current = abortController;

    try {
      console.log('Generating recommendations after auth...');

      const userProfile = {
        gender: onboardingData.gender,
        favorite_styles: onboardingData.favoriteStyles || [],
        favorite_brands: onboardingData.favoriteBrands || [],
      };

      const { data, error } = await supabase.functions.invoke('search-products-2', {
        body: {
          base64Image: capturedPhotoBase64,
          userProfile: userProfile
        }
      });

      if (error) throw new Error(error.message || 'Failed to generate recommendations');
      if (!data || !data.products) throw new Error('No recommendations returned');

      const recommendations = data.products;

      if (recommendationsAbortControllerRef.current === abortController) {
        recommendationsAbortControllerRef.current = null;
      }

      setAnalysisResult(prevResult => {
        const updatedResult = {
          ...prevResult,
          recommendations: recommendations
        };

        if (prevResult.analysisId) {
          saveRecommendations(prevResult.analysisId, recommendations).catch(err => {
            console.error('Failed to save recommendations:', err);
          });
        }

        return updatedResult;
      });

      setHasGeneratedRecommendations(true);
      setIsGeneratingRecommendations(false);

    } catch (error) {
      console.error('Failed to generate recommendations:', error);

      if (recommendationsAbortControllerRef.current === abortController) {
        recommendationsAbortControllerRef.current = null;
      }

      if (error.name === 'AbortError') {
        setIsGeneratingRecommendations(false);
        return;
      }

      setIsGeneratingRecommendations(false);
    }
  };

  // Handle Google Sign-In
  const handleGoogleSignIn = async () => {
    try {
      setIsSigningIn(true);

      await GoogleSignin.hasPlayServices();
      await GoogleSignin.signOut();
      const userInfo = await GoogleSignin.signIn();

      const idToken = userInfo.idToken || userInfo.data?.idToken;
      if (!idToken) {
        throw new Error('No ID token returned from Google Sign-In');
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (error) throw error;

      console.log('Successfully signed in:', data.user.email);

      // Check if this is an existing user (has profile data already)
      const { data: profile } = await supabase
        .from('profiles')
        .select('shoe_size')
        .eq('id', data.user.id)
        .single();

      const isExistingUser = profile && profile.shoe_size;

      if (isExistingUser) {
        // Existing user - redirect to Home without saving onboarding data
        console.log('Existing user detected, redirecting to Home');
        switchToAppStack();
      } else {
        // New user - save profile first, then generate recommendations
        console.log('New user detected, saving profile and generating recommendations');
        setIsAuthenticated(true);
        await saveOnboardingProfile();
        await generateRecommendationsAfterAuth();
        // Stay on FreeTrialScreen - new users must go through paywall
      }

    } catch (error) {
      console.error('Sign-in error:', error);

      let errorMsg = 'Failed to sign in with Google';
      if (error.code === 'SIGN_IN_CANCELLED') {
        errorMsg = 'Sign-in cancelled';
      } else if (error.code === 'IN_PROGRESS') {
        errorMsg = 'Sign-in already in progress';
      } else if (error.code === 'PLAY_SERVICES_NOT_AVAILABLE') {
        errorMsg = 'Google Play Services not available';
      } else if (error.message) {
        errorMsg = error.message;
      }

      Alert.alert('Sign-In Failed', errorMsg, [{ text: 'OK' }]);
    } finally {
      setIsSigningIn(false);
    }
  };

  // Handle Generate Recommendations button - requires sign-in first
  const handleGenerateRecommendations = useCallback(async () => {
    if (!analysisResult || !analysisResult.isValidPhoto || isGeneratingRecommendations || hasGeneratedRecommendations) {
      return;
    }

    if (!isAuthenticated) {
      handleGoogleSignIn();
      return;
    }

    await generateRecommendationsAfterAuth();
  }, [analysisResult, isGeneratingRecommendations, hasGeneratedRecommendations, isAuthenticated]);

  // Animation values
  const buttonScale = useSharedValue(1);
  const buttonOpacity = useSharedValue(0);

  // Border glow animation values
  const borderOpacity = useSharedValue(0);
  const borderGlowProgress = useSharedValue(0);
  const borderPulse = useSharedValue(0);
  const borderGlow = useSharedValue(0);

  // Handle capture button press start
  const handlePressIn = async () => {
    // Don't start a new capture if one is being processed
    if (isProcessingCapture) return;
    
    // Clear any pending delayed capture
    if (delayedCaptureRef.current) {
      clearTimeout(delayedCaptureRef.current);
      delayedCaptureRef.current = null;
    }
    
    setIsCapturing(true);
    
    // Start continuous very light haptic feedback
    hapticIntervalRef.current = setInterval(async () => {
      await safeHaptic(() => Haptics.selectionAsync());
    }, 50);
    
    // Start animations
    buttonScale.value = withTiming(0.85, { duration: 100 });
    
    // Start border glow animations
    borderOpacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) });
    // Set static border opacity without pulsing
    borderPulse.value = withTiming(0.5, { duration: 300, easing: Easing.out(Easing.ease) });
    borderGlow.value = withTiming(0.7, { duration: 300, easing: Easing.out(Easing.ease) });
    
    // Set capture timer (2 seconds)
    captureTimerRef.current = setTimeout(() => {
      // Button held for 2 seconds - stop haptic feedback
      if (hapticIntervalRef.current) {
        clearInterval(hapticIntervalRef.current);
        hapticIntervalRef.current = null;
      }
      
      // Clear timer reference
      captureTimerRef.current = null;
      
      // Reset button scale immediately when haptic ends
      buttonScale.value = withTiming(1, { duration: 200 });
      
      // Take photo immediately when haptic ends
      handleCapture();
    }, 2000);
  };

  // Handle capture button press end
  const handlePressOut = () => {
    setIsCapturing(false);
    
    // Clear haptic interval
    if (hapticIntervalRef.current) {
      clearInterval(hapticIntervalRef.current);
      hapticIntervalRef.current = null;
    }
    
    // Check if button was held for full 2 seconds
    if (captureTimerRef.current) {
      // Button released early - cancel capture and fade out border
      clearTimeout(captureTimerRef.current);
      captureTimerRef.current = null;
      
      // Fade out border animations since capture was cancelled
      borderOpacity.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.ease) });
      borderPulse.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.ease) });
      borderGlow.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.ease) });
      
      // Reset button scale
      buttonScale.value = withTiming(1, { duration: 100 });
    } else {
      // Photo was already taken, border animation already faded in timer
      // Just reset button scale
      buttonScale.value = withTiming(1, { duration: 100 });
    }
  };

  // Handle photo capture
  const handleCapture = async () => {
    if (!cameraRef.current || !isCameraReady || isProcessingCapture) return;
    
    // Set processing flag
    setIsProcessingCapture(true);
    
    // Clear delayed capture ref
    if (delayedCaptureRef.current) {
      clearTimeout(delayedCaptureRef.current);
      delayedCaptureRef.current = null;
    }
    
    // Clear haptic interval immediately
    if (hapticIntervalRef.current) {
      clearInterval(hapticIntervalRef.current);
      hapticIntervalRef.current = null;
    }
    
    // Fade out border animation right when photo is taken
    borderOpacity.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.ease) });
    borderPulse.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.ease) });
    borderGlow.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.ease) });
    
    try {
      // Photo capture with shutter sound disabled
      
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: true,
        exif: false,
        shutterSound: false,
      });
      
      console.log('Photo captured:', photo.uri);

      // Store the captured photo URI and base64
      setCapturedPhotoUri(photo.uri);
      setCapturedPhotoBase64(photo.base64);
      
      // Reset capture state
      setIsCapturing(false);
      
      // Start analysis and show BottomSheet immediately with the photo
      setIsAnalyzing(true);
      setAnalysisResult(null);
      bottomSheetRef.current?.snapToIndex(0); // Snap to collapsed state (25%)

      // Create abort controller for this analysis
      const abortController = new AbortController();
      analysisAbortControllerRef.current = abortController;

      try {
        console.log('Starting outfit analysis...');

        // Build user profile from onboarding data for personalization
        const userProfile = {
          gender: onboardingData.gender,
          favorite_styles: onboardingData.favoriteStyles || [],
          favorite_brands: onboardingData.favoriteBrands || [],
        };

        // Call Supabase edge function for outfit analysis
        const { data, error } = await supabase.functions.invoke('analyze-outfit', {
          body: {
            base64Image: photo.base64,
            userProfile: userProfile
          }
        });

        if (error) {
          throw new Error(error.message || 'Analysis failed');
        }

        if (!data) {
          throw new Error('No analysis returned');
        }

        const result = { analysis: data };
        console.log('Analysis complete:', result);

        // Clear abort controller on success
        if (analysisAbortControllerRef.current === abortController) {
          analysisAbortControllerRef.current = null;
        }

        // Check if photo was cleared (user pressed refresh) - if so, don't show results
        setCapturedPhotoUri(currentUri => {
          if (!currentUri) {
            // Photo was cleared, cancel showing results
            setIsAnalyzing(false);
            setIsProcessingCapture(false);
            return currentUri;
          }

          // Photo still exists, proceed with showing results
          // Check if the photo is valid
          if (result.isValidPhoto === false) {
            // Invalid photo detected
            setIsAnalyzing(false);
            setIsProcessingCapture(false);
            bottomSheetRef.current?.close();
            // Reset camera state and clear captured photo
            setTimeout(() => {
              setAnalysisResult(null);
              setCapturedPhotoUri(null);
            }, 500);
          } else {
            // Show results immediately (don't save to DB yet - user not authenticated)
            setAnalysisResult({ ...result.analysis });
            setIsAnalyzing(false);
            setIsProcessingCapture(false);
          }

          return currentUri;
        });
        
      } catch (analysisError) {
        console.error('Analysis failed:', analysisError);

        // Clear abort controller on error
        if (analysisAbortControllerRef.current === abortController) {
          analysisAbortControllerRef.current = null;
        }

        // If request was aborted, just clean up silently
        if (analysisError.name === 'AbortError') {
          setIsAnalyzing(false);
          setIsProcessingCapture(false);
          return;
        }

        // Check if photo was cleared (user pressed refresh) - if so, don't show error
        setCapturedPhotoUri(currentUri => {
          if (!currentUri) {
            // Photo was cleared, just reset flags
            setIsAnalyzing(false);
            setIsProcessingCapture(false);
            return currentUri;
          }

          // Photo still exists, show error
          setIsAnalyzing(false);
          bottomSheetRef.current?.close();

          // Determine error message based on error type
          let errorMsg = 'Connection error. Please check your network.';
          if (analysisError.message) {
            if (analysisError.message.includes('Network') ||
                analysisError.message.includes('connection') ||
                analysisError.message.includes('timeout')) {
              errorMsg = 'Connection error. Please check your network.';
            } else if (analysisError.message.includes('API key')) {
              errorMsg = 'Configuration error. Please check API settings.';
            } else if (analysisError.message.includes('Rate limit')) {
              errorMsg = 'Too many requests. Please wait a moment.';
            } else {
              errorMsg = 'Failed to analyze outfit. Please try again.';
            }
          }

          setIsProcessingCapture(false);

          // Reset camera state and clear captured photo
          setTimeout(() => {
            setAnalysisResult(null);
            setCapturedPhotoUri(null);
          }, 500);

          return currentUri;
        });
      }
      
    } catch (error) {
      console.error('Error taking picture:', error);
      setIsCapturing(false);
      setIsProcessingCapture(false);
      
      Alert.alert(
        'Capture Failed',
        'Unable to take photo. Please try again.',
        [{ text: 'OK' }]
      );
      
      // Clear haptic interval on error as well
      if (hapticIntervalRef.current) {
        clearInterval(hapticIntervalRef.current);
        hapticIntervalRef.current = null;
      }
      
      // Clear delayed capture on error
      if (delayedCaptureRef.current) {
        clearTimeout(delayedCaptureRef.current);
        delayedCaptureRef.current = null;
      }
    }
  };

  // Request camera permission on mount
  useEffect(() => {
    const requestPermission = async () => {
      if (!cameraPermission?.granted && !permissionRequested) {
        setPermissionRequested(true);
        const result = await requestCameraPermission();
        if (!result.granted) {
          Alert.alert(
            'Camera Access Required',
            'SnazzyAI needs camera access to analyze your outfits. Please enable camera permissions in Settings.',
            [
              { text: 'Go Back', onPress: () => navigation.goBack() },
              { text: 'Open Settings', onPress: () => Linking.openSettings() }
            ]
          );
        }
      }
    };

    requestPermission();
    RNStatusBar.setHidden(true, 'none');

    return () => {
      if (captureTimerRef.current) clearTimeout(captureTimerRef.current);
      if (delayedCaptureRef.current) clearTimeout(delayedCaptureRef.current);
      if (hapticIntervalRef.current) clearInterval(hapticIntervalRef.current);
      if (analysisAbortControllerRef.current) analysisAbortControllerRef.current.abort();
      if (recommendationsAbortControllerRef.current) recommendationsAbortControllerRef.current.abort();
    };
  }, []);


  // Handle button fade in/out based on camera state
  useEffect(() => {
    if (isCameraReady && !capturedPhotoUri) {
      // Fade in when camera is ready and no photo captured
      buttonOpacity.value = withTiming(1, { duration: 100 });
    } else {
      // Fade out when photo is captured
      buttonOpacity.value = withTiming(0, { duration: 100 });
    }
  }, [isCameraReady, capturedPhotoUri, buttonOpacity]);

  // Handle back navigation - fade out button before navigating
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // Only fade button if it's visible (camera view, no photo captured)
      if (!capturedPhotoUri && isCameraReady) {
        buttonOpacity.value = withTiming(0, { duration: 100 });
      }
    });

    return unsubscribe;
  }, [navigation, capturedPhotoUri, isCameraReady, buttonOpacity]);

  // Animated styles
  const buttonAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: buttonScale.value }],
    };
  });

  const buttonContainerStyle = useAnimatedStyle(() => {
    return {
      opacity: buttonOpacity.value,
    };
  });

  // Border glow animated styles
  const borderAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: borderOpacity.value,
    };
  });

  const borderGradientStyle = useAnimatedStyle(() => {
    const intensity = interpolate(
      borderPulse.value,
      [0, 0.3, 1],
      [0.3, 0.4, 0.5]
    );
    return {
      opacity: intensity,
    };
  });

  const placeholderPaddingBottom = analysisResult?.isValidPhoto ? 15 : insets.bottom + 12;

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.container}>
        {capturedPhotoUri ? (
          // Show captured photo as background when photo is taken
          <>
            <Image
              source={{ uri: capturedPhotoUri }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
            {/* Snazzy AI title - hide during processing */}
            {!isProcessingCapture && (
              <View style={styles.imageOverlayIcons}>
                <Text style={styles.overlayTitle}>Snazzy AI</Text>
              </View>
            )}
          </>
        ) : (
          // Show camera view when no photo is captured
          <>
            <CameraView
              facing="back"
              ref={cameraRef}
              style={StyleSheet.absoluteFillObject}
              faceDetectorSettings={{
                mode: 'none',
              }}
              onCameraReady={() => {
                // Add a small delay to ensure camera is fully initialized
                setTimeout(() => {
                  setIsCameraReady(true);
                }, 500);
              }}
            />
            {/* Corner Brackets */}
            <View style={styles.cornerBracketsContainer} pointerEvents="none">
              <View style={[styles.cornerBracket, styles.cornerTopLeft]} />
              <View style={[styles.cornerBracket, styles.cornerTopRight]} />
              <View style={[styles.cornerBracket, styles.cornerBottomLeft]} />
              <View style={[styles.cornerBracket, styles.cornerBottomRight]} />
            </View>
            {isCameraReady && showInstruction && (
              <View style={styles.instructionContainer}>
                <TouchableOpacity
                  style={styles.instructionCloseButton}
                  onPress={() => setShowInstruction(false)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={18} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.instructionText}>Hold the capture button for 2 seconds to take a picture</Text>
              </View>
            )}
          </>
        )}
        
        {/* Glowing Border Effect */}
        <Animated.View style={[styles.borderContainer, borderAnimatedStyle]} pointerEvents="none">
          <Animated.View style={[styles.borderWrapper, borderGradientStyle]}>
            <LinearGradient
              colors={['#FF006E', '#8338EC', '#3A86FF', '#06FFB4', '#FFD60A', '#FF006E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.borderOuter}
            >
              <View style={styles.borderInner} />
            </LinearGradient>
          </Animated.View>
        </Animated.View>

        {/* Capture Button - only show when camera is ready and no photo is captured */}
        {isCameraReady && !capturedPhotoUri && (
          <Animated.View style={[styles.captureButtonContainer, buttonContainerStyle]}>
            {/* Main Button */}
            <Animated.View style={[styles.captureButton, buttonAnimatedStyle]}>
              <TouchableOpacity
                style={styles.captureButtonTouch}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                activeOpacity={1}
              />
            </Animated.View>
          </Animated.View>
        )}
        
        {/* Bottom Sheet for Analysis Results */}
        {(isAnalyzing || analysisResult) && (
          <BottomSheet
              index={0}
              ref={bottomSheetRef}
              animateOnMount={true}
              enableOverDrag={false}
              snapPoints={snapPoints}
              backdropComponent={null}
              enableDynamicSizing={false}
              enablePanDownToClose={false}
              maxDynamicContentSize={height * 0.85}
              backgroundStyle={styles.bottomSheetBackground}
              handleIndicatorStyle={styles.bottomSheetIndicator}
            >
          <BottomSheetScrollView
            contentContainerStyle={styles.bottomSheetContent}
            showsVerticalScrollIndicator={false}
          >
            {isAnalyzing ? (
              <View style={styles.loadingContent}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingTitle}>Analyzing Outfit...</Text>
                <Text style={styles.loadingSubtitle}>AI is reviewing your style</Text>
              </View>
            ) : analysisResult?.error ? (
              <View style={styles.errorContent}>
                <Text style={styles.errorTitle}>Analysis Failed</Text>
                <Text style={styles.errorMessage}>{analysisResult.error}</Text>
              </View>
            ) : analysisResult ? (
              <View style={styles.resultContent}>
                <View style={styles.resultHeader}>
                  <Text style={styles.outfitName}>{analysisResult.outfitName}</Text>
                  <Text style={styles.rating}>⭐ {analysisResult.rating}/10</Text>
                  <Text
                    style={styles.shortDescription}
                    numberOfLines={isDescriptionExpanded ? undefined : 2}
                    ellipsizeMode="tail"
                  >
                    {analysisResult.shortDescription}
                  </Text>
                  <TouchableOpacity onPress={() => setIsDescriptionExpanded(!isDescriptionExpanded)}>
                    <Text style={styles.seeMoreText}>
                      {isDescriptionExpanded ? 'see less' : 'see more'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Recommendations Section - Always visible */}
                <View style={styles.recommendationsContainer}>
                  <Text style={styles.recommendationsTitle}>Recommended Items</Text>

                  {/* Show items if recommendations have been generated */}
                  {hasGeneratedRecommendations && analysisResult.recommendations && analysisResult.recommendations.length > 0 ? (
                    analysisResult.recommendations.map((item, index) => (
                      <TouchableOpacity
                        key={`rec-${index}`}
                        style={[styles.recommendationCard, { marginBottom: 18 }]}
                        onPress={() => handleOpenPurchaseUrl(item.purchaseUrl)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.recommendationImageContainer}>
                          <Image
                            source={{ uri: item.imageUrl || 'https://via.placeholder.com/150' }}
                            style={styles.recommendationImage}
                            resizeMode="cover"
                          />
                          <TouchableOpacity
                            style={styles.heartButton}
                            onPress={handleToggleFavorite}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="heart-outline" size={24} color="#999" />
                          </TouchableOpacity>
                        </View>
                        <View style={styles.recommendationContent}>
                          <Text style={styles.recommendationName} numberOfLines={1}>{item.name}</Text>
                          <Text style={styles.recommendationBrand} numberOfLines={1}>{item.brand}</Text>
                          <Text style={styles.recommendationDescription} numberOfLines={2}>
                            {item.description}
                          </Text>
                          <Text style={styles.recommendationPrice}>{item.price}</Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  ) : (
                    /* Show placeholder when no recommendations generated yet */
                    !hasGeneratedRecommendations && (
                      <View style={[styles.placeholderContainer, { paddingBottom: placeholderPaddingBottom }]}>
                        <Ionicons name="shirt-outline" size={48} color="#ccc" />
                        <Text style={styles.placeholderText}>Nothing to see here ;)</Text>
                      </View>
                    )
                  )}
                </View>

                {/* Generate Recommendations Button - At the very bottom */}
                {!hasGeneratedRecommendations && analysisResult.isValidPhoto && (
                  <View style={{ paddingBottom: insets.bottom + 12 }}>
                    <TouchableOpacity
                      style={[
                        styles.generateButton,
                        (isGeneratingRecommendations || isSigningIn) && styles.generateButtonDisabled
                      ]}
                      onPress={handleGenerateRecommendations}
                      disabled={isGeneratingRecommendations || isSigningIn}
                      activeOpacity={0.7}
                    >
                      {isGeneratingRecommendations ? (
                        <>
                          <ActivityIndicator size="small" color="#fff" style={styles.buttonLoader} />
                          <Text style={styles.generateButtonText} numberOfLines={1}>Fetching Recommendations</Text>
                        </>
                      ) : isSigningIn ? (
                        <>
                          <ActivityIndicator size="small" color="#fff" style={styles.buttonLoader} />
                          <Text style={styles.generateButtonText} numberOfLines={1}>Fetching Recommendations</Text>
                        </>
                      ) : (
                        <>
                          <Image source={require('../assets/logo-google.png')} style={styles.googleIconImage} />
                          <Text style={styles.generateButtonText} numberOfLines={1}>Generate Recommendations</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {hasGeneratedRecommendations && (
                  <View style={{ paddingBottom: insets.bottom + 12 }}>
                    <TouchableOpacity
                      style={styles.generateButton}
                      onPress={showPaywall}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="sparkles" size={20} color="#fff" style={styles.buttonIcon} />
                      <Text style={styles.generateButtonText}>Regenerate</Text>
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
  container: {
    flex: 1,
    backgroundColor: '#3a3b3c',
  },
  captureButtonContainer: {
    position: 'absolute',
    bottom: 70,
    alignSelf: 'center',
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: '#fff',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  captureButtonTouch: {
    width: '100%',
    height: '100%',
    borderRadius: BUTTON_SIZE / 2,
  },
  // BottomSheet styles
  bottomSheetBackground: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  bottomSheetIndicator: {
    backgroundColor: '#ddd',
    width: 40,
    height: 4,
  },
  bottomSheetContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    flexGrow: 1,
  },
  loadingContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#3a3b3c',
    marginTop: 16,
    marginBottom: 4,
  },
  loadingSubtitle: {
    fontSize: 14,
    color: '#3a3b3c',
    textAlign: 'center',
  },
  errorContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#FF3B30',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#3a3b3c',
    textAlign: 'center',
    lineHeight: 20,
  },
  resultContent: {
    flex: 1,
  },
  resultHeader: {
    paddingVertical: 20,
    paddingHorizontal: 0,
  },
  outfitName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3a3b3c',
    marginBottom: 8,
  },
  rating: {
    fontSize: 16,
    fontWeight: '500',
    color: '#007AFF',
    marginBottom: 12,
  },
  shortDescription: {
    fontSize: 16,
    color: '#3a3b3c',
    lineHeight: 22,
  },
  seeMoreText: {
    fontSize: 14,
    color: '#007AFF',
    marginTop: 4,
  },
  generateButton: {
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
  },
  generateButtonDisabled: {
    backgroundColor: '#999',
    opacity: 0.5,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  buttonIcon: {
    marginRight: 8,
  },
  googleIconImage: {
    width: 20,
    height: 20,
    marginRight: 8,
  },
  buttonLoader: {
    marginRight: 8,
  },
  recommendationsContainer: {
    flex: 1,
    marginTop: 10,
  },
  recommendationsTitle: {
    fontSize: 18,
    marginBottom: 15,
    fontWeight: '500',
    color: '#3a3b3c',
  },
  placeholderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#999',
    marginTop: 12,
  },
  recommendationsList: {
    paddingBottom: 20,
  },
  recommendationCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'flex-start',
  },
  recommendationImageContainer: {
    marginRight: 12,
    width: 80,
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'flex-start',
  },
  recommendationImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  heartButton: {
    marginTop: 'auto',
    marginBottom: 'auto',
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendationContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  recommendationName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#3a3b3c',
    marginBottom: 2,
  },
  recommendationBrand: {
    fontSize: 14,
    color: '#007AFF',
    marginBottom: 4,
  },
  recommendationDescription: {
    fontSize: 13,
    color: '#3a3b3c',
    lineHeight: 18,
    marginBottom: 4,
  },
  recommendationPrice: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#3a3b3c',
  },
  recommendationSeparator: {
    height: 12,
  },
  // Border glow styles
  borderContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  borderWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    shadowColor: '#FF006E',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 25,
    elevation: 15,
  },
  borderOuter: {
    flex: 1,
    borderRadius: 0,
    padding: 0,
  },
  borderInner: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 0,
  },
  // Image overlay icons
  imageOverlayIcons: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 20,
    zIndex: 100,
  },
  overlayIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(58, 59, 60, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayTitle: {
    alignSelf: 'center',
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  cornerBracketsContainer: {
    position: 'absolute',
    top: '25%',
    left: '10%',
    right: '10%',
    bottom: '30%',
  },
  cornerBracket: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#fff',
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 20,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 20,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 20,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 20,
  },
  instructionContainer: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(58, 59, 60, 0.5)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  instructionCloseButton: {
    marginRight: 12,
  },
  instructionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
    flex: 1,
  },
});