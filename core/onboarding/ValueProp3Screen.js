import Text from '../components/Text';
import React, { useRef, useState } from 'react';
import { Image, PanResponder, StyleSheet, View, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const [sliderBounds, setSliderBounds] = useState({ top: 0, height: 0 });
  const [sliderPosition, setSliderPosition] = useState(0);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragStartPositionRef.current = sliderPositionRef.current;
      },
      onPanResponderMove: (_, gestureState) => {
        const nextPosition = Math.min(
          Math.max(dragStartPositionRef.current + gestureState.dx, sliderMinRef.current),
          sliderMaxRef.current
        );

        sliderPositionRef.current = nextPosition;
        setSliderPosition(nextPosition);
      },
    })
  ).current;

  const handleContinue = () => {
    navigation.navigate('OnboardingTrialExplainer');
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const progress = CURRENT_STEP / TOTAL_STEPS;

  const handleComparisonLayout = (event) => {
    const { width, height } = event.nativeEvent.layout;

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
    setSliderBounds({ top: lineTop, height: lineHeight });

    if (!hasInitializedSliderRef.current) {
      const centeredPosition = imageLeft + imageWidth / 2;
      hasInitializedSliderRef.current = true;
      sliderPositionRef.current = centeredPosition;
      setSliderPosition(centeredPosition);
    } else if (sliderPositionRef.current < min || sliderPositionRef.current > max) {
      const clampedPosition = Math.min(Math.max(sliderPositionRef.current, min), max);
      sliderPositionRef.current = clampedPosition;
      setSliderPosition(clampedPosition);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header with back arrow and progress bar */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={28} color="#3a3b3c" />
          </TouchableOpacity>

          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
            </View>
          </View>
        </View>

        {/* Main content */}
        <View style={styles.content}>
          <Text style={styles.title}>{"Instant Try-On!" + " ✨"}</Text>
          <Text style={styles.subtitle}>Press and hold any recommended item to try it on with AI</Text>
          <View style={styles.imageContainer}>
            <View style={styles.comparisonFrame} onLayout={handleComparisonLayout}>
              <Image
                source={require('../../assets/onboarding/screen-4.png')}
                style={styles.comparisonImage}
                resizeMode="contain"
              />
              <View style={[styles.comparisonClip, { width: sliderPosition }]}>
                <Image
                  source={require('../../assets/onboarding/screen-3.png')}
                  style={[
                    styles.comparisonImage,
                    comparisonWidth > 0 ? { width: comparisonWidth } : null,
                  ]}
                  resizeMode="contain"
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
                      { top: sliderBounds.top, height: sliderBounds.height },
                    ]}
                  />
                  <View style={styles.sliderKnob}>
                    <Ionicons name="chevron-back" size={8} color="#fff" />
                    <Ionicons name="chevron-forward" size={8} color="#fff" />
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Bottom bar with Continue button */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
            activeOpacity={0.7}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>

      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  progressBarContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: '#f0f0f0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3a3b3c',
    letterSpacing: 0.5,
    marginBottom: 24,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  imageContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  comparisonFrame: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  comparisonImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  comparisonClip: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
  },
  sliderHandle: {
    position: 'absolute',
    bottom: 0,
    width: 32,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateX: -16 }],
  },
  sliderLine: {
    position: 'absolute',
    width: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.58)',
  },
  sliderKnob: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(58, 59, 60, 0.36)',
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  continueButton: {
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
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
});
