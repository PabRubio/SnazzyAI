import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import React, { useRef, useState } from "react";
import {
  Image,
  PanResponder,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Text from "../components/typography/Text";

const TOTAL_STEPS = 15;
const CURRENT_STEP = 14;

const SLIDER_VERTICAL_INSET = 60;
const SLIDER_HORIZONTAL_INSET = 50;

const ONBOARDING_IMAGE_ASPECT_RATIO = 1080 / 1920;

export default function ValueProp3Screen({ navigation }) {
  const insets = useSafeAreaInsets();

  const sliderMinRef = useRef(0);
  const sliderMaxRef = useRef(0);
  const sliderPositionRef = useRef(0);
  const dragStartPositionRef = useRef(0);
  const hasInitializedSliderRef = useRef(false);
  const [comparisonWidth, setComparisonWidth] = useState(0);
  const [sliderBounds, setSliderBounds] = useState({ height: 0, top: 0 });
  const [sliderPosition, setSliderPosition] = useState(0);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragStartPositionRef.current = sliderPositionRef.current;
      },
      onPanResponderMove: (_, gestureState) => {
        const nextPosition = Math.min(
          Math.max(
            dragStartPositionRef.current + gestureState.dx,
            sliderMinRef.current,
          ),
          sliderMaxRef.current,
        );

        sliderPositionRef.current = nextPosition;
        setSliderPosition(nextPosition);
      },
      onStartShouldSetPanResponder: () => true,
    }),
  ).current;

  const handleContinue = () => {
    navigation.navigate("OnboardingTrialExplainer");
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const progress = CURRENT_STEP / TOTAL_STEPS;

  const handleComparisonLayout = (event) => {
    const { height, width } = event.nativeEvent.layout;

    if (width === 0 || height === 0) {
      return;
    }

    const frameAspectRatio = width / height;
    let imageHeight = height;
    let imageWidth = width;
    let imageLeft = 0;
    let imageTop = 0;

    if (frameAspectRatio > ONBOARDING_IMAGE_ASPECT_RATIO) {
      imageWidth = height * ONBOARDING_IMAGE_ASPECT_RATIO;
      imageLeft = (width - imageWidth) / 2;
    } else {
      imageHeight = width / ONBOARDING_IMAGE_ASPECT_RATIO;
      imageTop = (height - imageHeight) / 2;
    }

    const min = imageLeft + SLIDER_HORIZONTAL_INSET;
    const max = imageLeft + imageWidth - SLIDER_HORIZONTAL_INSET;

    const lineTop = imageTop + SLIDER_VERTICAL_INSET;
    const lineHeight = Math.max(imageHeight - SLIDER_VERTICAL_INSET * 2, 0);

    setComparisonWidth(width);
    sliderMinRef.current = min;
    sliderMaxRef.current = max;
    setSliderBounds({ height: lineHeight, top: lineTop });

    if (!hasInitializedSliderRef.current) {
      const centeredPosition = imageLeft + imageWidth / 2;
      hasInitializedSliderRef.current = true;
      sliderPositionRef.current = centeredPosition;
      setSliderPosition(centeredPosition);
    } else if (
      sliderPositionRef.current < min ||
      sliderPositionRef.current > max
    ) {
      const clampedPosition = Math.min(
        Math.max(sliderPositionRef.current, min),
        max,
      );
      sliderPositionRef.current = clampedPosition;
      setSliderPosition(clampedPosition);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header with back arrow and progress bar */}
      <View style={styles.header}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleBack}
          style={styles.backButton}
        >
          <Ionicons color="#3a3b3c" name="chevron-back" size={28} />
        </TouchableOpacity>

        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarTrack}>
            <View
              style={[styles.progressBarFill, { width: `${progress * 100}%` }]}
            />
          </View>
        </View>
      </View>

      {/* Main content */}
      <View style={styles.content}>
        <Text style={styles.title}>{"Instant Try-On!" + " ✨"}</Text>
        <Text style={styles.subtitle}>
          Press and hold any recommended item to try it on with AI
        </Text>
        <View style={styles.imageContainer}>
          <View
            onLayout={handleComparisonLayout}
            style={styles.comparisonFrame}
          >
            <Image
              resizeMode="contain"
              source={require("../../assets/onboarding/screen-4.png")}
              style={styles.comparisonImage}
            />
            <View style={[styles.comparisonClip, { width: sliderPosition }]}>
              <Image
                resizeMode="contain"
                source={require("../../assets/onboarding/screen-3.png")}
                style={[
                  styles.comparisonImage,
                  comparisonWidth > 0 ? { width: comparisonWidth } : null,
                ]}
              />
            </View>
            {comparisonWidth > 0 && (
              <View
                style={[styles.sliderHandle, { left: sliderPosition }]}
                {...panResponder.panHandlers}
              >
                <View
                  style={[
                    styles.sliderLine,
                    { height: sliderBounds.height, top: sliderBounds.top },
                  ]}
                />
                <View style={styles.sliderKnob}>
                  <Ionicons color="#fff" name="chevron-back" size={8} />
                  <Ionicons color="#fff" name="chevron-forward" size={8} />
                </View>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Bottom bar with Continue button */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleContinue}
          style={styles.continueButton}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>

      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: "center",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    marginRight: 16,
    width: 44,
  },
  bottomBar: {
    backgroundColor: "#fff",
    borderTopColor: "#f0f0f0",
    borderTopWidth: 1,
    elevation: 8,
    paddingHorizontal: 20,
    paddingTop: 12,
    shadowColor: "#000",
    shadowOffset: { height: -2, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  comparisonClip: {
    bottom: 0,
    left: 0,
    overflow: "hidden",
    position: "absolute",
    top: 0,
  },
  comparisonFrame: {
    height: "100%",
    position: "relative",
    width: "100%",
  },
  comparisonImage: {
    height: "100%",
    position: "absolute",
    width: "100%",
  },
  container: {
    backgroundColor: "#fff",
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 30,
  },
  continueButton: {
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
  continueButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  imageContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    width: "100%",
  },
  progressBarContainer: {
    flex: 1,
    justifyContent: "center",
  },
  progressBarFill: {
    backgroundColor: "#007AFF",
    borderRadius: 2,
    height: "100%",
  },
  progressBarTrack: {
    backgroundColor: "#f0f0f0",
    borderRadius: 2,
    height: 4,
    overflow: "hidden",
  },
  sliderHandle: {
    alignItems: "center",
    bottom: 0,
    height: "100%",
    justifyContent: "center",
    position: "absolute",
    transform: [{ translateX: -16 }],
    width: 32,
  },
  sliderKnob: {
    alignItems: "center",
    backgroundColor: "rgba(58, 59, 60, 0.36)",
    borderRadius: 10,
    flexDirection: "row",
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  sliderLine: {
    backgroundColor: "rgba(255, 255, 255, 0.58)",
    position: "absolute",
    width: 1.5,
  },
  subtitle: {
    color: "#666",
    fontSize: 16,
  },
  title: {
    color: "#3a3b3c",
    fontSize: 32,
    fontWeight: "bold",
    letterSpacing: 0.5,
    marginBottom: 24,
  },
});
