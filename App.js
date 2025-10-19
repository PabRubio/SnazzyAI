import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, Alert, ActivityIndicator, FlatList, Image, Linking } from 'react-native';
import { StatusBar as RNStatusBar } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence, interpolate, Easing, runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as NavigationBar from 'expo-navigation-bar';
import { analyzeOutfit, generateRecommendations } from './services/openaiService';
import { performVirtualTryOn } from './services/geminiService';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet from '@gorhom/bottom-sheet';
import { BottomSheetView, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import ErrorBanner from './components/ErrorBanner';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window');
const BUTTON_SIZE = 60;
const BUTTON_BORDER_SIZE = 4;

// Utility function for safe haptic feedback
const safeHaptic = async (hapticFunction) => {
  try {
    await hapticFunction();
  } catch (error) {
    // Silently handle haptic not supported on device
    console.log('Haptics not available on this device');
  }
};

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessingCapture, setIsProcessingCapture] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [showError, setShowError] = useState(false);
  const [capturedPhotoUri, setCapturedPhotoUri] = useState(null);
  const [capturedPhotoBase64, setCapturedPhotoBase64] = useState(null);
  const [favoriteItems, setFavoriteItems] = useState(new Set());
  const [isGeneratingRecommendations, setIsGeneratingRecommendations] = useState(false);
  const [hasGeneratedRecommendations, setHasGeneratedRecommendations] = useState(false);
  const [showTryOnModal, setShowTryOnModal] = useState(false);
  const [selectedTryOnItem, setSelectedTryOnItem] = useState(null);
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);
  const [tryOnResultImage, setTryOnResultImage] = useState(null);
  const [showTryOnResult, setShowTryOnResult] = useState(false);
  const cameraRef = useRef(null);
  const captureTimerRef = useRef(null);
  const hapticIntervalRef = useRef(null);
  const delayedCaptureRef = useRef(null);
  const analysisAbortControllerRef = useRef(null);
  const recommendationsAbortControllerRef = useRef(null);
  const tryOnAbortControllerRef = useRef(null);

  // BottomSheet setup
  const bottomSheetRef = useRef(null);
  const snapPoints = useMemo(() => ['25%', '85%'], []);
  
  // BottomSheet callbacks
  const handleSheetChanges = useCallback((index) => {
    // If bottom sheet is closed (index = -1), reset the captured photo
    if (index === -1) {
      setCapturedPhotoUri(null);
      setCapturedPhotoBase64(null);
      setAnalysisResult(null);
      setIsAnalyzing(false);
      setHasGeneratedRecommendations(false);
      setIsGeneratingRecommendations(false);
    }
  }, []);

  // Handle opening purchase URLs in browser
  const handleOpenPurchaseUrl = useCallback(async (url) => {
    if (!url) {
      Alert.alert(
        'Link Unavailable',
        'No purchase link available for this item.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      // Basic URL validation
      const isValidUrl = url.startsWith('http://') || url.startsWith('https://');

      if (!isValidUrl) {
        Alert.alert(
          'Invalid Link',
          'The purchase link appears to be invalid.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Haptic feedback on tap
      await safeHaptic(() => Haptics.selectionAsync());
      // Open URL directly - it will throw if it truly can't open
      await Linking.openURL(url);
    } catch (error) {
      console.error('Error opening URL:', error);
      Alert.alert(
        'Error',
        'Unable to open the link. Please try again later.',
        [{ text: 'OK' }]
      );
    }
  }, []);

  // Handle toggling favorite status
  const handleToggleFavorite = useCallback(async (itemId) => {
    await safeHaptic(() => Haptics.selectionAsync());
    setFavoriteItems(prevFavorites => {
      const newFavorites = new Set(prevFavorites);
      if (newFavorites.has(itemId)) {
        newFavorites.delete(itemId);
      } else {
        newFavorites.add(itemId);
      }
      return newFavorites;
    });
  }, []);

  // Handle long press on recommendation item
  const handleLongPressRecommendation = useCallback(async (item) => {
    await safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
    setSelectedTryOnItem(item);
    setShowTryOnModal(true);
  }, []);

  // Handle Try-On modal OK button
  const handleTryOnOk = useCallback(async () => {
    await safeHaptic(() => Haptics.selectionAsync());

    // Close the modal first
    setShowTryOnModal(false);
    const currentItem = selectedTryOnItem;
    setSelectedTryOnItem(null);

    // Show loading screen
    setShowLoadingScreen(true);

    // Create abort controller for this try-on request
    const abortController = new AbortController();
    tryOnAbortControllerRef.current = abortController;

    try {
      console.log('Starting virtual try-on with Nano Banana...');

      // Perform virtual try-on using Gemini 2.5 Flash Image
      const result = await performVirtualTryOn(
        capturedPhotoBase64,
        currentItem.imageUrl,
        abortController.signal
      );

      // Clear abort controller on success
      if (tryOnAbortControllerRef.current === abortController) {
        tryOnAbortControllerRef.current = null;
      }

      console.log('Virtual try-on successful!');

      // Hide loading screen and show result overlay
      setShowLoadingScreen(false);
      setTryOnResultImage(result.dataUri);
      setShowTryOnResult(true);

    } catch (error) {
      console.error('Virtual try-on failed:', error);

      // Clear abort controller on error
      if (tryOnAbortControllerRef.current === abortController) {
        tryOnAbortControllerRef.current = null;
      }

      // Hide loading screen
      setShowLoadingScreen(false);

      // If request was aborted, just clean up silently
      if (error.name === 'AbortError') {
        return;
      }

      // Show error to user
      let errorMsg = 'Virtual try-on failed. Please try again.';
      if (error.message) {
        if (error.message.includes('API key')) {
          errorMsg = 'Google API key not configured. Please check settings.';
        } else if (error.message.includes('Network') || error.message.includes('connection')) {
          errorMsg = 'Network error. Please check your connection.';
        } else if (error.message.includes('Rate limit')) {
          errorMsg = 'Too many requests. Please wait a moment.';
        }
      }

      setErrorMessage(errorMsg);
      setShowError(true);

      // Haptic feedback for error
      await safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
    }
  }, [capturedPhotoBase64, selectedTryOnItem]);

  // Handle Try-On modal Cancel button
  const handleTryOnCancel = useCallback(async () => {
    await safeHaptic(() => Haptics.selectionAsync());
    setShowTryOnModal(false);
    setSelectedTryOnItem(null);
  }, []);

  // Handle closing try-on result
  const handleCloseTryOnResult = useCallback(async () => {
    await safeHaptic(() => Haptics.selectionAsync());
    setShowTryOnResult(false);
    setTryOnResultImage(null);
  }, []);

  // Handle refresh button - reset to camera view
  const handleRefresh = useCallback(async () => {
    await safeHaptic(() => Haptics.selectionAsync());

    // Abort any ongoing network requests
    if (analysisAbortControllerRef.current) {
      analysisAbortControllerRef.current.abort();
      analysisAbortControllerRef.current = null;
    }
    if (recommendationsAbortControllerRef.current) {
      recommendationsAbortControllerRef.current.abort();
      recommendationsAbortControllerRef.current = null;
    }
    if (tryOnAbortControllerRef.current) {
      tryOnAbortControllerRef.current.abort();
      tryOnAbortControllerRef.current = null;
    }

    // Close bottom sheet
    bottomSheetRef.current?.close();
    // Reset all state
    setCapturedPhotoUri(null);
    setCapturedPhotoBase64(null);
    setAnalysisResult(null);
    setIsAnalyzing(false);
    setHasGeneratedRecommendations(false);
    setIsGeneratingRecommendations(false);
    setFavoriteItems(new Set());
    // Dismiss error banner if visible
    setShowError(false);
    setErrorMessage(null);
    // Close try-on modal if open
    setShowTryOnModal(false);
    setSelectedTryOnItem(null);
    // Close try-on result if open
    setShowTryOnResult(false);
    setTryOnResultImage(null);
  }, []);

  // Handle generating recommendations on demand
  const handleGenerateRecommendations = useCallback(async () => {
    if (!analysisResult || !analysisResult.searchTerms || isGeneratingRecommendations || hasGeneratedRecommendations) {
      return;
    }

    setIsGeneratingRecommendations(true);
    await safeHaptic(() => Haptics.selectionAsync());

    // Create abort controller for this recommendation request
    const abortController = new AbortController();
    recommendationsAbortControllerRef.current = abortController;

    try {
      console.log('Generating recommendations on demand...');
      const recommendations = await generateRecommendations(analysisResult.searchTerms, abortController.signal);

      // Clear abort controller on success
      if (recommendationsAbortControllerRef.current === abortController) {
        recommendationsAbortControllerRef.current = null;
      }

      // Check if photo was cleared (user pressed refresh) - if so, don't update recommendations
      setCapturedPhotoUri(currentUri => {
        if (!currentUri) {
          // Photo was cleared, cancel updating recommendations
          setIsGeneratingRecommendations(false);
          return currentUri;
        }

        // Photo still exists, update analysis result with recommendations
        setAnalysisResult(prevResult => ({
          ...prevResult,
          recommendations: recommendations
        }));

        setHasGeneratedRecommendations(true);
        setIsGeneratingRecommendations(false);

        return currentUri;
      });
    } catch (error) {
      console.error('Failed to generate recommendations:', error);

      // Clear abort controller on error
      if (recommendationsAbortControllerRef.current === abortController) {
        recommendationsAbortControllerRef.current = null;
      }

      // If request was aborted, just clean up silently
      if (error.name === 'AbortError') {
        setIsGeneratingRecommendations(false);
        return;
      }

      // Check if photo was cleared - if so, don't show error
      setCapturedPhotoUri(currentUri => {
        if (!currentUri) {
          // Photo was cleared, just reset flag
          setIsGeneratingRecommendations(false);
          return currentUri;
        }

        // Photo still exists, show error
        setIsGeneratingRecommendations(false);
        setErrorMessage('Failed to generate recommendations. Please try again.');
        setShowError(true);

        return currentUri;
      });
    }
  }, [analysisResult, isGeneratingRecommendations, hasGeneratedRecommendations]);

  // Animation values
  const buttonScale = useSharedValue(1);
  
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
        const result = await analyzeOutfit(photo.base64, abortController.signal);
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
            setErrorMessage('Could not analyze outfit. Please try again with a clear photo.');
            setShowError(true);
            // Reset camera state and clear captured photo
            setTimeout(() => {
              setAnalysisResult(null);
              setCapturedPhotoUri(null);
            }, 500);
          } else {
            // Valid photo, show results
            setAnalysisResult(result);
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

          setErrorMessage(errorMsg);
          setShowError(true);
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

  useEffect(() => {
    RNStatusBar.setHidden(true, 'none');

    // Set navigation bar button style
    const setupNavigationBar = async () => {
      try {
        await NavigationBar.setButtonStyleAsync('light');
      } catch (error) {
        console.log('Navigation bar setup failed:', error);
      }
    };
    setupNavigationBar();

    // Cleanup on unmount
    return () => {
      // Clear any pending timers
      if (captureTimerRef.current) {
        clearTimeout(captureTimerRef.current);
      }
      if (delayedCaptureRef.current) {
        clearTimeout(delayedCaptureRef.current);
      }
      if (hapticIntervalRef.current) {
        clearInterval(hapticIntervalRef.current);
      }
      // Abort any ongoing network requests
      if (analysisAbortControllerRef.current) {
        analysisAbortControllerRef.current.abort();
      }
      if (recommendationsAbortControllerRef.current) {
        recommendationsAbortControllerRef.current.abort();
      }
      if (tryOnAbortControllerRef.current) {
        tryOnAbortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // Animated styles
  const buttonAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: buttonScale.value }],
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

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text>Requesting camera permissions...</Text>
        <StatusBar hidden />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text>Camera access denied. Please enable camera permissions in your device settings.</Text>
        <StatusBar hidden />
      </View>
    );
  }

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
            {/* Top overlay icons - hide during processing */}
            {!isProcessingCapture && (
              <View style={styles.imageOverlayIcons}>
                {/* X icon - top left */}
                <TouchableOpacity
                  style={styles.overlayIconButton}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>

                {/* Snazzy AI text in center */}
                <Text style={styles.overlayTitle}>Snazzy AI</Text>

                {/* Refresh icon - top right */}
                <TouchableOpacity
                  style={styles.overlayIconButton}
                  activeOpacity={0.7}
                  onPress={handleRefresh}
                >
                  <Ionicons name="refresh" size={28} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : (
          // Show camera view when no photo is captured
          <>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFillObject}
              facing="back"
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
            {!isCameraReady && (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading camera...</Text>
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
        
        {/* Error Banner */}
        <ErrorBanner
          message={errorMessage}
          type="error"
          visible={showError}
          onDismiss={() => setShowError(false)}
          autoDismissDelay={5000}
        />
        
        {/* Capture Button - only show when camera is ready and no photo is captured */}
        {isCameraReady && !capturedPhotoUri && (
          <View style={styles.captureButtonContainer}>
            {/* Main Button */}
            <Animated.View style={[styles.captureButton, buttonAnimatedStyle]}>
              <TouchableOpacity
                style={styles.captureButtonTouch}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                activeOpacity={1}
              />
            </Animated.View>
          </View>
        )}
        
        {/* Bottom Sheet for Analysis Results */}
        {(isAnalyzing || analysisResult) && (
          <BottomSheet
              ref={bottomSheetRef}
              index={0}
              snapPoints={snapPoints}
              onChange={handleSheetChanges}
              enablePanDownToClose={false}
              enableOverDrag={false}
              animateOnMount={true}
              backdropComponent={null}
              backgroundStyle={styles.bottomSheetBackground}
              handleIndicatorStyle={styles.bottomSheetIndicator}
              maxDynamicContentSize={height * 0.85}
              enableDynamicSizing={false}
              enableContentPanningGesture={!showTryOnModal}
              enableHandlePanningGesture={!showTryOnModal}
            >
          <BottomSheetScrollView
            contentContainerStyle={styles.bottomSheetContent}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!showTryOnModal}
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
                  <Text style={styles.shortDescription} numberOfLines={2} ellipsizeMode="tail">{analysisResult.shortDescription}</Text>
                </View>

                {/* Recommendations Section - Always visible */}
                <View style={styles.recommendationsContainer}>
                  <Text style={styles.recommendationsTitle}>Recommended Items</Text>

                  {/* Show items if recommendations have been generated */}
                  {hasGeneratedRecommendations && analysisResult.recommendations && analysisResult.recommendations.length > 0 ? (
                    analysisResult.recommendations.map((item, index) => {
                      const itemId = `${analysisResult.outfitName}-${index}`;
                      const isFavorite = favoriteItems.has(itemId);
                      return (
                        <TouchableOpacity
                          key={`rec-${index}`}
                          style={[styles.recommendationCard, { marginBottom: 12 }]}
                          activeOpacity={0.8}
                          onPress={() => handleOpenPurchaseUrl(item.purchaseUrl)}
                          onLongPress={() => handleLongPressRecommendation(item)}
                          delayLongPress={1000}
                        >
                          <View style={styles.recommendationImageContainer}>
                            <Image
                              source={{ uri: item.imageUrl || 'https://via.placeholder.com/150' }}
                              style={styles.recommendationImage}
                              resizeMode="cover"
                            />
                            <TouchableOpacity
                              style={styles.heartButton}
                              onPress={() => handleToggleFavorite(itemId)}
                              activeOpacity={0.7}
                            >
                              <Ionicons
                                name={isFavorite ? 'heart' : 'heart-outline'}
                                size={24}
                                color={isFavorite ? '#FF3B30' : '#999'}
                              />
                            </TouchableOpacity>
                          </View>
                          <View style={styles.recommendationContent}>
                            <Text style={styles.recommendationName} numberOfLines={1}>{item.name}</Text>
                            <Text style={styles.recommendationBrand}>{item.brand}</Text>
                            <Text style={styles.recommendationDescription} numberOfLines={2} ellipsizeMode="tail">
                              {item.description}
                            </Text>
                            <Text style={styles.recommendationPrice}>{item.price}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    /* Show placeholder when no recommendations generated yet */
                    !hasGeneratedRecommendations && (
                      <View style={styles.placeholderContainer}>
                        <Ionicons name="shirt-outline" size={48} color="#ccc" />
                        <Text style={styles.placeholderText}>Nothing to see here ;)</Text>
                      </View>
                    )
                  )}
                </View>

                {/* Generate Recommendations Button - At the very bottom */}
                {!hasGeneratedRecommendations && analysisResult.searchTerms && (
                  <View style={styles.generateButtonContainer}>
                    <TouchableOpacity
                      style={[styles.generateButton, isGeneratingRecommendations && styles.generateButtonDisabled]}
                      onPress={handleGenerateRecommendations}
                      disabled={isGeneratingRecommendations}
                      activeOpacity={0.7}
                    >
                      {isGeneratingRecommendations ? (
                        <>
                          <ActivityIndicator size="small" color="#fff" style={styles.buttonLoader} />
                          <Text style={styles.generateButtonText}>Fetching Recommendations</Text>
                        </>
                      ) : (
                        <>
                          <Ionicons name="sparkles" size={20} color="#fff" style={styles.buttonIcon} />
                          <Text style={styles.generateButtonText}>Generate Recommendations</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : null}
          </BottomSheetScrollView>
          </BottomSheet>
        )}

        {/* Try-On Custom Overlay (replaces Modal to fix navigation bar) */}
        {showTryOnModal && (
          <View style={styles.modalOverlay}>
            <BlurView
              intensity={100}
              tint="dark"
              style={StyleSheet.absoluteFillObject}
            >
              <TouchableOpacity
                style={StyleSheet.absoluteFillObject}
                activeOpacity={1}
              />
            </BlurView>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Try-On feature (BETA)</Text>
              <Text style={styles.modalSubtitle}>See how this item looks on you using AI technology ✨</Text>
              <View style={styles.modalButtonsContainer}>
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonCancel]}
                    onPress={handleTryOnCancel}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.modalButtonTextCancel}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonOk]}
                    onPress={handleTryOnOk}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.modalButtonTextOk}>OK</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Loading Screen - Full white screen with loading indicator */}
        {showLoadingScreen && (
          <View style={styles.loadingScreenOverlay}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingScreenText}>Loading...</Text>
          </View>
        )}

        {/* Try-On Result Overlay - Full screen overlay with result image */}
        {showTryOnResult && tryOnResultImage && (
          <View style={styles.tryOnResultOverlay}>
            <Image
              source={{ uri: tryOnResultImage }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
            {/* Top overlay icons for try-on result */}
            <View style={styles.imageOverlayIcons}>
              {/* Back arrow - top left */}
              <TouchableOpacity
                style={styles.overlayIconButton}
                activeOpacity={0.7}
                onPress={handleCloseTryOnResult}
              >
                <Ionicons name="arrow-back" size={28} color="#fff" />
              </TouchableOpacity>

              {/* Snazzy AI text in center */}
              <Text style={styles.overlayTitle}>Snazzy AI</Text>

              {/* Play icon - top right (no functionality yet) */}
              <TouchableOpacity
                style={styles.overlayIconButton}
                activeOpacity={0.7}
              >
                <Ionicons name="play" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        <StatusBar hidden />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
  },
  captureButtonContainer: {
    position: 'absolute',
    bottom: 50,
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
    paddingBottom: 30,
  },
  loadingContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 4,
  },
  loadingSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  errorContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FF3B30',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
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
    color: '#333',
    marginBottom: 8,
  },
  rating: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 12,
  },
  shortDescription: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
  generateButtonContainer: {
    marginTop: 96,
    marginBottom: 20,
    alignItems: 'center',
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
    minWidth: 240,
  },
  generateButtonDisabled: {
    backgroundColor: '#999',
    opacity: 0.7,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonIcon: {
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
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  placeholderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 66,
    minHeight: 150,
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    marginTop: 16,
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
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  recommendationBrand: {
    fontSize: 14,
    color: '#007AFF',
    marginBottom: 4,
  },
  recommendationDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 4,
  },
  recommendationPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
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
  // Try-On Modal styles
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: width * 0.9,
    maxWidth: 520,
    minHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  modalButtonsContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  modalButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  modalButtonCancel: {
    backgroundColor: '#f0f0f0',
  },
  modalButtonOk: {
    backgroundColor: '#007AFF',
  },
  modalButtonTextCancel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  modalButtonTextOk: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  // Image overlay icons
  imageOverlayIcons: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 100,
  },
  overlayIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayTitle: {
    alignSelf: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  // Loading Screen styles
  loadingScreenOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000,
    elevation: 10000,
  },
  loadingScreenText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  // Try-On Result Overlay styles
  tryOnResultOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 10001,
    elevation: 10001,
  },
});