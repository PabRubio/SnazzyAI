import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withSequence
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const ErrorBanner = ({ message, type = 'error', visible, onDismiss, autoDismissDelay = 3500 }) => {
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);
  const dismissTimeoutRef = useRef(null);

  useEffect(() => {
    if (visible) {
      // Show banner with slide-in animation
      translateY.value = withSequence(
        withTiming(0, { duration: 300 }),
        withTiming(0, { duration: autoDismissDelay - 600 }),
        withTiming(-100, { duration: 300 })
      );
      
      opacity.value = withSequence(
        withTiming(1, { duration: 300 }),
        withTiming(1, { duration: autoDismissDelay - 600 }),
        withTiming(0, { duration: 300 })
      );

      // Auto-dismiss after delay
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
      }
      
      dismissTimeoutRef.current = setTimeout(() => {
        if (onDismiss) {
          onDismiss();
        }
      }, autoDismissDelay);
    } else {
      // Hide banner immediately
      translateY.value = withTiming(-100, { duration: 300 });
      opacity.value = withTiming(0, { duration: 300 });
    }

    return () => {
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
      }
    };
  }, [visible, autoDismissDelay, onDismiss]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
      opacity: opacity.value,
    };
  });

  const getBannerStyles = () => {
    switch (type) {
      case 'warning':
        return {
          backgroundColor: '#FF9500',
          icon: 'warning',
        };
      case 'success':
        return {
          backgroundColor: '#34C759',
          icon: 'checkmark-circle',
        };
      case 'error':
      default:
        return {
          backgroundColor: '#FF3B30',
          icon: 'close-circle',
        };
    }
  };

  const { backgroundColor, icon } = getBannerStyles();

  if (!visible) {
    return null;
  }

  return (
    <Animated.View style={[styles.container, animatedStyle, { backgroundColor }]}>
      <View style={styles.content}>
        <Ionicons name={icon} size={24} color="white" style={styles.icon} />
        <Text style={styles.message} numberOfLines={2}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 50, // Account for status bar
    paddingBottom: 16,
    paddingHorizontal: 16,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 10,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 12,
  },
  message: {
    flex: 1,
    color: 'white',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
});

export default ErrorBanner;