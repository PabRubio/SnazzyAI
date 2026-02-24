import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Text from '../components/Text';
import { CameraView } from 'expo-camera';
import { StatusBar } from 'expo-status-bar';
import TextInput from '../components/TextInput';
import { StatusBar as RNStatusBar } from 'react-native';
import { StyleSheet, View, TouchableOpacity, Dimensions, Alert, ActivityIndicator, FlatList, Image, Linking } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence, interpolate, Easing, runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import BottomSheet from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetView, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useEventListener } from 'expo';
import { supabase } from '../services/supabase';
import { useVideoPlayer, VideoView } from 'expo-video';
import { uploadPhoto, saveOutfitAnalysis, saveRecommendations, saveTryOnResult, addFavorite, removeFavorite, getProfile } from '../services/supabaseHelpers';

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

export default function CameraScreen({ navigation }) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [capturedPhotoUri, setCapturedPhotoUri] = useState(null);
  const [capturedPhotoBase64, setCapturedPhotoBase64] = useState(null);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isGeneratingRecommendations, setIsGeneratingRecommendations] = useState(false);
  const [hasGeneratedRecommendations, setHasGeneratedRecommendations] = useState(false);
  const [tryOnResultStoragePath, setTryOnResultStoragePath] = useState(null);
  const [isProcessingCapture, setIsProcessingCapture] = useState(false);

  const [regenerateCount, setRegenerateCount] = useState(0);
  const [showTryOnModal, setShowTryOnModal] = useState(false);
  const [favoriteItems, setFavoriteItems] = useState(new Map());
  const [selectedTryOnItem, setSelectedTryOnItem] = useState(null);
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState(null);
  const [tryOnResultImage, setTryOnResultImage] = useState(null);
  const [showTryOnResult, setShowTryOnResult] = useState(false);
  const [showInstruction, setShowInstruction] = useState(true);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [editedTitle, setEditedTitle] = useState('');

  const cameraRef = useRef(null);
  const insets = useSafeAreaInsets();
  const captureTimerRef = useRef(null);
  const hapticIntervalRef = useRef(null);
  const delayedCaptureRef = useRef(null);
  const analysisAbortControllerRef = useRef(null);
  const recommendationsAbortControllerRef = useRef(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isVideoVisible, setIsVideoVisible] = useState(false);
  const videoGenerationAbortControllerRef = useRef(null);
  const tryOnAbortControllerRef = useRef(null);

  // BottomSheet setup
  const bottomSheetRef = useRef(null);
  const snapPoints = useMemo(() => ['25%', '85%'], []);

  // Video player setup
  const videoPlayer = useVideoPlayer(generatedVideoUrl, player => {
    player.loop = false;
    player.play();
  });

  // When video finishes, hide it to show the photo
  useEventListener(videoPlayer, 'playToEnd', () => {
    setIsVideoPlaying(false);
    setIsVideoVisible(false);
    videoPlayer.pause();
  });

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
  const handleToggleFavorite = useCallback(async (item, itemId) => {
    const isFavorite = favoriteItems.has(itemId);
    const dbUuid = favoriteItems.get(itemId);

    // Optimistically update UI
    setFavoriteItems(prevFavorites => {
      const newFavorites = new Map(prevFavorites);
      if (isFavorite) {
        newFavorites.delete(itemId);
      } else {
        newFavorites.set(itemId, 'pending'); // Temporary until we get the UUID
      }
      return newFavorites;
    });

    try {
      if (isFavorite) {
        // Remove from favorites using database UUID
        await removeFavorite(dbUuid);
      } else {
        // Add to favorites and get the database UUID back
        const newDbUuid = await addFavorite({
          name: item.name,
          brand: item.brand,
          price: item.price,
          imageUrl: item.imageUrl,
          purchaseUrl: item.purchaseUrl,
          description: item.description,
          category: item.category || 'other'
        });
        // Update with actual database UUID
        setFavoriteItems(prevFavorites => {
          const newFavorites = new Map(prevFavorites);
          newFavorites.set(itemId, newDbUuid);
          return newFavorites;
        });
      }
    } catch (error) {
      console.error('Failed to update favorite:', error);
      // Revert optimistic update on error
      setFavoriteItems(prevFavorites => {
        const newFavorites = new Map(prevFavorites);
        if (isFavorite) {
          newFavorites.set(itemId, dbUuid); // Restore with original UUID
        } else {
          newFavorites.delete(itemId);
        }
        return newFavorites;
      });
      Alert.alert('Error', 'Failed to update favorite');
    }
  }, [favoriteItems]);

  // Handle long press on recommendation item
  const handleLongPressRecommendation = useCallback(async (item) => {
    await safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
    setSelectedTryOnItem(item);
    setShowTryOnModal(true);
  }, []);

  // Handle Try-On modal OK button
  const handleTryOnOk = useCallback(async () => {
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

      // Call Supabase edge function for virtual try-on
      const { data, error } = await supabase.functions.invoke('virtual-try-on', {
        body: {
          userPhotoBase64: capturedPhotoBase64,
          clothingImageUrl: currentItem.imageUrl
        }
      });

      if (error) {
        throw new Error(error.message || 'Virtual try-on failed');
      }

      if (!data || !data.base64) {
        throw new Error('No image returned from virtual try-on');
      }

      // Clear abort controller on success
      if (tryOnAbortControllerRef.current === abortController) {
        tryOnAbortControllerRef.current = null;
      }

      console.log('Virtual try-on successful!');

      // Upload result image to storage once (while loading screen is still showing)
      const { url: resultImageUrl, path: resultStoragePath } = await uploadPhoto(data.base64, 'try-on-results');
      setTryOnResultStoragePath(resultStoragePath);

      // Save try-on result to database (without awaiting) — passes pre-uploaded URL
      const photoUrl = capturedPhotoUri;
      saveTryOnResult(photoUrl, currentItem.imageUrl, resultImageUrl).catch(err => {
        console.error('Failed to save try-on result:', err);
      });

      // Hide loading screen and show result overlay
      setTryOnResultImage(data.dataUri);
      setShowLoadingScreen(false);
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

    }
  }, [capturedPhotoBase64, selectedTryOnItem]);

  // Handle Try-On modal Cancel button
  const handleTryOnCancel = useCallback(async () => {
    setShowTryOnModal(false);
    setSelectedTryOnItem(null);
  }, []);

  // Handle closing try-on result
  const handleCloseTryOnResult = useCallback(async () => {
    if (videoGenerationAbortControllerRef.current) {
      videoGenerationAbortControllerRef.current.abort();
      videoGenerationAbortControllerRef.current = null;
    }
    setTryOnResultStoragePath(null);
    setIsGeneratingVideo(false);
    setGeneratedVideoUrl(null);
    setShowTryOnResult(false);
    setTryOnResultImage(null);
    setIsVideoPlaying(false);
    setIsVideoVisible(false);
  }, []);

  // Handle video generation from try-on result
  const handleGenerateVideo = useCallback(async () => {
    if (!tryOnResultStoragePath || isGeneratingVideo) return;

    setIsGeneratingVideo(true);

    // Create abort controller
    const abortController = new AbortController();
    videoGenerationAbortControllerRef.current = abortController;

    try {
      console.log('Starting video generation...');

      // Call video generation edge function with storage path (no re-upload needed)
      const { data, error } = await supabase.functions.invoke('generate-video', {
        body: {
          imagePath: tryOnResultStoragePath
        }
      });

      if (error) {
        throw new Error(error.message || 'Video generation failed');
      }

      if (!data || !data.videoUrl) {
        throw new Error('No video URL returned');
      }

      // Clear abort controller on success
      if (videoGenerationAbortControllerRef.current === abortController) {
        videoGenerationAbortControllerRef.current = null;
      }

      console.log('Video generated successfully:', data.videoUrl);

      setGeneratedVideoUrl(data.videoUrl);
      setIsVideoVisible(true); // 🥸
      setIsVideoPlaying(true);

    } catch (error) {
      console.error('Video generation failed:', error);

      if (videoGenerationAbortControllerRef.current === abortController) {
        videoGenerationAbortControllerRef.current = null;
      }

      if (error.name === 'AbortError') {
        setIsGeneratingVideo(false);
        return;
      }

      Alert.alert(
        'Video Generation Failed',
        'Unable to generate video. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsGeneratingVideo(false);
    }
  }, [tryOnResultStoragePath, isGeneratingVideo]);

  // Handle toggling video play/pause
  const handleToggleVideoPlayback = useCallback(() => {
    if (!videoPlayer) return;
    if (isVideoPlaying) {
      videoPlayer.pause();
      setIsVideoPlaying(false);
    } else if (isVideoVisible) {
      videoPlayer.play();
      setIsVideoPlaying(true);
    } else {
      setIsVideoVisible(true);
      videoPlayer.replay();
      setIsVideoPlaying(true);
    }
  }, [videoPlayer, isVideoPlaying, isVideoVisible]);

  // Handle close button - reset and navigate back to home
  const handleClose = useCallback(async () => {
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
    if (videoGenerationAbortControllerRef.current) {
      videoGenerationAbortControllerRef.current.abort();
      videoGenerationAbortControllerRef.current = null;
    }

    // Close bottom sheet first
    bottomSheetRef.current?.close();

    // Wait for bottom sheet animation to complete (250ms)
    // Then navigate back - let unmount cleanup handle state reset
    setTimeout(() => {
      navigation.goBack();
    }, 250);
  }, [navigation]);

  // Handle refresh button - reset to camera view
  const handleRefresh = useCallback(async () => {
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
    if (videoGenerationAbortControllerRef.current) {
      videoGenerationAbortControllerRef.current.abort();
      videoGenerationAbortControllerRef.current = null;
    }

    // Close bottom sheet first
    bottomSheetRef.current?.close();

    // Wait for bottom sheet animation (250ms), then reset all state
    setTimeout(() => {
      setCapturedPhotoUri(null);
      setCapturedPhotoBase64(null);
      setTryOnResultStoragePath(null);
      setAnalysisResult(null);
      setIsAnalyzing(false);
      setHasGeneratedRecommendations(false);
      setIsGeneratingRecommendations(false);
      setRegenerateCount(0);
      setShowTryOnModal(false);
      setFavoriteItems(new Map());
      setIsDescriptionExpanded(false);
      setIsGeneratingVideo(false);
      setGeneratedVideoUrl(null);
      setSelectedTryOnItem(null);
      setShowTryOnResult(false);
      setTryOnResultImage(null);
      setIsVideoPlaying(false);
      setIsVideoVisible(false);
      setIsEditingTitle(false);
      setEditedTitle('');
    }, 250);
  }, []);

  // Handle confirming inline outfit name edit
  const handleConfirmEdit = useCallback(() => {
    const trimmed = editedTitle.trim().replace(/\s+/g, ' ');
    if (!trimmed || !/^[a-zA-Z\s]+$/.test(trimmed) || trimmed.length > 30) {
      Alert.alert('Invalid Name', 'Name must be 1-30 characters and contain only letters and spaces.');
      setIsEditingTitle(false);
      return;
    }
    setAnalysisResult(prev => ({ ...prev, outfitName: trimmed }));
    setIsEditingTitle(false);
    // Fire-and-forget DB update
    if (analysisResult?.analysisId) {
      supabase
        .from('outfit_analyses')
        .update({ outfit_name: trimmed })
        .eq('id', analysisResult.analysisId)
        .then(({ error }) => {
          if (error) console.error('Failed to update outfit name:', error);
        });
    }
  }, [editedTitle, analysisResult?.analysisId]);

  const handleCancelEdit = useCallback(() => {
    setIsEditingTitle(false);
  }, []);

  // Handle generating recommendations on demand
  const handleGenerateRecommendations = useCallback(async () => {
    if (!analysisResult || !analysisResult.isValidPhoto || isGeneratingRecommendations || hasGeneratedRecommendations) {
      return;
    }

    setIsGeneratingRecommendations(true);

    // Create abort controller for this recommendation request
    const abortController = new AbortController();
    recommendationsAbortControllerRef.current = abortController;

    try {
      console.log('Generating recommendations on demand...');

      // Call Supabase edge function for product search
      const { data, error } = await supabase.functions.invoke('search-products-2', {
        body: {
          base64Image: capturedPhotoBase64,
          userProfile: userProfile
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to generate recommendations');
      }

      if (!data || !data.products) {
        throw new Error('No recommendations returned');
      }

      const recommendations = data.products;

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
        setAnalysisResult(prevResult => {
          const updatedResult = {
            ...prevResult,
            recommendations: recommendations
          };

          // Save recommendations to database (without awaiting)
          if (prevResult.analysisId) {
            saveRecommendations(prevResult.analysisId, recommendations).catch(err => {
              console.error('Failed to save recommendations:', err);
            });
          }

          return updatedResult;
        });

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

        return currentUri;
      });
    }
  }, [analysisResult, isGeneratingRecommendations, hasGeneratedRecommendations, capturedPhotoBase64, userProfile]);

  // Handle regenerating recommendations (reruns search-products-2)
  const handleRegenerateRecommendations = useCallback(async () => {
    if (!analysisResult || !analysisResult.isValidPhoto || isGeneratingRecommendations) {
      return;
    }

    setIsGeneratingRecommendations(true);

    // Create abort controller for this recommendation request
    const abortController = new AbortController();
    recommendationsAbortControllerRef.current = abortController;

    try {
      console.log('Regenerating recommendations...');

      // Call Supabase edge function for product search
      const { data, error } = await supabase.functions.invoke('search-products-2', {
        body: {
          base64Image: capturedPhotoBase64,
          userProfile: userProfile
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to regenerate recommendations');
      }

      if (!data || !data.products) {
        throw new Error('No recommendations returned');
      }

      const recommendations = data.products;

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

        // Photo still exists, update analysis result with new recommendations
        setAnalysisResult(prevResult => {
          const updatedResult = {
            ...prevResult,
            recommendations: recommendations
          };

          // Save recommendations to database (without awaiting)
          if (prevResult.analysisId) {
            saveRecommendations(prevResult.analysisId, recommendations).catch(err => {
              console.error('Failed to save recommendations:', err);
            });
          }

          return updatedResult;
        });

        setFavoriteItems(new Map());

        // Increment regenerate count
        setRegenerateCount(prev => prev + 1);
        setIsGeneratingRecommendations(false);

        return currentUri;
      });
    } catch (error) {
      console.error('Failed to regenerate recommendations:', error);

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

        return currentUri;
      });
    }
  }, [analysisResult, isGeneratingRecommendations, capturedPhotoBase64, userProfile]);

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

        // First, upload photo to Supabase Storage
        const { url: photoUrl } = await uploadPhoto(photo.base64, 'outfit-photos');
        console.log('Photo uploaded to:', photoUrl);

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
            // Valid photo, save analysis to database (without awaiting)
            saveOutfitAnalysis(result.analysis, photoUrl).then(analysisId => {
              // Update result with analysisId for later use (recommendations)
              setAnalysisResult(prevResult => ({
                ...prevResult,
                analysisId: analysisId
              }));
            }).catch(err => {
              console.error('Failed to save outfit analysis:', err);
            });

            // Show results immediately
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

  // Handle picking image from gallery
  const handlePickImage = async () => {
    if (isProcessingCapture) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        base64: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const photo = result.assets[0];
      console.log('Image picked:', photo.uri);

      setIsProcessingCapture(true);
      setCapturedPhotoUri(photo.uri);
      setCapturedPhotoBase64(photo.base64);

      setIsAnalyzing(true);
      setAnalysisResult(null);
      bottomSheetRef.current?.snapToIndex(0);

      const abortController = new AbortController();
      analysisAbortControllerRef.current = abortController;

      try {
        console.log('Starting outfit analysis...');

        const { url: photoUrl } = await uploadPhoto(photo.base64, 'outfit-photos');
        console.log('Photo uploaded to:', photoUrl);

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

        const analysisData = { analysis: data };
        console.log('Analysis complete:', analysisData);

        if (analysisAbortControllerRef.current === abortController) {
          analysisAbortControllerRef.current = null;
        }

        setCapturedPhotoUri(currentUri => {
          if (!currentUri) {
            setIsAnalyzing(false);
            setIsProcessingCapture(false);
            return currentUri;
          }

          if (analysisData.isValidPhoto === false) {
            setIsAnalyzing(false);
            setIsProcessingCapture(false);
            bottomSheetRef.current?.close();
            setTimeout(() => {
              setAnalysisResult(null);
              setCapturedPhotoUri(null);
            }, 500);
          } else {
            saveOutfitAnalysis(analysisData.analysis, photoUrl).then(analysisId => {
              setAnalysisResult(prevResult => ({
                ...prevResult,
                analysisId: analysisId
              }));
            }).catch(err => {
              console.error('Failed to save outfit analysis:', err);
            });

            setAnalysisResult({ ...analysisData.analysis });
            setIsAnalyzing(false);
            setIsProcessingCapture(false);
          }

          return currentUri;
        });

      } catch (analysisError) {
        console.error('Analysis failed:', analysisError);

        if (analysisAbortControllerRef.current === abortController) {
          analysisAbortControllerRef.current = null;
        }

        if (analysisError.name === 'AbortError') {
          setIsAnalyzing(false);
          setIsProcessingCapture(false);
          return;
        }

        setCapturedPhotoUri(currentUri => {
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

    } catch (error) {
      console.error('Error picking image:', error);
      setIsProcessingCapture(false);
    }
  };

  // Load user profile for personalization
  const loadUserProfile = async () => {
    try {
      const profile = await getProfile();
      setUserProfile(profile);
      console.log('User profile loaded for personalization:', profile);
    } catch (error) {
      console.error('Error loading user profile:', error);
      // Continue without profile - recommendations will work but won't be personalized
    }
  };

  useEffect(() => {
    RNStatusBar.setHidden(true, 'none');

    // Load user profile
    loadUserProfile();

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
      if (videoGenerationAbortControllerRef.current) {
        videoGenerationAbortControllerRef.current.abort();
      }

      // Reset all state when screen unmounts
      // This handles cleanup for all navigation
      setCapturedPhotoUri(null);
      setCapturedPhotoBase64(null);
      setTryOnResultStoragePath(null);
      setAnalysisResult(null);
      setIsAnalyzing(false);
      setHasGeneratedRecommendations(false);
      setIsGeneratingRecommendations(false);
      setRegenerateCount(0);
      setFavoriteItems(new Map());
      setShowTryOnModal(false);
      setSelectedTryOnItem(null);
      setShowTryOnResult(false);
      setTryOnResultImage(null);
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
            {/* Top overlay icons - hide during processing */}
            {!isProcessingCapture && (
              <View style={styles.imageOverlayIcons}>
                {/* X icon - top left */}
                <TouchableOpacity
                  style={styles.overlayIconButton}
                  activeOpacity={0.7}
                  onPress={handleClose}
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
              facing="back"
              ref={cameraRef}
              enableTorch={torchEnabled}
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
          <View style={styles.captureButtonContainer}>
            {/* Gallery icon - left */}
            <TouchableOpacity
              onPress={handlePickImage}
              activeOpacity={0.7}
            >
              <Ionicons name="images-outline" size={28} color="#fff" />
            </TouchableOpacity>

            {/* Main Button */}
            <Animated.View style={[styles.captureButton, buttonAnimatedStyle, buttonContainerStyle]}>
              <TouchableOpacity
                style={styles.captureButtonTouch}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                activeOpacity={1}
              />
            </Animated.View>

            {/* Sparkles icon - right */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setTorchEnabled(prev => !prev)}
            >
              <Ionicons name="sparkles" size={28} color={torchEnabled ? "#FFD60A" : "#fff"} />
            </TouchableOpacity>
          </View>
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
              enableHandlePanningGesture={!showTryOnModal}
              enableContentPanningGesture={!showTryOnModal}
              backgroundStyle={styles.bottomSheetBackground}
              handleIndicatorStyle={styles.bottomSheetIndicator}
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
                  {isEditingTitle ? (
                    <View style={styles.editTitleRow}>
                      <TextInput
                        style={styles.editTitleInput}
                        onChangeText={setEditedTitle}
                        value={editedTitle}
                        maxLength={30}
                        autoFocus
                      />
                      <TouchableOpacity onPress={handleConfirmEdit} style={styles.editTitleButton}>
                        <Ionicons name="checkmark-circle" size={26} color="#34C759" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handleCancelEdit} style={styles.editTitleButton}>
                        <Ionicons name="close-circle" size={26} color="#FF3B30" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.outfitNameRow}>
                      <Text style={styles.outfitName}>{analysisResult.outfitName}</Text>
                      {analysisResult.isValidPhoto && !hasGeneratedRecommendations && !isGeneratingRecommendations && (
                        <TouchableOpacity
                          onPress={() => {
                            setEditedTitle(analysisResult.outfitName);
                            setIsEditingTitle(true);
                          }}
                          style={styles.editTitleButton}
                        >
                          <Ionicons name="pencil" size={18} color="#888" />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
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
                    analysisResult.recommendations.map((item, index) => {
                      const itemId = `${analysisResult.outfitName}-${index}`;
                      const isFavorite = favoriteItems.has(itemId);
                      return (
                        <TouchableOpacity
                          key={`rec-${index}`}
                          style={[styles.recommendationCard, { marginBottom: 18 }]}
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
                              onPress={() => handleToggleFavorite(item, itemId)}
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
                            <Text style={styles.recommendationBrand} numberOfLines={1}>{item.brand}</Text>
                            <Text style={styles.recommendationDescription} numberOfLines={2}>
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
                      style={[styles.generateButton, isGeneratingRecommendations && styles.generateButtonDisabled]}
                      onPress={handleGenerateRecommendations}
                      disabled={isGeneratingRecommendations}
                      activeOpacity={0.7}
                    >
                      {isGeneratingRecommendations ? (
                        <>
                          <ActivityIndicator size="small" color="#fff" style={styles.buttonLoader} />
                          <Text style={styles.generateButtonText} numberOfLines={1}>Fetching Recommendations</Text>
                        </>
                      ) : (
                        <>
                          <Ionicons name="sparkles" size={20} color="#fff" style={styles.buttonIcon} />
                          <Text style={styles.generateButtonText} numberOfLines={1}>Generate Recommendations</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* Regenerate Button - Shows after recommendations generated, hides after first regeneration */}
                {hasGeneratedRecommendations && regenerateCount < 1 && (
                  <View style={{ paddingBottom: insets.bottom + 12 }}>
                    <TouchableOpacity
                      style={[styles.generateButton, isGeneratingRecommendations && styles.generateButtonDisabled]}
                      onPress={handleRegenerateRecommendations}
                      disabled={isGeneratingRecommendations}
                      activeOpacity={0.7}
                    >
                      {isGeneratingRecommendations ? (
                        <>
                          <ActivityIndicator size="small" color="#fff" style={styles.buttonLoader} />
                          <Text style={styles.generateButtonText}>Regenerating...</Text>
                        </>
                      ) : (
                        <>
                          <Ionicons name="sparkles" size={20} color="#fff" style={styles.buttonIcon} />
                          <Text style={styles.generateButtonText}>Regenerate</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {hasGeneratedRecommendations && regenerateCount >= 1 && (
                  <View style={{ paddingBottom: insets.bottom + 12 }} />
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

        {/* Try-On Result Overlay - Full screen overlay with result image or video */}
        {showTryOnResult && tryOnResultImage && (
          <View style={styles.tryOnResultOverlay}>
            <Image
              source={{ uri: tryOnResultImage }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
            {generatedVideoUrl && isVideoVisible && (
              <VideoView
                style={StyleSheet.absoluteFillObject}
                nativeControls={false}
                player={videoPlayer}
                contentFit="cover"
              />
            )}
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

              {/* Play/Pause icon - top right */}
              <TouchableOpacity
                style={[styles.overlayIconButton, isGeneratingVideo && styles.overlayIconButtonDisabled]}
                onPress={generatedVideoUrl ? handleToggleVideoPlayback : handleGenerateVideo}
                disabled={isGeneratingVideo}
                activeOpacity={0.7}
              >
                {isGeneratingVideo ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : generatedVideoUrl ? (
                  <Ionicons name={isVideoPlaying ? 'pause' : 'play'} size={28} color="#fff" />
                ) : (
                  <Ionicons name="play" size={28} color="#fff" />
                )}
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
    backgroundColor: '#3a3b3c',
  },
  captureButtonContainer: {
    position: 'absolute',
    bottom: 70,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
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
  outfitNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  outfitName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3a3b3c',
    flexShrink: 1,
  },
  editTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  editTitleInput: {
    flex: 1,
    fontSize: 20,
    color: '#3a3b3c',
    fontWeight: 'bold',
    borderBottomWidth: 1,
    borderBottomColor: '#007AFF',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  editTitleButton: {
    marginLeft: 8,
    padding: 2,
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
    fontWeight: '500',
    color: '#3a3b3c',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#3a3b3c',
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
    fontWeight: '500',
    color: '#3a3b3c',
  },
  modalButtonTextOk: {
    fontSize: 14,
    fontWeight: '500',
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
    fontWeight: '500',
    color: '#3a3b3c',
    marginTop: 16,
  },
  // Try-On Result Overlay styles
  tryOnResultOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#3a3b3c',
    zIndex: 10001,
    elevation: 10001,
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
  overlayIconButtonDisabled: {
    opacity: 1,
  },
});