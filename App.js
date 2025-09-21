import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, Alert, ActivityIndicator, FlatList, Image, Linking, TextInput } from 'react-native';
import { StatusBar as RNStatusBar } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence, interpolate, Easing, runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { analyzeOutfit, updateOutfitStyle } from './services/openaiService';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import BottomSheet from '@gorhom/bottom-sheet';
import { BottomSheetView, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import ErrorBanner from './components/ErrorBanner';
import { LinearGradient } from 'expo-linear-gradient';

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
  const [isEditingStyle, setIsEditingStyle] = useState(false);
  const [editedStyleValue, setEditedStyleValue] = useState('');
  const [originalStyleValue, setOriginalStyleValue] = useState('');
  const [isUpdatingStyle, setIsUpdatingStyle] = useState(false);
  const cameraRef = useRef(null);
  const captureTimerRef = useRef(null);
  const hapticIntervalRef = useRef(null);
  const delayedCaptureRef = useRef(null);
  const styleInputRef = useRef(null);

  // Animation values for style editor
  const editButtonOpacity = useSharedValue(1);
  const editButtonScale = useSharedValue(1);
  const inputOpacity = useSharedValue(0);
  
  // BottomSheet setup
  const bottomSheetRef = useRef(null);
  const snapPoints = useMemo(() => ['25%', '90%'], []);
  
  // BottomSheet callbacks
  const handleSheetChanges = useCallback((index) => {
    console.log('BottomSheet snap point changed to:', index);
    // If bottom sheet is closed (index = -1), reset the captured photo
    if (index === -1) {
      setCapturedPhotoUri(null);
      setAnalysisResult(null);
      setIsAnalyzing(false);
    }
  }, []);

  // Handle style edit button press
  const handleEditStylePress = useCallback(() => {
    // Animate button out
    editButtonOpacity.value = withTiming(0, { duration: 150 });
    editButtonScale.value = withTiming(0.8, { duration: 150 });

    // Animate input in
    inputOpacity.value = withTiming(1, { duration: 200 });

    setIsEditingStyle(true);
    setEditedStyleValue(analysisResult?.outfitName || '');
    setOriginalStyleValue(analysisResult?.outfitName || '');
    // Small haptic feedback
    safeHaptic(() => Haptics.selectionAsync());
    // Focus the input after animations
    setTimeout(() => {
      styleInputRef.current?.focus();
    }, 200);
  }, [analysisResult, editButtonOpacity, editButtonScale, inputOpacity]);

  // Handle style edit cancel
  const handleCancelStyleEdit = useCallback(() => {
    // Animate input out
    inputOpacity.value = withTiming(0, { duration: 150 });

    // Animate button back in
    editButtonOpacity.value = withTiming(1, { duration: 200 });
    editButtonScale.value = withTiming(1, { duration: 200 });

    setTimeout(() => {
      setIsEditingStyle(false);
      setEditedStyleValue('');
      setOriginalStyleValue('');
    }, 150);
  }, [editButtonOpacity, editButtonScale, inputOpacity]);

  // Handle style edit submit
  const handleSubmitStyleEdit = useCallback(async () => {
    const trimmedStyle = editedStyleValue.trim();

    if (!trimmedStyle) {
      // If empty, just cancel
      handleCancelStyleEdit();
      return;
    }

    if (trimmedStyle === originalStyleValue) {
      // No change, just close editor
      handleCancelStyleEdit();
      return;
    }

    setIsUpdatingStyle(true);

    try {
      // Get current search terms from analysis result
      const currentSearchTerms = analysisResult?.searchTerms || '';

      // Call the style update service
      const result = await updateOutfitStyle(trimmedStyle, currentSearchTerms);

      if (result.success) {
        // Update the analysis result with new style and products
        setAnalysisResult(prevResult => ({
          ...prevResult,
          outfitName: result.newStyle,
          recommendations: result.products && result.products.length > 0
            ? result.products.slice(0, 5) // Ensure max 5 products
            : prevResult.recommendations // Keep old products if none found
        }));

        // Success haptic feedback
        await safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));

        // Show success message if products were found
        if (result.products && result.products.length > 0) {
          setErrorMessage(`Style updated! Found ${result.products.length} matching items.`);
          setShowError(true);
        } else if (result.message) {
          setErrorMessage(result.message);
          setShowError(true);
        }

        // Close the editor
        handleCancelStyleEdit();
      } else {
        // Style is invalid or error occurred
        await safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));

        setErrorMessage(result.error || 'Invalid style name. Please try a fashion-related style.');
        setShowError(true);

        // Don't close editor, let user try again
        // Just select all text for easy re-typing
        setTimeout(() => {
          styleInputRef.current?.focus();
          styleInputRef.current?.setNativeProps({ selection: { start: 0, end: trimmedStyle.length } });
        }, 100);
      }
    } catch (error) {
      console.error('Error updating style:', error);
      setErrorMessage('Failed to update style. Please try again.');
      setShowError(true);

      await safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
    } finally {
      setIsUpdatingStyle(false);
    }
  }, [editedStyleValue, originalStyleValue, analysisResult, handleCancelStyleEdit]);

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
      // Validate URL can be opened
      const canOpen = await Linking.canOpenURL(url);
      
      if (canOpen) {
        // Haptic feedback on tap
        await safeHaptic(() => Haptics.selectionAsync());
        await Linking.openURL(url);
      } else {
        Alert.alert(
          'Invalid Link',
          'The purchase link appears to be invalid.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error opening URL:', error);
      Alert.alert(
        'Error',
        'Unable to open the link. Please try again later.',
        [{ text: 'OK' }]
      );
    }
  }, []);

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
      
      // Store the captured photo URI to display it as background
      setCapturedPhotoUri(photo.uri);
      
      // Reset capture state
      setIsCapturing(false);
      
      // Start analysis and show BottomSheet immediately with the photo
      setIsAnalyzing(true);
      setAnalysisResult(null);
      bottomSheetRef.current?.snapToIndex(0); // Snap to collapsed state (25%)
      
      try {
        console.log('Starting outfit analysis...');
        const result = await analyzeOutfit(photo.base64);
        console.log('Analysis complete:', result);
        
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
        
      } catch (analysisError) {
        console.error('Analysis failed:', analysisError);
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

  // Edit button animated styles
  const editButtonAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: editButtonOpacity.value,
      transform: [{ scale: editButtonScale.value }],
    };
  });

  // Input animated style
  const inputAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: inputOpacity.value,
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
          <Image
            source={{ uri: capturedPhotoUri }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
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
            maxDynamicContentSize={height * 0.9}
            enableDynamicSizing={false}
          >
          <BottomSheetScrollView contentContainerStyle={styles.bottomSheetContent} showsVerticalScrollIndicator={false}>
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
                  <View style={styles.outfitNameContainer}>
                    {isEditingStyle ? (
                      <Animated.View style={[styles.inputWrapper, inputAnimatedStyle]}>
                        <TextInput
                          ref={styleInputRef}
                          style={styles.styleInput}
                          value={editedStyleValue}
                          onChangeText={setEditedStyleValue}
                          onSubmitEditing={handleSubmitStyleEdit}
                          onBlur={handleCancelStyleEdit}
                          placeholder="Enter style name"
                          placeholderTextColor="#999"
                          autoCapitalize="words"
                          returnKeyType="done"
                          editable={!isUpdatingStyle}
                          selectTextOnFocus
                          maxLength={30}
                        />
                      </Animated.View>
                    ) : (
                      <>
                        <Text style={styles.outfitName}>{analysisResult.outfitName}</Text>
                        <Animated.View style={[editButtonAnimatedStyle]}>
                          <TouchableOpacity
                            style={styles.editButton}
                            onPress={handleEditStylePress}
                            activeOpacity={0.7}
                            disabled={isUpdatingStyle}
                          >
                            <Text style={styles.editButtonText}>✏️</Text>
                          </TouchableOpacity>
                        </Animated.View>
                      </>
                    )}
                    {isUpdatingStyle && (
                      <ActivityIndicator
                        size="small"
                        color="#007AFF"
                        style={styles.styleUpdateLoader}
                      />
                    )}
                  </View>
                  <Text style={styles.rating}>⭐ {analysisResult.rating}/10</Text>
                  <Text style={styles.shortDescription}>{analysisResult.shortDescription}</Text>
                </View>
                <View style={styles.recommendationsContainer}>
                  <Text style={styles.recommendationsTitle}>Recommended Items</Text>
                  {analysisResult.recommendations.map((item, index) => (
                    <TouchableOpacity 
                      key={`rec-${index}`}
                      style={[styles.recommendationCard, index < analysisResult.recommendations.length - 1 && { marginBottom: 12 }]} 
                      activeOpacity={0.8}
                      onPress={() => handleOpenPurchaseUrl(item.purchaseUrl)}
                    >
                      <Image 
                        source={{ uri: item.imageUrl || 'https://via.placeholder.com/150' }}
                        style={styles.recommendationImage}
                        resizeMode="cover"
                      />
                      <View style={styles.recommendationContent}>
                        <Text style={styles.recommendationName} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.recommendationBrand}>{item.brand}</Text>
                        <Text style={styles.recommendationDescription} numberOfLines={2} ellipsizeMode="tail">
                          {item.description}
                        </Text>
                        <Text style={styles.recommendationPrice}>{item.price}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
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
  outfitNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    minHeight: 30,
  },
  outfitName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  editButton: {
    marginLeft: 8,
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  editButtonText: {
    fontSize: 16,
  },
  inputWrapper: {
    flex: 1,
    marginRight: 8,
  },
  styleInput: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
    paddingVertical: 2,
    paddingHorizontal: 0,
  },
  styleUpdateLoader: {
    marginLeft: 8,
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
  },
  recommendationImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#f5f5f5',
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
    borderRadius: 30,
    padding: 20,
  },
  borderInner: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 20,
  },
});