import React, { useState, useRef, useEffect } from 'react';
import Text from '../components/Text';
import TextInput from '../components/TextInput';
import { StyleSheet, View, TouchableOpacity, Dimensions, Image, ScrollView, Alert, Keyboard, Switch, Linking, ActivityIndicator, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useCameraPermissions } from 'expo-camera';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../services/supabase';
import { useNavigation } from '../navigation/NavigationContext';
import { getProfile, updateProfile, addFavorite, removeFavorite } from '../services/supabaseHelpers';

const { width, height } = Dimensions.get('window');

// Conversion helpers
const cmToFt = (cm) => {
  if (!cm || isNaN(cm)) return null;
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  if (inches === 12) {
    return `${feet + 1}'0"`;
  }
  return `${feet}'${inches}"`;
};

const kgToLb = (kg) => {
  if (!kg || isNaN(kg)) return null;
  const lb = Math.round(kg * 2.20462);
  return `${lb} lbs`;
};

export default function HomeScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('home');
  const shirtsScrollRef = useRef(null);
  const pantsScrollRef = useRef(null);
  const shoesScrollRef = useRef(null);
  const otherScrollRef = useRef(null);
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [favoriteItems, setFavoriteItems] = useState(new Map()); // Map: itemId -> database UUID
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const { switchToAuthStack } = useNavigation();

  // Settings state - Personal Information
  const [name, setName] = useState('');
  const [birth, setBirth] = useState('');
  const [birthDate, setBirthDate] = useState(null);
  const [showBirthPicker, setShowBirthPicker] = useState(false);
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('');
  const [location, setLocation] = useState('');
  const [loadingLocation, setLoadingLocation] = useState(false);

  // Physical
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');

  // Shopping Preferences
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [shirtSize, setShirtSize] = useState('');
  const [pantsSize, setPantsSize] = useState('');
  const [shoeSize, setShoeSize] = useState('');
  const [favoriteStyles, setFavoriteStyles] = useState('');
  const [favoriteBrands, setFavoriteBrands] = useState('');

  // General Settings
  const [language, setLanguage] = useState('English');
  const [pushNotifications, setPushNotifications] = useState(true);


  // Load profile from Supabase on mount
  useEffect(() => {
    loadProfileData();
    loadFavorites();
  }, []);

  const loadProfileData = async () => {
    try {
      // Check if user is still authenticated before loading profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // User is not authenticated (likely signing out), skip loading
        return;
      }

      const profile = await getProfile();

      if (profile) {
        setName(profile.name || '');
        setEmail(profile.email || '');

        // Convert birth from YYYY-MM-DD to DD/MM/YYYY and Date object
        if (profile.birth) {
          const [year, month, day] = profile.birth.split('-');
          setBirth(`${day}/${month}/${year}`);
          setBirthDate(new Date(parseInt(year), parseInt(month) - 1, parseInt(day)));
        } else {
          setBirth('');
          setBirthDate(null);
        }

        setGender(profile.gender || '');
        setLocation(profile.location || '');
        setHeight(profile.height?.toString() || '');
        setWeight(profile.weight?.toString() || '');
        setCurrency(profile.currency || 'USD');
        setPriceMin(profile.price_min?.toString() || '');
        setPriceMax(profile.price_max?.toString() || '');
        setShirtSize(profile.shirt_size || '');
        setPantsSize(profile.pants_size || '');
        setShoeSize(profile.shoe_size || '');
        setFavoriteBrands(profile.favorite_brands?.join(', ') || '');
        setFavoriteStyles(profile.favorite_styles?.join(', ') || '');
        setLanguage(profile.language || 'English');

        // Sync notification toggle with actual permission status
        const { status } = await Notifications.getPermissionsAsync();
        const hasPermission = status === 'granted';
        setPushNotifications(hasPermission && (profile.push_notifications ?? true));
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      // Only show alert if user is still authenticated (not signing out)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        Alert.alert('Error', 'Failed to load profile data');
      }
    }
  };

  const loadFavorites = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setFavorites([]);
        return;
      }

      const { data, error } = await supabase
        .from('favorite_products')
        .select('*')
        .eq('user_id', user.id)
        .order('favorited_at', { ascending: false });

      if (error) {
        throw error;
      }

      setFavorites(data || []);

      // Initialize favoriteItems Map with all items as favorited
      const favMap = new Map();
      (data || []).forEach(item => {
        favMap.set(item.id, item.id); // Store database ID as value
      });
      setFavoriteItems(favMap);
    } catch (error) {
      console.error('Error loading favorites:', error);
      // Don't show alert for favorites - just log the error
    }
  };

  // Predefined options
  const genderOptions = ['Male', 'Female', 'Other'];
  const currencyOptions = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'];
  const languageOptions = ['English', 'Spanish'];
  const shirtSizeOptions = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const pantsSizeOptions = ['28', '30', '32', '34', '36', '38', '40', '42'];
  const shoeSizeOptions = ['6', '7', '8', '9', '10', '11', '12', '13'];

  // Birth date constraints (13-100 years old, same as onboarding)
  const maxBirthDate = new Date();
  maxBirthDate.setFullYear(maxBirthDate.getFullYear() - 13);
  const minBirthDate = new Date();
  minBirthDate.setFullYear(minBirthDate.getFullYear() - 100);

  // Format date for display (same as onboarding)
  const formatBirthDate = (date) => {
    if (!date) return '';
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  // Handle birth date change
  const handleBirthDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowBirthPicker(false);
    }
    if (selectedDate) {
      setBirthDate(selectedDate);
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const year = selectedDate.getFullYear();
      setBirth(`${day}/${month}/${year}`);
    }
  };

  const selectGender = async (selectedGender) => {
    setGender(selectedGender);
  };

  const selectCurrency = async (selectedCurrency) => {
    setCurrency(selectedCurrency);
  };

  const selectLanguage = async (selectedLanguage) => {
    setLanguage(selectedLanguage);
  };

  const selectShirtSize = async (size) => {
    setShirtSize(size);
  };

  const selectPantsSize = async (size) => {
    setPantsSize(size);
  };

  const selectShoeSize = async (size) => {
    setShoeSize(size);
  };

  // Handle notification toggle
  const handleNotificationToggle = async (value) => {
    if (value) {
      // Turning ON - set state immediately for smooth animation
      setPushNotifications(true);

      // Then check/request permission
      const { status: existingStatus } = await Notifications.getPermissionsAsync();

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          // Permission denied - revert toggle and show alert
          setPushNotifications(false);
          Alert.alert(
            'Notifications Disabled',
            'To receive reminders, please enable notifications in Settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() }
            ]
          );
        }
      }
    } else {
      // Turning OFF - just update state
      setPushNotifications(false);
    }
  };

  // Handle location update
  const handleUpdateLocation = async () => {
    setLoadingLocation(true);

    try {
      // Check/request permission
      const { status: existingStatus } = await Location.getForegroundPermissionsAsync();

      let hasPermission = existingStatus === 'granted';

      if (!hasPermission) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        hasPermission = status === 'granted';
      }

      if (!hasPermission) {
        setLoadingLocation(false);
        Alert.alert(
          'Location Access Required',
          'To auto-detect your location, please enable location permissions in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]
        );
        return;
      }

      // Get current location with 5 second timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 5000)
      );

      const locationPromise = (async () => {
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Low,
        });

        const [address] = await Location.reverseGeocodeAsync({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });

        return address;
      })();

      const address = await Promise.race([locationPromise, timeoutPromise]);

      if (address) {
        const city = address.city || address.subregion || '';
        const country = address.country || '';
        const locationString = city && country ? `${city}, ${country}` : city || country || '';
        setLocation(locationString);
      }
    } catch (error) {
      console.error('Error getting location:', error);
      if (error.message === 'timeout') {
        Alert.alert('Timeout', 'Location detection took too long. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to get location. Please try again.');
      }
    } finally {
      setLoadingLocation(false);
    }
  };

  // Handle export data
  const handleExportData = async () => {
    Alert.alert(
      'Export Data',
      'To export your data, please contact us at contact@pablorubio.com with your account email. We will process your request within 24 hours.',
      [
        { text: 'OK' }
      ]
    );
  };

  // Handle opening external links
  const handleOpenLink = async (url, title) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Error', `Unable to open ${title}`);
    }
  };

  // Handle save settings
  const handleSaveSettings = async () => {
    Keyboard.dismiss();

    try {
      setSaving(true);

      // Parse favorite styles from comma-separated string to array
      const stylesArray = favoriteStyles
        .split(',')
        .map(style => style.trim())
        .filter(style => style.length > 0);

      // Parse favorite brands from comma-separated string to array
      const brandsArray = favoriteBrands
        .split(',')
        .map(brand => brand.trim())
        .filter(brand => brand.length > 0);

      // Validate required fields
      if (!birthDate) {
        Alert.alert('Birth Date Required', 'Please select your birth date.', [{ text: 'OK' }]);
        setSaving(false);
        return;
      }

      if (!gender) {
        Alert.alert('Gender Required', 'Please select your gender.', [{ text: 'OK' }]);
        setSaving(false);
        return;
      }

      if (!location) {
        Alert.alert('Location Required', 'Please detect your location.', [{ text: 'OK' }]);
        setSaving(false);
        return;
      }

      if (!height) {
        Alert.alert('Height Required', 'Please enter your height.', [{ text: 'OK' }]);
        setSaving(false);
        return;
      }

      if (!weight) {
        Alert.alert('Weight Required', 'Please enter your weight.', [{ text: 'OK' }]);
        setSaving(false);
        return;
      }

      if (!shirtSize) {
        Alert.alert('Shirt Size Required', 'Please select your shirt size.', [{ text: 'OK' }]);
        setSaving(false);
        return;
      }

      if (!pantsSize) {
        Alert.alert('Pants Size Required', 'Please select your pants size.', [{ text: 'OK' }]);
        setSaving(false);
        return;
      }

      if (!shoeSize) {
        Alert.alert('Shoe Size Required', 'Please select your shoe size.', [{ text: 'OK' }]);
        setSaving(false);
        return;
      }

      if (stylesArray.length === 0) {
        Alert.alert('Favorite Styles Required', 'Please enter at least one favorite style.', [{ text: 'OK' }]);
        setSaving(false);
        return;
      }

      if (brandsArray.length === 0) {
        Alert.alert('Favorite Brands Required', 'Please enter at least one favorite brand.', [{ text: 'OK' }]);
        setSaving(false);
        return;
      }

      // Validate height range
      const heightVal = parseInt(height);
      if (heightVal < 150 || heightVal > 250) {
        Alert.alert(
          'Invalid Height',
          'Please enter a height between 150 and 250 cm.',
          [{ text: 'OK' }]
        );
        setSaving(false);
        return;
      }

      // Validate weight range
      const weightVal = parseInt(weight);
      if (weightVal < 50 || weightVal > 200) {
        Alert.alert(
          'Invalid Weight',
          'Please enter a weight between 50 and 200 kg.',
          [{ text: 'OK' }]
        );
        setSaving(false);
        return;
      }

      // Validate price range (required)
      if (!priceMin || !priceMax) {
        Alert.alert(
          'Price Range Required',
          'Please enter both minimum and maximum price.',
          [{ text: 'OK' }]
        );
        setSaving(false);
        return;
      }

      const minPrice = parseInt(priceMin);
      const maxPrice = parseInt(priceMax);

      if (minPrice >= maxPrice) {
        Alert.alert(
          'Invalid Price Range',
          'Minimum price must be less than maximum price.',
          [{ text: 'OK' }]
        );
        setSaving(false);
        return;
      }

      // Format birth date as YYYY-MM-DD for database
      let birthForDb = null;
      if (birthDate) {
        const year = birthDate.getFullYear();
        const month = String(birthDate.getMonth() + 1).padStart(2, '0');
        const day = String(birthDate.getDate()).padStart(2, '0');
        birthForDb = `${year}-${month}-${day}`;
      }

      await updateProfile({
        birth: birthForDb,
        gender: gender || null,
        location: location || null,
        height: height ? parseInt(height) : null,
        weight: weight ? parseFloat(weight) : null,
        currency,
        price_min: priceMin ? parseInt(priceMin) : null,
        price_max: priceMax ? parseInt(priceMax) : null,
        shirt_size: shirtSize || null,
        pants_size: pantsSize || null,
        shoe_size: shoeSize || null,
        favorite_styles: stylesArray,
        favorite_brands: brandsArray,
        language,
        push_notifications: pushNotifications,
      });

      Alert.alert(
        'Settings Saved',
        'Your preferences have been updated successfully.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Error', 'Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Handle sign out
  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.auth.signOut();
              // Manually switch to auth stack
              switchToAuthStack();
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          }
        }
      ]
    );
  };

  // Handle delete account
  const handleDeleteAccount = async () => {
    Alert.alert(
      'Delete Account',
      'To delete your account and all associated data, please contact us at contact@pablorubio.com with your account email. We will process your request within 24 hours.',
      [
        { text: 'OK' }
      ]
    );
  };

  // Reset settings to saved values (discard unsaved changes)
  const resetSettings = async () => {
    await loadProfileData();
  };

  const handleTabPress = async (tabName) => {
    // If leaving settings tab, reset unsaved changes
    if (activeTab === 'settings' && tabName !== 'settings') {
      resetSettings();
    }

    // If switching to home tab, reload favorites
    if (tabName === 'home' && activeTab !== 'home') {
      loadFavorites();
    }

    if (tabName === 'add') {
      // Check camera permission before navigating
      if (cameraPermission?.granted) {
        navigation.navigate('Camera');
      } else {
        // Request permission
        const result = await requestCameraPermission();
        if (result.granted) {
          navigation.navigate('Camera');
        } else {
          // Permission denied - show alert with Settings option
          Alert.alert(
            'Camera Access Required',
            'SnazzyAI needs camera access to analyze your outfits. Please enable camera permissions in Settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() }
            ]
          );
        }
      }
    } else {
      setActiveTab(tabName);
    }
  };

  // Handle toggling favorite (like CameraScreen)
  const handleToggleFavorite = async (item) => {
    const isFavorited = favoriteItems.has(item.id);
    const dbUuid = favoriteItems.get(item.id);

    // Optimistically update UI
    setFavoriteItems(prevFavorites => {
      const newFavorites = new Map(prevFavorites);
      if (isFavorited) {
        newFavorites.delete(item.id);
      } else {
        newFavorites.set(item.id, 'pending'); // Temporary until we get the UUID
      }
      return newFavorites;
    });

    try {
      if (isFavorited) {
        // Remove from favorites using database UUID
        await removeFavorite(dbUuid);
      } else {
        // Add back to favorites and get the database UUID
        const newDbUuid = await addFavorite({
          name: item.name,
          brand: item.brand,
          price: item.price,
          imageUrl: item.image_url,
          purchaseUrl: item.purchase_url,
          description: item.description,
          category: item.category || 'other'
        });
        // Update with actual database UUID
        setFavoriteItems(prevFavorites => {
          const newFavorites = new Map(prevFavorites);
          newFavorites.set(item.id, newDbUuid);
          return newFavorites;
        });
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      // Revert optimistic update on error
      setFavoriteItems(prevFavorites => {
        const newFavorites = new Map(prevFavorites);
        if (isFavorited) {
          newFavorites.set(item.id, dbUuid); // Restore with original UUID
        } else {
          newFavorites.delete(item.id);
        }
        return newFavorites;
      });
      Alert.alert('Error', 'Failed to update favorite');
    }
  };

  // Handle internal tab switching - scroll main view to top
  useEffect(() => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
  }, [activeTab]);

  // Handle screen navigation - reset before leaving to prevent glitches on return
  useEffect(() => {
    const unsubscribeBlur = navigation.addListener('blur', () => {
      // Reset everything when leaving the screen (e.g., going to Camera)
      // This happens before navigation, so no glitch when returning
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      shirtsScrollRef.current?.scrollTo({ x: 0, animated: false });
      pantsScrollRef.current?.scrollTo({ x: 0, animated: false });
      shoesScrollRef.current?.scrollTo({ x: 0, animated: false });
      otherScrollRef.current?.scrollTo({ x: 0, animated: false });

      // Reset settings when leaving settings tab
      if (activeTab === 'settings') {
        resetSettings();
      }
    });

    const unsubscribeFocus = navigation.addListener('focus', () => {
      // Reload favorites when returning to HomeScreen (e.g., from Camera)
      if (activeTab === 'home') {
        loadFavorites();
      }
    });

    // Cleanup listeners when component unmounts
    return () => {
      unsubscribeBlur();
      unsubscribeFocus();
    };
  }, [navigation, activeTab]);

  return (
    <LinearGradient
      colors={['#fef9f3', '#f5f3f1', '#ffffff']}
      locations={[0, 0.5, 1]}
      style={styles.container}
    >
      {/* Main content area - currently empty */}
      <ScrollView ref={scrollViewRef} style={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {activeTab === 'home' && (
          <View>
            <View style={styles.logoContainer}>
              <Image
                source={require('../assets/logo3-transparent.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>

            {/* Sections Container */}
            <View style={styles.sectionsContainer}>
              {favorites.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="heart-outline" size={48} color="#ccc" />
                  <Text style={styles.emptyText}>No favorites yet :(</Text>
                </View>
              ) : (
                <>
                  {/* Shirts Section */}
                  {favorites.filter(item => item.category === 'shirts').length > 0 && (
                    <View style={styles.sectionContainer}>
                      <Text style={styles.sectionTitle}>Favourite Tops</Text>
                      <ScrollView
                        ref={shirtsScrollRef}
                        horizontal
                        bounces={false}
                        overScrollMode="never"
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.horizontalScrollContent}
                      >
                        {favorites.filter(item => item.category === 'shirts').map((item, index, arr) => {
                          const isFavorited = favoriteItems.has(item.id);
                          return (
                          <TouchableOpacity
                            key={item.id}
                            style={[styles.recommendationCard, index !== arr.length - 1 && styles.cardMarginRight]}
                            activeOpacity={0.8}
                            onPress={() => handleOpenLink(item.purchase_url, item.name)}
                          >
                            <View style={styles.recommendationImageContainer}>
                              <Image
                                source={{ uri: item.image_url || 'https://via.placeholder.com/150' }}
                                style={styles.recommendationImage}
                                resizeMode="cover"
                              />
                              <TouchableOpacity
                                style={styles.heartButton}
                                onPress={() => handleToggleFavorite(item)}
                                activeOpacity={0.7}
                              >
                                <Ionicons
                                  name={isFavorited ? 'heart' : 'heart-outline'}
                                  size={24}
                                  color={isFavorited ? '#FF3B30' : '#999'}
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
                        })}
                      </ScrollView>
                    </View>
                  )}

                  {/* Pants Section */}
                  {favorites.filter(item => item.category === 'pants').length > 0 && (
                    <View style={styles.sectionContainer}>
                      <Text style={styles.sectionTitle}>Favourite Pants</Text>
                      <ScrollView
                        ref={pantsScrollRef}
                        horizontal
                        bounces={false}
                        overScrollMode="never"
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.horizontalScrollContent}
                      >
                        {favorites.filter(item => item.category === 'pants').map((item, index, arr) => {
                          const isFavorited = favoriteItems.has(item.id);
                          return (
                          <TouchableOpacity
                            key={item.id}
                            style={[styles.recommendationCard, index !== arr.length - 1 && styles.cardMarginRight]}
                            activeOpacity={0.8}
                            onPress={() => handleOpenLink(item.purchase_url, item.name)}
                          >
                            <View style={styles.recommendationImageContainer}>
                              <Image
                                source={{ uri: item.image_url || 'https://via.placeholder.com/150' }}
                                style={styles.recommendationImage}
                                resizeMode="cover"
                              />
                              <TouchableOpacity
                                style={styles.heartButton}
                                onPress={() => handleToggleFavorite(item)}
                                activeOpacity={0.7}
                              >
                                <Ionicons
                                  name={isFavorited ? 'heart' : 'heart-outline'}
                                  size={24}
                                  color={isFavorited ? '#FF3B30' : '#999'}
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
                        })}
                      </ScrollView>
                    </View>
                  )}

                  {/* Shoes Section */}
                  {favorites.filter(item => item.category === 'shoes').length > 0 && (
                    <View style={styles.sectionContainer}>
                      <Text style={styles.sectionTitle}>Favourite Shoes</Text>
                      <ScrollView
                        ref={shoesScrollRef}
                        horizontal
                        bounces={false}
                        overScrollMode="never"
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.horizontalScrollContent}
                      >
                        {favorites.filter(item => item.category === 'shoes').map((item, index, arr) => {
                          const isFavorited = favoriteItems.has(item.id);
                          return (
                          <TouchableOpacity
                            key={item.id}
                            style={[styles.recommendationCard, index !== arr.length - 1 && styles.cardMarginRight]}
                            activeOpacity={0.8}
                            onPress={() => handleOpenLink(item.purchase_url, item.name)}
                          >
                            <View style={styles.recommendationImageContainer}>
                              <Image
                                source={{ uri: item.image_url || 'https://via.placeholder.com/150' }}
                                style={styles.recommendationImage}
                                resizeMode="cover"
                              />
                              <TouchableOpacity
                                style={styles.heartButton}
                                onPress={() => handleToggleFavorite(item)}
                                activeOpacity={0.7}
                              >
                                <Ionicons
                                  name={isFavorited ? 'heart' : 'heart-outline'}
                                  size={24}
                                  color={isFavorited ? '#FF3B30' : '#999'}
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
                        })}
                      </ScrollView>
                    </View>
                  )}

                  {/* Other Section */}
                  {favorites.filter(item => item.category === 'other').length > 0 && (
                    <View style={styles.sectionContainer}>
                      <Text style={styles.sectionTitle}>Favourite Other</Text>
                      <ScrollView
                        ref={otherScrollRef}
                        horizontal
                        bounces={false}
                        overScrollMode="never"
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.horizontalScrollContent}
                      >
                        {favorites.filter(item => item.category === 'other').map((item, index, arr) => {
                          const isFavorited = favoriteItems.has(item.id);
                          return (
                          <TouchableOpacity
                            key={item.id}
                            style={[styles.recommendationCard, index !== arr.length - 1 && styles.cardMarginRight]}
                            activeOpacity={0.8}
                            onPress={() => handleOpenLink(item.purchase_url, item.name)}
                          >
                            <View style={styles.recommendationImageContainer}>
                              <Image
                                source={{ uri: item.image_url || 'https://via.placeholder.com/150' }}
                                style={styles.recommendationImage}
                                resizeMode="cover"
                              />
                              <TouchableOpacity
                                style={styles.heartButton}
                                onPress={() => handleToggleFavorite(item)}
                                activeOpacity={0.7}
                              >
                                <Ionicons
                                  name={isFavorited ? 'heart' : 'heart-outline'}
                                  size={24}
                                  color={isFavorited ? '#FF3B30' : '#999'}
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
                        })}
                      </ScrollView>
                    </View>
                  )}
                </>
              )}
            </View>
          </View>
        )}
        {activeTab === 'settings' && (
          <View style={styles.settingsContainer}>
            <View style={styles.settingsHeader}>
              <Text style={styles.settingsTitle}>Settings</Text>
              <TouchableOpacity
                onPress={handleSignOut}
                activeOpacity={0.7}
                style={styles.signOutButton}
              >
                <Ionicons name="log-out-outline" size={24} color="#3a3b3c" />
              </TouchableOpacity>
            </View>

            {/* Personal Information Section */}
            <View style={styles.settingsSection}>
              <Text style={styles.settingsSectionTitle}>Personal Information</Text>

              <View style={styles.settingsCard}>
                <Text style={styles.settingsLabel}>Name</Text>
                <View style={[styles.settingsInput, styles.locationRow]}>
                  <Text
                    style={[
                      styles.locationText,
                      !name && { color: '#999' }
                    ]}
                    ellipsizeMode="tail"
                    numberOfLines={1}
                  >
                    {name || 'Enter your name'}
                  </Text>
                  <Ionicons name="person-outline" size={24} color="#999" style={{ marginLeft: 8 }} />
                </View>
              </View>

              <View style={styles.settingsCard}>
                <Text style={styles.settingsLabel}>Email</Text>
                <View style={[styles.settingsInput, styles.locationRow]}>
                  <Text
                    style={[
                      styles.locationText,
                      !email && { color: '#999' }
                    ]}
                    ellipsizeMode="tail"
                    numberOfLines={1}
                  >
                    {email || 'Enter your email'}
                  </Text>
                  <Ionicons name="mail-outline" size={24} color="#999" style={{ marginLeft: 8 }} />
                </View>
              </View>

              <View style={styles.settingsCard}>
                <Text style={styles.settingsLabel}>Birth</Text>
                <View style={[styles.settingsInput, styles.locationRow]}>
                  <Text
                    style={[
                      styles.locationText,
                      !birthDate && { color: '#999' }
                    ]}
                    ellipsizeMode="tail"
                    numberOfLines={1}
                  >
                    {formatBirthDate(birthDate) || 'DD/MM/YYYY'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowBirthPicker(!showBirthPicker)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="calendar-outline" size={24} color="#007AFF" style={{ marginLeft: 8 }} />
                  </TouchableOpacity>
                </View>
                {showBirthPicker && (
                  <DateTimePicker
                    value={birthDate || maxBirthDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleBirthDateChange}
                    maximumDate={maxBirthDate}
                    minimumDate={minBirthDate}
                    style={styles.datePicker}
                  />
                )}
              </View>

              <View style={styles.settingsCard}>
                <Text style={styles.settingsLabel}>Gender</Text>
                <View style={styles.styleChipsContainer}>
                  {genderOptions.map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.styleChip,
                        gender === option && styles.styleChipSelected
                      ]}
                      onPress={() => selectGender(option)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.styleChipText,
                          gender === option && styles.styleChipTextSelected
                        ]}
                      >
                        {option}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.settingsCard}>
                <Text style={styles.settingsLabel}>Location</Text>
                <View style={[styles.settingsInput, styles.locationRow]}>
                  <Text
                    style={[
                      styles.locationText,
                      !location && { color: '#999' }
                    ]}
                    ellipsizeMode="tail"
                    numberOfLines={1}
                  >
                    {location || 'City, Country'}
                  </Text>
                  <TouchableOpacity
                    onPress={handleUpdateLocation}
                    activeOpacity={0.7}
                    disabled={loadingLocation}
                  >
                    {loadingLocation ? (
                      <ActivityIndicator size="small" color="#007AFF" />
                    ) : (
                      <Ionicons name="locate" size={24} color="#007AFF" style={{ marginLeft: 8 }} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.settingsCard}>
                <Text style={styles.settingsLabel}>Height (cm)</Text>
                <View style={styles.measurementInputWrapper}>
                  <TextInput
                    style={styles.measurementInput}
                    placeholder="Enter your height"
                    placeholderTextColor="#999"
                    value={height}
                    onChangeText={(text) => setHeight(text.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  {height && cmToFt(parseInt(height)) && (
                    <Text style={styles.conversionText}>≈ {cmToFt(parseInt(height))}</Text>
                  )}
                </View>
              </View>

              <View style={styles.settingsCard}>
                <Text style={styles.settingsLabel}>Weight (kg)</Text>
                <View style={styles.measurementInputWrapper}>
                  <TextInput
                    style={styles.measurementInput}
                    placeholder="Enter your weight"
                    placeholderTextColor="#999"
                    value={weight}
                    onChangeText={(text) => setWeight(text.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  {weight && kgToLb(parseInt(weight)) && (
                    <Text style={styles.conversionText}>≈ {kgToLb(parseInt(weight))}</Text>
                  )}
                </View>
              </View>
            </View>

            {/* Shopping Preferences Section */}
            <View style={styles.settingsSection}>
              <Text style={styles.settingsSectionTitle}>Shopping Preferences</Text>

              <View style={styles.settingsCard}>
                <Text style={styles.settingsLabel}>Currency</Text>
                <View style={styles.styleChipsContainer}>
                  {currencyOptions.map((curr) => (
                    <TouchableOpacity
                      key={curr}
                      style={[
                        styles.styleChip,
                        styles.currencyChip,
                        currency === curr && styles.styleChipSelected
                      ]}
                      onPress={() => selectCurrency(curr)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.styleChipText,
                          currency === curr && styles.styleChipTextSelected
                        ]}
                      >
                        {curr}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.settingsCard}>
                <Text style={styles.settingsLabel}>Price Range</Text>
                <View style={styles.priceRangeContainer}>
                  <View style={styles.priceInputWrapper}>
                    <Text style={styles.pricePrefix}>{currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency === 'JPY' ? '¥' : '$'}</Text>
                    <TextInput
                      style={styles.priceInput}
                      placeholder="Min"
                      placeholderTextColor="#999"
                      value={priceMin}
                      onChangeText={(text) => setPriceMin(text.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                      maxLength={5}
                    />
                  </View>
                  <Text style={styles.priceSeparator}>—</Text>
                  <View style={styles.priceInputWrapper}>
                    <Text style={styles.pricePrefix}>{currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency === 'JPY' ? '¥' : '$'}</Text>
                    <TextInput
                      style={styles.priceInput}
                      placeholder="Max"
                      placeholderTextColor="#999"
                      value={priceMax}
                      onChangeText={(text) => setPriceMax(text.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                      maxLength={5}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.settingsCard}>
                <Text style={styles.settingsLabel}>Shirt Size</Text>
                <View style={styles.styleChipsContainer}>
                  {shirtSizeOptions.map((size) => (
                    <TouchableOpacity
                      key={size}
                      style={[
                        styles.sizeChip,
                        styles.styleChip,
                        shirtSize === size && styles.styleChipSelected
                      ]}
                      onPress={() => selectShirtSize(size)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.styleChipText,
                          shirtSize === size && styles.styleChipTextSelected
                        ]}
                      >
                        {size}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.settingsCard}>
                <Text style={styles.settingsLabel}>Pants Size</Text>
                <View style={styles.styleChipsContainer}>
                  {pantsSizeOptions.map((size) => (
                    <TouchableOpacity
                      key={size}
                      style={[
                        styles.sizeChip,
                        styles.styleChip,
                        pantsSize === size && styles.styleChipSelected
                      ]}
                      onPress={() => selectPantsSize(size)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.styleChipText,
                          pantsSize === size && styles.styleChipTextSelected
                        ]}
                      >
                        {size}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.settingsCard}>
                <Text style={styles.settingsLabel}>Shoe Size</Text>
                <View style={styles.styleChipsContainer}>
                  {shoeSizeOptions.map((size) => (
                    <TouchableOpacity
                      key={size}
                      style={[
                        styles.sizeChip,
                        styles.styleChip,
                        shoeSize === size && styles.styleChipSelected
                      ]}
                      onPress={() => selectShoeSize(size)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.styleChipText,
                          shoeSize === size && styles.styleChipTextSelected
                        ]}
                      >
                        {size}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.settingsCard}>
                <Text style={styles.settingsLabel}>Favorite Styles</Text>
                <TextInput
                  style={[styles.settingsInput, styles.textAreaInput]}
                  placeholder="e.g., Old-Money style"
                  placeholderTextColor="#999"
                  value={favoriteStyles}
                  onChangeText={(text) => {
                    // Allow only letters, spaces, commas, and hyphens
                    let filtered = text.replace(/[^a-zA-Z\s,]/g, '');

                    // Remove leading commas and spaces
                    filtered = filtered.replace(/^[,\s]+/, '');

                    // Collapse multiple spaces into one
                    filtered = filtered.replace(/\s+/g, ' ');

                    // Collapse multiple commas into one
                    filtered = filtered.replace(/,+/g, ',');

                    // Remove spaces before commas
                    filtered = filtered.replace(/\s+,/g, ',');

                    // Ensure comma is always followed by a space
                    filtered = filtered.replace(/,(?!\s)/g, ', ');

                    setFavoriteStyles(filtered);
                  }}
                  onBlur={() => setFavoriteStyles(favoriteStyles.replace(/[,\s]+$/, ''))}
                  multiline
                  numberOfLines={3}
                  autoCapitalize="words"
                  textAlignVertical="top"
                  blurOnSubmit={true}
                  maxLength={100}
                />
              </View>

              <View style={styles.settingsCard}>
                <Text style={styles.settingsLabel}>Favorite Brands</Text>
                <TextInput
                  style={[styles.settingsInput, styles.textAreaInput]}
                  placeholder="e.g., Nike, Adidas, Zara"
                  placeholderTextColor="#999"
                  value={favoriteBrands}
                  onChangeText={(text) => {
                    // Allow only letters, spaces, and commas
                    let filtered = text.replace(/[^a-zA-Z\s,]/g, '');

                    // Remove leading commas and spaces
                    filtered = filtered.replace(/^[,\s]+/, '');

                    // Collapse multiple spaces into one
                    filtered = filtered.replace(/\s+/g, ' ');

                    // Collapse multiple commas into one
                    filtered = filtered.replace(/,+/g, ',');

                    // Remove spaces before commas
                    filtered = filtered.replace(/\s+,/g, ',');

                    // Ensure comma is always followed by a space
                    filtered = filtered.replace(/,(?!\s)/g, ', ');

                    setFavoriteBrands(filtered);
                  }}
                  onBlur={() => setFavoriteBrands(favoriteBrands.replace(/[,\s]+$/, ''))}
                  multiline
                  numberOfLines={3}
                  autoCapitalize="words"
                  textAlignVertical="top"
                  blurOnSubmit={true}
                  maxLength={100}
                />
              </View>
            </View>

            {/* General Device Settings Section */}
            <View style={styles.settingsSection}>
              <Text style={styles.settingsSectionTitle}>General Device Settings</Text>

              <View style={styles.settingsCard}>
                <Text style={styles.settingsLabel}>Language</Text>
                <View style={styles.styleChipsContainer}>
                  {languageOptions.map((lang) => (
                    <TouchableOpacity
                      key={lang}
                      style={[
                        styles.styleChip,
                        language === lang && styles.styleChipSelected
                      ]}
                      onPress={() => selectLanguage(lang)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.styleChipText,
                          language === lang && styles.styleChipTextSelected
                        ]}
                      >
                        {lang}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.settingsCard}>
                <View style={styles.toggleRow}>
                  <View style={styles.toggleLabelContainer}>
                    <Text style={styles.settingsLabel}>Push Notifications</Text>
                    <Text style={styles.toggleDescription}>Receive useful reminders</Text>
                  </View>
                  <Switch
                    value={pushNotifications}
                    onValueChange={handleNotificationToggle}
                    trackColor={{ false: '#f0f0f0', true: '#007AFF' }}
                    thumbColor="#fff"
                  />
                </View>
              </View>
            </View>

            {/* Data & Privacy Section */}
            <View style={styles.settingsSection}>
              <Text style={styles.settingsSectionTitle}>Data & Privacy Controls</Text>

              <TouchableOpacity
                style={styles.linkCard}
                onPress={() => handleOpenLink('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/', 'Terms of Use')}
                activeOpacity={0.7}
              >
                <View style={styles.linkCardContent}>
                  <Ionicons name="document-text-outline" size={20} color="#007AFF" style={styles.linkCardIcon} />
                  <Text style={styles.linkCardText}>Terms of Use</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.linkCard}
                onPress={() => handleOpenLink('https://snazzyai.app/privacy/', 'Privacy Policy')}
                activeOpacity={0.7}
              >
                <View style={styles.linkCardContent}>
                  <Ionicons name="shield-checkmark-outline" size={20} color="#007AFF" style={styles.linkCardIcon} />
                  <Text style={styles.linkCardText}>Privacy Policy</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.linkCard}
                onPress={handleExportData}
                activeOpacity={0.7}
              >
                <View style={styles.linkCardContent}>
                  <Ionicons name="download-outline" size={20} color="#007AFF" style={styles.linkCardIcon} />
                  <Text style={styles.linkCardText}>Export My Data</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>
            </View>

            {/* Action Buttons */}
            <View style={styles.settingsActions}>
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSaveSettings}
                activeOpacity={0.7}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <ActivityIndicator color="#fff" size="small" style={styles.buttonIcon} />
                    <Text style={styles.saveButtonText}>Saving...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="cloud-upload" size={20} color="#fff" style={styles.buttonIcon} />
                    <Text style={styles.saveButtonText}>Save Settings</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteButton}
                onPress={handleDeleteAccount}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={20} color="#FF3B30" style={styles.buttonIcon} />
                <Text style={styles.deleteButtonText}>Delete Account</Text>
              </TouchableOpacity>

              <Text style={styles.versionFooter}>Version 1.0.0</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom Navigation Bar */}
      <View style={[styles.navigationBar, { paddingBottom: insets.bottom }]}>
        {/* Home Icon - Left */}
        <TouchableOpacity
          style={[styles.navButton, styles.navButtonSide]}
          onPress={() => handleTabPress('home')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="home-sharp"
            size={28}
            color={activeTab === 'home' ? '#007AFF' : '#999'}
          />
        </TouchableOpacity>

        {/* Plus Icon - Center */}
        <TouchableOpacity
          style={styles.navButtonCenter}
          onPress={() => handleTabPress('add')}
          activeOpacity={0.7}
        >
          <Image
            source={require('../assets/logo.png')}
            style={styles.plusIconContainer}
            resizeMode="cover"
          />
        </TouchableOpacity>

        {/* Settings Icon - Right */}
        <TouchableOpacity
          style={[styles.navButton, styles.navButtonSide]}
          onPress={() => handleTabPress('settings')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="settings-sharp"
            size={28}
            color={activeTab === 'settings' ? '#007AFF' : '#999'}
          />
        </TouchableOpacity>
      </View>

      <StatusBar style="dark" />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  gradientBackground: {
    minHeight: '100%',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#999',
    marginTop: 12,
  },
  contentContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  titleContainer: {
    paddingTop: 60,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  logoContainer: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3a3b3c',
    letterSpacing: 0.5,
  },
  logo: {
    width: width * 0.9,
    height: 300,
    marginTop: -60,
    marginBottom: -100,
  },
  sectionsContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionContainer: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#3a3b3c',
    marginBottom: 15,
  },
  horizontalScrollContent: {
    paddingRight: 5,
    paddingVertical: 8,
    paddingLeft: 5,
  },
  recommendationCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 0,
    alignItems: 'flex-start',
    width: width * 0.82,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 1.5,
  },
  cardMarginRight: {
    marginRight: 12,
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
  navigationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 30,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255, 255, 255, 0.7)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 0,
  },
  navButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 50,
    height: 50,
  },
  navButtonSide: {
    borderRadius: 25,
  },
  navButtonCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  // Settings styles
  settingsContainer: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  settingsTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3a3b3c',
    letterSpacing: 0.5,
  },
  signOutButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 0,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 1.5,
  },
  // Settings page uses proportional spacing (80% scale) for a more compact feel
  // Home sections: 30px spacing with 15px title margin (2:1 ratio)
  // Settings sections: 24px spacing with 12px title margin (2:1 ratio)
  settingsSection: {
    marginBottom: 24,
  },
  settingsSectionTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#3a3b3c',
    marginBottom: 12,
  },
  settingsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 0,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 1.5,
  },
  settingsLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3a3b3c',
    marginBottom: 8,
  },
  labelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  settingsInput: {
    fontSize: 16,
    color: '#3a3b3c',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f5f5f5',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationText: {
    fontSize: 16,
    color: '#3a3b3c',
    flex: 1,
  },
  datePicker: {
    marginTop: 8,
  },
  textAreaInput: {
    minHeight: 80,
    paddingTop: 12,
  },
  measurementInputWrapper: {
    position: 'relative',
  },
  measurementInput: {
    fontSize: 16,
    color: '#3a3b3c',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    borderRadius: 8,
    padding: 12,
    paddingRight: 90,
    backgroundColor: '#f5f5f5',
  },
  conversionText: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    textAlignVertical: 'center',
    lineHeight: 46,
    fontSize: 14,
    color: '#999',
    fontWeight: '500',
  },
  splitInputContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  splitInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
  },
  splitInput: {
    flex: 1,
    fontSize: 16,
    color: '#3a3b3c',
    padding: 12,
    paddingLeft: 0,
  },
  splitInputUnit: {
    fontSize: 14,
    color: '#999',
    fontWeight: '500',
    marginLeft: 4,
  },
  priceRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  priceInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
  },
  pricePrefix: {
    fontSize: 16,
    color: '#3a3b3c',
    fontWeight: '500',
    marginRight: 4,
  },
  priceInput: {
    flex: 1,
    fontSize: 16,
    color: '#3a3b3c',
    padding: 12,
    paddingLeft: 0,
  },
  priceSeparator: {
    fontSize: 16,
    color: '#999',
    fontWeight: '500',
  },
  styleChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  styleChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  styleChipSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  styleChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3a3b3c',
  },
  styleChipTextSelected: {
    color: '#fff',
  },
  settingsActions: {
    marginTop: 12,
    gap: 12,
  },
  saveButton: {
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
  saveButtonDisabled: {
    backgroundColor: '#999',
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 13,
    paddingHorizontal: 23,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF3B30',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  deleteButtonText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '500',
  },
  buttonIcon: {
    marginRight: 8,
  },
  // Toggle styles
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabelContainer: {
    flex: 1,
    marginRight: 12,
  },
  toggleDescription: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
    lineHeight: 18,
  },
  // Link card styles
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 0,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 1.5,
  },
  linkCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  linkCardIcon: {
    marginRight: 12,
  },
  linkCardText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#3a3b3c',
  },
  // Currency and size chip styles
  currencyChip: {
    minWidth: 60,
  },
  sizeChip: {
    minWidth: 50,
  },
  // Version footer text
  versionFooter: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 20,
  },
});
