import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, Image, ScrollView, TextInput, Alert, Keyboard, Switch, Linking, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from './lib/supabase';
import { getProfile, updateProfile, addFavorite, removeFavorite } from './lib/supabaseHelpers';

const { width, height } = Dimensions.get('window');

// Utility function for safe haptic feedback
const safeHaptic = async (hapticFunction) => {
  try {
    await hapticFunction();
  } catch (error) {
    console.log('Haptics not available on this device');
  }
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
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState([]);
  const [favoriteItems, setFavoriteItems] = useState(new Map()); // Map: itemId -> database UUID

  // Settings state - Personal Information
  const [name, setName] = useState('');
  const [birth, setBirth] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('');
  const [location, setLocation] = useState('');

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
  const [favoriteBrands, setFavoriteBrands] = useState('');
  const [favoriteStyles, setFavoriteStyles] = useState([]);

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
      setLoading(true);
      const profile = await getProfile();

      if (profile) {
        setName(profile.name || '');
        setEmail(profile.email || '');

        // Convert birth from YYYY-MM-DD to YYYYMMDD
        if (profile.birth) {
          setBirth(profile.birth.replace(/-/g, ''));
        } else {
          setBirth('');
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
        setFavoriteBrands(profile.favorite_brands?.join(' ') || '');
        setFavoriteStyles(profile.favorite_styles || []);
        setLanguage(profile.language || 'English');
        setPushNotifications(profile.push_notifications ?? true);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setLoading(false);
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
  const styleOptions = ['Casual', 'Formal', 'Streetwear', 'Sporty', 'Vintage', 'Minimalist'];
  const genderOptions = ['Male', 'Female', 'Other'];
  const currencyOptions = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'];
  const languageOptions = ['English', 'Spanish'];
  const shirtSizeOptions = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  const pantsSizeOptions = ['28', '30', '32', '34', '36', '38', '40', '42'];
  const shoeSizeOptions = ['6', '7', '8', '9', '10', '11', '12', '13'];

  // Toggle selection helpers
  const toggleStyle = async (style) => {
    if (favoriteStyles.includes(style)) {
      setFavoriteStyles(favoriteStyles.filter(s => s !== style));
    } else {
      setFavoriteStyles([...favoriteStyles, style]);
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

  // Handle export data
  const handleExportData = async () => {
    Alert.alert(
      'Export Data',
      'Your data will be prepared and sent to your email address.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Export',
          onPress: () => {
            Alert.alert('Success', 'Data export request submitted. You will receive an email shortly.');
          }
        }
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

      // Parse favorite brands from space-separated string to array
      const brandsArray = favoriteBrands
        .split(' ')
        .map(brand => brand.trim())
        .filter(brand => brand.length > 0);

      // Validate birth date (only accept empty or complete 8 digits)
      if (birth && birth.length > 0 && birth.length !== 8) {
        Alert.alert(
          'Incomplete Birth Date',
          'Please complete your birth date or leave it empty.',
          [{ text: 'OK' }]
        );
        setSaving(false);
        return;
      }

      // Validate price range
      const minPrice = priceMin ? parseInt(priceMin) : null;
      const maxPrice = priceMax ? parseInt(priceMax) : null;

      if (minPrice !== null && maxPrice !== null && minPrice >= maxPrice) {
        Alert.alert(
          'Invalid Price Range',
          'Minimum price must be less than maximum price.',
          [{ text: 'OK' }]
        );
        setSaving(false);
        return;
      }

      await updateProfile({
        name: name || null,
        email: email || null,
        birth: birth || null,
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
        favorite_brands: brandsArray,
        favorite_styles: favoriteStyles,
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
              // Navigation will be handled by Navigator.js auth state listener
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
      'To delete your account and all associated data, please contact us at pablo@snazzyai.app with your account email. We will process your request within 24 hours.',
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
      navigation.navigate('Camera');
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

  // Show loading spinner while fetching profile
  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Main content area - currently empty */}
      <ScrollView ref={scrollViewRef} style={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {activeTab === 'home' && (
          <View>
            <View style={styles.logoContainer}>
              <Image
                source={require('./assets/logo3.png')}
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
                      <Text style={styles.sectionTitle}>Shirts</Text>
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
                              <Text style={styles.recommendationBrand}>{item.brand}</Text>
                              <Text style={styles.recommendationDescription} numberOfLines={2} ellipsizeMode="tail">
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
                      <Text style={styles.sectionTitle}>Pants</Text>
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
                              <Text style={styles.recommendationBrand}>{item.brand}</Text>
                              <Text style={styles.recommendationDescription} numberOfLines={2} ellipsizeMode="tail">
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
                      <Text style={styles.sectionTitle}>Shoes</Text>
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
                              <Text style={styles.recommendationBrand}>{item.brand}</Text>
                              <Text style={styles.recommendationDescription} numberOfLines={2} ellipsizeMode="tail">
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
                      <Text style={styles.sectionTitle}>Other</Text>
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
                              <Text style={styles.recommendationBrand}>{item.brand}</Text>
                              <Text style={styles.recommendationDescription} numberOfLines={2} ellipsizeMode="tail">
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
                <TextInput
                  style={styles.settingsInput}
                  placeholder="Enter your name"
                  placeholderTextColor="#999"
                  value={name}
                  onChangeText={(text) => {
                    // Remove non-letter characters, trim leading spaces only, collapse multiple spaces
                    const filtered = text.replace(/[^a-zA-Z\s]/g, '').replace(/^\s+/, '').replace(/\s+/g, ' ');
                    setName(filtered);
                  }}
                  onBlur={() => setName(name.trim())}
                  autoCapitalize="words"
                  maxLength={10}
                />
              </View>

              <View style={styles.settingsCard}>
                <Text style={styles.settingsLabel}>Email</Text>
                <Text
                  style={[
                    styles.settingsInput,
                    !email && { color: '#999' }
                  ]}
                  ellipsizeMode="tail"
                  numberOfLines={1}
                >
                  {email || 'Enter your email'}
                </Text>
              </View>

              <View style={styles.settingsCard}>
                <Text style={styles.settingsLabel}>Birth</Text>
                <TextInput
                  style={styles.settingsInput}
                  placeholder="YYYY/MM/DD"
                  placeholderTextColor="#999"
                  value={birth}
                  onChangeText={(text) => setBirth(text.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  maxLength={8}
                />
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
                <TextInput
                  style={styles.settingsInput}
                  placeholder="City, Country"
                  placeholderTextColor="#999"
                  value={location}
                  onChangeText={(text) => {
                    // Remove non-letter characters, trim leading spaces only, collapse multiple spaces
                    const filtered = text.replace(/[^a-zA-Z\s]/g, '').replace(/^\s+/, '').replace(/\s+/g, ' ');
                    setLocation(filtered);
                  }}
                  onBlur={() => setLocation(location.trim())}
                  autoCapitalize="words"
                  maxLength={25}
                />
              </View>

              <View style={styles.settingsCard}>
                <Text style={styles.settingsLabel}>Height (cm)</Text>
                <TextInput
                  style={styles.settingsInput}
                  placeholder="Enter your height"
                  placeholderTextColor="#999"
                  value={height}
                  onChangeText={(text) => setHeight(text.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  maxLength={3}
                />
              </View>

              <View style={styles.settingsCard}>
                <Text style={styles.settingsLabel}>Weight (kg)</Text>
                <TextInput
                  style={styles.settingsInput}
                  placeholder="Enter your weight"
                  placeholderTextColor="#999"
                  value={weight}
                  onChangeText={(text) => setWeight(text.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  maxLength={3}
                />
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
                <Text style={styles.settingsLabel}>Favorite Brands</Text>
                <TextInput
                  style={[styles.settingsInput, styles.textAreaInput]}
                  placeholder="e.g., Nike, Adidas, Zara"
                  placeholderTextColor="#999"
                  value={favoriteBrands}
                  onChangeText={(text) => {
                    // Remove non-letter characters, trim leading spaces only, collapse multiple spaces
                    const filtered = text.replace(/[^a-zA-Z\s]/g, '').replace(/^\s+/, '').replace(/\s+/g, ' ');
                    setFavoriteBrands(filtered);
                  }}
                  onBlur={() => setFavoriteBrands(favoriteBrands.trim())}
                  multiline
                  numberOfLines={3}
                  autoCapitalize="words"
                  textAlignVertical="top"
                  maxLength={50}
                />
              </View>

              <View style={styles.settingsCard}>
                <Text style={styles.settingsLabel}>Favorite Styles</Text>
                <View style={styles.styleChipsContainer}>
                  {styleOptions.map((style) => (
                    <TouchableOpacity
                      key={style}
                      style={[
                        styles.styleChip,
                        favoriteStyles.includes(style) && styles.styleChipSelected
                      ]}
                      onPress={() => toggleStyle(style)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.styleChipText,
                          favoriteStyles.includes(style) && styles.styleChipTextSelected
                        ]}
                      >
                        {style}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
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
                    onValueChange={(value) => {
                      setPushNotifications(value);
                    }}
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
                onPress={() => handleOpenLink('https://snazzyai.app', 'Terms of Use')}
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
                onPress={() => handleOpenLink('https://snazzyai.app', 'Privacy Policy')}
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
            source={require('./assets/logo.png')}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3a3b3c',
    marginTop: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    marginTop: 12,
  },
  emptySubtext: {
    marginTop: 4,
    fontSize: 14,
    color: '#ccc',
  },
  contentContainer: {
    flex: 1,
    backgroundColor: '#fff',
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
    fontWeight: '600',
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
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'flex-start',
    width: width * 0.82,
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
    fontWeight: '600',
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
    fontWeight: '700',
    color: '#3a3b3c',
  },
  navigationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 30,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
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
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  // Settings page uses proportional spacing (80% scale) for a more compact feel
  // Home sections: 30px spacing with 15px title margin (2:1 ratio)
  // Settings sections: 24px spacing with 12px title margin (2:1 ratio)
  settingsSection: {
    marginBottom: 24,
  },
  settingsSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3a3b3c',
    marginBottom: 12,
  },
  settingsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  settingsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3a3b3c',
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
  textAreaInput: {
    minHeight: 80,
    paddingTop: 12,
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
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontWeight: '600',
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
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
    fontWeight: '600',
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
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    fontWeight: '600',
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
