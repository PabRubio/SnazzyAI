import { Ionicons } from "@expo/vector-icons";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useEventListener } from "expo";
import { BlurView } from "expo-blur";
import { CameraView } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useVideoPlayer, VideoView } from "expo-video";
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
  addFavorite,
  getProfile,
  removeFavorite,
  saveOutfitAnalysis,
  saveRecommendations,
  saveTryOnResult,
  uploadPhoto,
} from "../../supabase/services/supabaseHelpers";
import Text from "../components/typography/Text";
import TextInput from "../components/typography/TextInput";

const { height, width } = Dimensions.get("window");
const BUTTON_SIZE = 60;

const safeHaptic = async (hapticFunction) => {
  try {
    await hapticFunction();
  } catch {
    // Haptic feedback is optional and may be unavailable on some devices.
  }
};

export default function CameraScreen({ navigation }) {
  const [, setIsCapturing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [capturedPhotoUri, setCapturedPhotoUri] = useState(null);
  const [capturedPhotoBase64, setCapturedPhotoBase64] = useState(null);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isGeneratingRecommendations, setIsGeneratingRecommendations] =
    useState(false);
  const [hasGeneratedRecommendations, setHasGeneratedRecommendations] =
    useState(false);
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
  const [editedTitle, setEditedTitle] = useState("");

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

  const bottomSheetRef = useRef(null);
  const snapPoints = useMemo(() => ["25%", "85%"], []);

  const videoPlayer = useVideoPlayer(generatedVideoUrl, (player) => {
    player.loop = false;
    player.play();
  });

  useEventListener(videoPlayer, "playToEnd", () => {
    setIsVideoPlaying(false);
    setIsVideoVisible(false);
    videoPlayer.pause();
  });

  const handleOpenPurchaseUrl = useCallback(async (url) => {
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
      Alert.alert("Error", "Unable to open the link. Please try again later.", [
        { text: "OK" },
      ]);
    }
  }, []);

  const handleToggleFavorite = useCallback(
    async (item, itemId) => {
      const isFavorite = favoriteItems.has(itemId);
      const favoriteId = favoriteItems.get(itemId);

      // Optimistically update UI
      setFavoriteItems((prevFavorites) => {
        const newFavorites = new Map(prevFavorites);
        if (isFavorite) {
          newFavorites.delete(itemId);
        } else {
          // Use a placeholder until the insert returns the favorite ID.
          newFavorites.set(itemId, "pending");
        }
        return newFavorites;
      });

      try {
        if (isFavorite) {
          await removeFavorite(favoriteId);
        } else {
          const newFavoriteId = await addFavorite({
            brand: item.brand,
            category: item.category || "other",
            description: item.description,
            imageUrl: item.imageUrl,
            name: item.name,
            price: item.price,
            purchaseUrl: item.purchaseUrl,
          });
          setFavoriteItems((prevFavorites) => {
            const newFavorites = new Map(prevFavorites);
            newFavorites.set(itemId, newFavoriteId);
            return newFavorites;
          });
        }
      } catch {
        // Revert optimistic update on error
        setFavoriteItems((prevFavorites) => {
          const newFavorites = new Map(prevFavorites);
          if (isFavorite) {
            newFavorites.set(itemId, favoriteId);
          } else {
            newFavorites.delete(itemId);
          }
          return newFavorites;
        });
        Alert.alert("Error", "Failed to update favorite");
      }
    },
    [favoriteItems],
  );

  const handleLongPressRecommendation = useCallback(async (item) => {
    await safeHaptic(() =>
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
    );
    setSelectedTryOnItem(item);
    setShowTryOnModal(true);
  }, []);

  const handleTryOnOk = useCallback(async () => {
    setShowTryOnModal(false);
    const currentItem = selectedTryOnItem;
    setSelectedTryOnItem(null);

    setShowLoadingScreen(true);

    const abortController = new AbortController();
    tryOnAbortControllerRef.current = abortController;

    try {
      const { data, error } = await supabase.functions.invoke(
        "virtual-try-on",
        {
          body: {
            clothingImageUrl: currentItem.imageUrl,
            userPhotoBase64: capturedPhotoBase64,
          },
        },
      );

      if (error) {
        throw new Error(error.message || "Virtual try-on failed");
      }

      if (!data || !data.base64) {
        throw new Error("No image returned from virtual try-on");
      }

      if (tryOnAbortControllerRef.current === abortController) {
        tryOnAbortControllerRef.current = null;
      }

      // Upload result image to storage once (while loading screen is still showing)
      const { path: resultStoragePath, url: resultImageUrl } =
        await uploadPhoto(data.base64, "try-on-results");
      setTryOnResultStoragePath(resultStoragePath);

      // Persist the result without delaying the result overlay.
      saveTryOnResult(
        capturedPhotoUri,
        currentItem.imageUrl,
        resultImageUrl,
      ).catch(() => undefined);

      setTryOnResultImage(data.dataUri);
      setShowLoadingScreen(false);
      setShowTryOnResult(true);
    } catch (error) {
      if (tryOnAbortControllerRef.current === abortController) {
        tryOnAbortControllerRef.current = null;
      }

      setShowLoadingScreen(false);

      if (error.name === "AbortError") {
        return;
      }
    }
  }, [capturedPhotoBase64, selectedTryOnItem]);

  const handleTryOnCancel = useCallback(async () => {
    setShowTryOnModal(false);
    setSelectedTryOnItem(null);
  }, []);

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

  const handleGenerateVideo = useCallback(async () => {
    if (!tryOnResultStoragePath || isGeneratingVideo) return;

    setIsGeneratingVideo(true);

    const abortController = new AbortController();
    videoGenerationAbortControllerRef.current = abortController;

    try {
      const { data, error } = await supabase.functions.invoke(
        "generate-video",
        {
          body: {
            imagePath: tryOnResultStoragePath,
          },
        },
      );

      if (error) {
        throw new Error(error.message || "Video generation failed");
      }

      if (!data || !data.videoUrl) {
        throw new Error("No video URL returned");
      }

      if (videoGenerationAbortControllerRef.current === abortController) {
        videoGenerationAbortControllerRef.current = null;
      }

      setGeneratedVideoUrl(data.videoUrl);
      setIsVideoVisible(true);
      setIsVideoPlaying(true);
    } catch (error) {
      if (videoGenerationAbortControllerRef.current === abortController) {
        videoGenerationAbortControllerRef.current = null;
      }

      if (error.name === "AbortError") {
        setIsGeneratingVideo(false);
        return;
      }

      Alert.alert(
        "Video Generation Failed",
        "Unable to generate video. Please try again.",
        [{ text: "OK" }],
      );
    } finally {
      setIsGeneratingVideo(false);
    }
  }, [tryOnResultStoragePath, isGeneratingVideo]);

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

    bottomSheetRef.current?.close();

    // Let the bottom sheet finish closing before navigation unmounts the screen.
    setTimeout(() => {
      navigation.goBack();
    }, 250);
  }, [navigation]);

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

    bottomSheetRef.current?.close();

    // Keep the reset aligned with the bottom sheet's closing animation.
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
      setTorchEnabled(false);
      setEditedTitle("");
    }, 250);
  }, []);

  const handleConfirmEdit = useCallback(() => {
    const normalizedTitle = editedTitle.trim().replace(/\s+/g, " ");
    if (
      !normalizedTitle ||
      !/^[a-zA-Z\s]+$/.test(normalizedTitle) ||
      normalizedTitle.length > 30
    ) {
      Alert.alert(
        "Invalid Name",
        "Name must be 1-30 characters and contain only letters and spaces.",
      );
      setIsEditingTitle(false);
      return;
    }
    setAnalysisResult((previousResult) => ({
      ...previousResult,
      outfitName: normalizedTitle,
    }));
    setIsEditingTitle(false);

    if (analysisResult?.analysisId) {
      // Attaching a handler executes this non-blocking Supabase thenable.
      supabase
        .from("outfit_analyses")
        .update({ outfit_name: normalizedTitle })
        .eq("id", analysisResult.analysisId)
        .then(({ error }) => void error);
    }
  }, [editedTitle, analysisResult?.analysisId]);

  const handleCancelEdit = useCallback(() => {
    setIsEditingTitle(false);
  }, []);

  const handleGenerateRecommendations = useCallback(async () => {
    if (
      !analysisResult ||
      !analysisResult.isValidPhoto ||
      isGeneratingRecommendations ||
      hasGeneratedRecommendations
    ) {
      return;
    }

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
              userProfile,
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
          newProducts.forEach((item) => accumulatedProducts.push(item));
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

      // Apply results only while the captured photo is still present.
      setCapturedPhotoUri((currentUri) => {
        if (!currentUri) {
          setIsGeneratingRecommendations(false);
          return currentUri;
        }

        setAnalysisResult((prevResult) => {
          const updatedResult = {
            ...prevResult,
            recommendations,
          };

          // Save recommendations to database (without awaiting)
          if (prevResult.analysisId) {
            saveRecommendations(prevResult.analysisId, recommendations).catch(
              () => undefined,
            );
          }

          return updatedResult;
        });

        setHasGeneratedRecommendations(true);
        setIsGeneratingRecommendations(false);

        return currentUri;
      });
    } catch (error) {
      if (recommendationsAbortControllerRef.current === abortController) {
        recommendationsAbortControllerRef.current = null;
      }

      if (error.name === "AbortError") {
        setIsGeneratingRecommendations(false);
        return;
      }

      // Do not restore state after refresh has cleared the photo.
      setCapturedPhotoUri((currentUri) => {
        if (!currentUri) {
          setIsGeneratingRecommendations(false);
          return currentUri;
        }

        setIsGeneratingRecommendations(false);

        return currentUri;
      });
    }
  }, [
    analysisResult,
    isGeneratingRecommendations,
    hasGeneratedRecommendations,
    capturedPhotoBase64,
    userProfile,
  ]);

  const handleRegenerateRecommendations = useCallback(async () => {
    if (
      !analysisResult ||
      !analysisResult.isValidPhoto ||
      isGeneratingRecommendations
    ) {
      return;
    }

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
              userProfile,
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
          newProducts.forEach((item) => accumulatedProducts.push(item));
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

      // Apply results only while the captured photo is still present.
      setCapturedPhotoUri((currentUri) => {
        if (!currentUri) {
          setIsGeneratingRecommendations(false);
          return currentUri;
        }

        setAnalysisResult((prevResult) => {
          const updatedResult = {
            ...prevResult,
            recommendations,
          };

          // Save recommendations to database (without awaiting)
          if (prevResult.analysisId) {
            saveRecommendations(prevResult.analysisId, recommendations).catch(
              () => undefined,
            );
          }

          return updatedResult;
        });

        setFavoriteItems(new Map());

        setRegenerateCount((previousCount) => previousCount + 1);
        setIsGeneratingRecommendations(false);

        return currentUri;
      });
    } catch (error) {
      if (recommendationsAbortControllerRef.current === abortController) {
        recommendationsAbortControllerRef.current = null;
      }

      if (error.name === "AbortError") {
        setIsGeneratingRecommendations(false);
        return;
      }

      // Do not restore state after refresh has cleared the photo.
      setCapturedPhotoUri((currentUri) => {
        if (!currentUri) {
          setIsGeneratingRecommendations(false);
          return currentUri;
        }

        setIsGeneratingRecommendations(false);

        return currentUri;
      });
    }
  }, [
    analysisResult,
    isGeneratingRecommendations,
    capturedPhotoBase64,
    userProfile,
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
    }

    buttonScale.value = withTiming(1, { duration: 100 });
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
      bottomSheetRef.current?.snapToIndex(0); // Snap to collapsed state (25%)

      const abortController = new AbortController();
      analysisAbortControllerRef.current = abortController;

      try {
        const { url: photoUrl } = await uploadPhoto(
          photo.base64,
          "outfit-photos",
        );

        const { data, error } = await supabase.functions.invoke(
          "analyze-outfit",
          {
            body: {
              base64Image: photo.base64,
              userProfile,
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

        // Apply results only while the captured photo is still present.
        setCapturedPhotoUri((currentUri) => {
          if (!currentUri) {
            setIsAnalyzing(false);
            setIsProcessingCapture(false);
            return currentUri;
          }

          if (result.isValidPhoto === false) {
            setIsAnalyzing(false);
            setIsProcessingCapture(false);
            bottomSheetRef.current?.close();
            setTimeout(() => {
              setAnalysisResult(null);
              setCapturedPhotoUri(null);
            }, 500);
          } else {
            // Saving is intentionally non-blocking so results render immediately.
            saveOutfitAnalysis(result.analysis, photoUrl)
              .then((analysisId) => {
                setAnalysisResult((prevResult) => ({
                  ...prevResult,
                  analysisId,
                }));
              })
              .catch(() => undefined);

            setAnalysisResult({ ...result.analysis });
            setIsProcessingCapture(false);
            setIsAnalyzing(false);
          }

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

        // Do not restore state after refresh has cleared the photo.
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
        const { url: photoUrl } = await uploadPhoto(
          photo.base64,
          "outfit-photos",
        );

        const { data, error } = await supabase.functions.invoke(
          "analyze-outfit",
          {
            body: {
              base64Image: photo.base64,
              userProfile,
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

          if (analysisData.isValidPhoto === false) {
            setIsAnalyzing(false);
            setIsProcessingCapture(false);
            bottomSheetRef.current?.close();
            setTimeout(() => {
              setAnalysisResult(null);
              setCapturedPhotoUri(null);
            }, 500);
          } else {
            saveOutfitAnalysis(analysisData.analysis, photoUrl)
              .then((analysisId) => {
                setAnalysisResult((prevResult) => ({
                  ...prevResult,
                  analysisId,
                }));
              })
              .catch(() => undefined);

            setAnalysisResult({ ...analysisData.analysis });
            setIsProcessingCapture(false);
            setIsAnalyzing(false);
          }

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
          setIsProcessingCapture(false);

          setTimeout(() => {
            setAnalysisResult(null);
            setCapturedPhotoUri(null);
          }, 500);

          return currentUri;
        });
      }
    } catch {
      setIsProcessingCapture(false);
    }
  };

  const loadUserProfile = async () => {
    try {
      const profile = await getProfile();
      setUserProfile(profile);
    } catch {
      // Recommendations can continue without profile personalization.
    }
  };

  useEffect(() => {
    RNStatusBar.setHidden(true, "none");

    loadUserProfile();

    return () => {
      if (captureTimerRef.current) {
        clearTimeout(captureTimerRef.current);
      }
      if (delayedCaptureRef.current) {
        clearTimeout(delayedCaptureRef.current);
      }
      if (hapticIntervalRef.current) {
        clearInterval(hapticIntervalRef.current);
      }

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

  const placeholderPaddingBottom = analysisResult?.isValidPhoto
    ? 15
    : insets.bottom + 12;

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
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleClose}
                  style={styles.overlayIconButton}
                >
                  <Ionicons color="#fff" name="close" size={28} />
                </TouchableOpacity>

                <Text style={styles.overlayTitle}>Snazzy AI</Text>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleRefresh}
                  style={styles.overlayIconButton}
                >
                  <Ionicons color="#fff" name="refresh" size={28} />
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : (
          <>
            <CameraView
              enableTorch={torchEnabled}
              faceDetectorSettings={{
                mode: "none",
              }}
              facing="back"
              onCameraReady={() => {
                // Add a small delay to ensure camera is fully initialized
                setTimeout(() => {
                  setIsCameraReady(true);
                }, 500);
              }}
              ref={cameraRef}
              style={StyleSheet.absoluteFillObject}
            />
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
            enableContentPanningGesture={!showTryOnModal}
            enableDynamicSizing={false}
            enableHandlePanningGesture={!showTryOnModal}
            enableOverDrag={false}
            enablePanDownToClose={false}
            handleIndicatorStyle={styles.bottomSheetIndicator}
            index={0}
            maxDynamicContentSize={height * 0.85}
            ref={bottomSheetRef}
            snapPoints={snapPoints}
          >
            <BottomSheetScrollView
              contentContainerStyle={styles.bottomSheetContent}
              scrollEnabled={!showTryOnModal}
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
                    {isEditingTitle ? (
                      <View style={styles.editTitleRow}>
                        <TextInput
                          autoFocus
                          maxLength={30}
                          onChangeText={setEditedTitle}
                          style={styles.editTitleInput}
                          value={editedTitle}
                        />
                        <TouchableOpacity
                          onPress={handleConfirmEdit}
                          style={styles.editTitleButton}
                        >
                          <Ionicons
                            color="#34C759"
                            name="checkmark-circle"
                            size={26}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={handleCancelEdit}
                          style={styles.editTitleButton}
                        >
                          <Ionicons
                            color="#FF3B30"
                            name="close-circle"
                            size={26}
                          />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.outfitNameRow}>
                        <Text style={styles.outfitName}>
                          {analysisResult.outfitName}
                        </Text>
                        {analysisResult.isValidPhoto &&
                          !hasGeneratedRecommendations &&
                          !isGeneratingRecommendations && (
                            <TouchableOpacity
                              onPress={() => {
                                setEditedTitle(analysisResult.outfitName);
                                setIsEditingTitle(true);
                              }}
                              style={styles.editTitleButton}
                            >
                              <Ionicons color="#888" name="pencil" size={18} />
                            </TouchableOpacity>
                          )}
                      </View>
                    )}
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
                      ? analysisResult.recommendations.map((item, index) => {
                          const itemId = `${analysisResult.outfitName}-${index}`;
                          const isFavorite = favoriteItems.has(itemId);
                          return (
                            <TouchableOpacity
                              activeOpacity={0.8}
                              delayLongPress={1000}
                              key={`rec-${index}`}
                              onLongPress={() =>
                                handleLongPressRecommendation(item)
                              }
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
                                  onPress={() =>
                                    handleToggleFavorite(item, itemId)
                                  }
                                  style={styles.heartButton}
                                >
                                  <Ionicons
                                    color={isFavorite ? "#FF3B30" : "#999"}
                                    name={
                                      isFavorite ? "heart" : "heart-outline"
                                    }
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
                          );
                        })
                      : /* Show placeholder when no recommendations generated yet */
                        !hasGeneratedRecommendations && (
                          <View
                            style={[
                              styles.placeholderContainer,
                              { paddingBottom: placeholderPaddingBottom },
                            ]}
                          >
                            <Ionicons
                              color="#ccc"
                              name="shirt-outline"
                              size={48}
                            />
                            <Text style={styles.placeholderText}>
                              Nothing to see here yet ;)
                            </Text>
                          </View>
                        )}
                  </View>

                  {!hasGeneratedRecommendations &&
                    analysisResult.isValidPhoto && (
                      <View style={{ paddingBottom: insets.bottom + 12 }}>
                        <TouchableOpacity
                          activeOpacity={0.7}
                          disabled={isGeneratingRecommendations}
                          onPress={handleGenerateRecommendations}
                          style={[
                            styles.generateButton,
                            isGeneratingRecommendations &&
                              styles.generateButtonDisabled,
                          ]}
                        >
                          {isGeneratingRecommendations ? (
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
                          ) : (
                            <>
                              <Ionicons
                                color="#fff"
                                name="sparkles"
                                size={20}
                                style={styles.buttonIcon}
                              />
                              <Text
                                numberOfLines={1}
                                style={styles.generateButtonText}
                              >
                                Generate Recommendations
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}

                  {hasGeneratedRecommendations && regenerateCount < 1 && (
                    <View style={{ paddingBottom: insets.bottom + 12 }}>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        disabled={isGeneratingRecommendations}
                        onPress={handleRegenerateRecommendations}
                        style={[
                          styles.generateButton,
                          isGeneratingRecommendations &&
                            styles.generateButtonDisabled,
                        ]}
                      >
                        {isGeneratingRecommendations ? (
                          <>
                            <ActivityIndicator
                              color="#fff"
                              size="small"
                              style={styles.buttonLoader}
                            />
                            <Text style={styles.generateButtonText}>
                              Regenerating...
                            </Text>
                          </>
                        ) : (
                          <>
                            <Ionicons
                              color="#fff"
                              name="sparkles"
                              size={20}
                              style={styles.buttonIcon}
                            />
                            <Text style={styles.generateButtonText}>
                              Regenerate
                            </Text>
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
              style={StyleSheet.absoluteFillObject}
              tint="dark"
            >
              <TouchableOpacity
                activeOpacity={1}
                style={StyleSheet.absoluteFillObject}
              />
            </BlurView>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Try-On feature (BETA)</Text>
              <Text style={styles.modalSubtitle}>
                See how this item looks on you using AI technology ✨
              </Text>
              <View style={styles.modalButtonsContainer}>
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleTryOnCancel}
                    style={[styles.modalButton, styles.modalButtonCancel]}
                  >
                    <Text style={styles.modalButtonTextCancel}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleTryOnOk}
                    style={[styles.modalButton, styles.modalButtonOk]}
                  >
                    <Text style={styles.modalButtonTextOk}>OK</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}

        {showLoadingScreen && (
          <View style={styles.loadingScreenOverlay}>
            <ActivityIndicator color="#007AFF" size="large" />
            <Text style={styles.loadingScreenText}>Loading...</Text>
          </View>
        )}

        {showTryOnResult && tryOnResultImage && (
          <View style={styles.tryOnResultOverlay}>
            <Image
              resizeMode="cover"
              source={{ uri: tryOnResultImage }}
              style={StyleSheet.absoluteFillObject}
            />
            {generatedVideoUrl && isVideoVisible && (
              <VideoView
                contentFit="cover"
                nativeControls={false}
                player={videoPlayer}
                style={StyleSheet.absoluteFillObject}
              />
            )}
            <View style={styles.imageOverlayIcons}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleCloseTryOnResult}
                style={styles.overlayIconButton}
              >
                <Ionicons color="#fff" name="arrow-back" size={28} />
              </TouchableOpacity>

              <Text style={styles.overlayTitle}>Snazzy AI</Text>

              <TouchableOpacity
                activeOpacity={0.7}
                disabled={isGeneratingVideo}
                onPress={
                  generatedVideoUrl
                    ? handleToggleVideoPlayback
                    : handleGenerateVideo
                }
                style={[
                  styles.overlayIconButton,
                  isGeneratingVideo && styles.overlayIconButtonDisabled,
                ]}
              >
                {isGeneratingVideo ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : generatedVideoUrl ? (
                  <Ionicons
                    color="#fff"
                    name={isVideoPlaying ? "pause" : "play"}
                    size={28}
                  />
                ) : (
                  <Ionicons color="#fff" name="play" size={28} />
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
  editTitleButton: {
    marginLeft: 8,
    padding: 2,
  },
  editTitleInput: {
    borderBottomColor: "#007AFF",
    borderBottomWidth: 1,
    color: "#3a3b3c",
    flex: 1,
    fontSize: 20,
    fontWeight: "bold",
    height: 28,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  editTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 8,
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
    justifyContent: "space-between",
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
  loadingScreenOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "#fff",
    elevation: 10000,
    justifyContent: "center",
    zIndex: 10000,
  },
  loadingScreenText: {
    color: "#3a3b3c",
    fontSize: 18,
    fontWeight: "500",
    marginTop: 16,
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
  modalButton: {
    alignItems: "center",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  modalButtonCancel: {
    backgroundColor: "#f0f0f0",
  },
  modalButtonOk: {
    backgroundColor: "#007AFF",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 8,
  },
  modalButtonsContainer: {
    alignItems: "flex-end",
    flex: 1,
    justifyContent: "flex-end",
  },
  modalButtonTextCancel: {
    color: "#3a3b3c",
    fontSize: 14,
    fontWeight: "500",
  },
  modalButtonTextOk: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    elevation: 8,
    maxWidth: 520,
    minHeight: 200,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    width: width * 0.9,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    elevation: 9999,
    justifyContent: "center",
    zIndex: 9999,
  },
  modalSubtitle: {
    color: "#3a3b3c",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
    textAlign: "center",
  },
  modalTitle: {
    color: "#3a3b3c",
    fontSize: 18,
    fontWeight: "500",
    marginBottom: 8,
    textAlign: "center",
  },
  outfitName: {
    color: "#3a3b3c",
    flexShrink: 1,
    fontSize: 20,
    fontWeight: "bold",
  },
  outfitNameRow: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 8,
  },
  overlayIconButton: {
    alignItems: "center",
    backgroundColor: "rgba(58, 59, 60, 0.5)",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  overlayIconButtonDisabled: {
    opacity: 1,
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
  recommendationSeparator: {
    height: 12,
  },
  recommendationsList: {
    paddingBottom: 20,
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
  tryOnResultOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#3a3b3c",
    elevation: 10001,
    zIndex: 10001,
  },
});
