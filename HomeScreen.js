import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, Image, ScrollView, TextInput, Alert, Keyboard, Switch, Linking } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

    Alert.alert(
      'Settings Saved',
      'Your preferences have been updated successfully.',
      [{ text: 'OK' }]
    );
  };

  // Handle delete account
  const handleDeleteAccount = async () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // Clear all user data
            setName('');
            setBirth('');
            setEmail('');
            setGender('');
            setLocation('');
            setHeight('');
            setWeight('');
            setPriceMin('');
            setPriceMax('');
            setCurrency('USD');
            setShirtSize('');
            setPantsSize('');
            setShoeSize('');
            setFavoriteBrands('');
            setFavoriteStyles([]);
            setLanguage('English');
            setPushNotifications(true);

            Alert.alert('Account Deleted', 'Your account has been successfully deleted.');
          }
        }
      ]
    );
  };

  // Reset all settings to initial values
  const resetSettings = () => {
    setName('');
    setBirth('');
    setEmail('');
    setGender('');
    setLocation('');
    setHeight('');
    setWeight('');
    setPriceMin('');
    setPriceMax('');
    setCurrency('USD');
    setShirtSize('');
    setPantsSize('');
    setShoeSize('');
    setFavoriteBrands('');
    setFavoriteStyles([]);
    setLanguage('English');
    setPushNotifications(true);
  };

  const handleTabPress = async (tabName) => {
    // If leaving settings tab, reset unsaved changes
    if (activeTab === 'settings' && tabName !== 'settings') {
      resetSettings();
    }

    if (tabName === 'add') {
      navigation.navigate('Camera');
    } else {
      setActiveTab(tabName);
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

    // Cleanup listener when component unmounts
    return unsubscribeBlur;
  }, [navigation, activeTab]);

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
              {/* Shirts Section */}
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>Favourite Shirts</Text>
                <ScrollView
                  horizontal
                  bounces={false}
                  ref={shirtsScrollRef}
                  overScrollMode="never"
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalScrollContent}
                >
                  {[1, 2, 3].map((item, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[styles.recommendationCard, index !== 2 && styles.cardMarginRight]}
                      activeOpacity={0.8}
                    >
                      <View style={styles.recommendationImageContainer}>
                        <Image
                          source={{ uri: 'https://via.placeholder.com/150' }}
                          style={styles.recommendationImage}
                          resizeMode="cover"
                        />
                        <TouchableOpacity
                          style={styles.heartButton}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name="heart"
                            size={24}
                            color="#FF3B30"
                          />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.recommendationContent}>
                        <Text style={styles.recommendationName} numberOfLines={1}>Shirt {item}</Text>
                        <Text style={styles.recommendationBrand}>Brand</Text>
                        <Text style={styles.recommendationDescription} numberOfLines={2} ellipsizeMode="tail">
                          Product description goes here
                        </Text>
                        <Text style={styles.recommendationPrice}>$0.00</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Pants Section */}
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>Favourite Pants</Text>
                <ScrollView
                  horizontal
                  bounces={false}
                  ref={pantsScrollRef}
                  overScrollMode="never"
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalScrollContent}
                >
                  {[1, 2, 3].map((item, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[styles.recommendationCard, index !== 2 && styles.cardMarginRight]}
                      activeOpacity={0.8}
                    >
                      <View style={styles.recommendationImageContainer}>
                        <Image
                          source={{ uri: 'https://via.placeholder.com/150' }}
                          style={styles.recommendationImage}
                          resizeMode="cover"
                        />
                        <TouchableOpacity
                          style={styles.heartButton}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name="heart"
                            size={24}
                            color="#FF3B30"
                          />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.recommendationContent}>
                        <Text style={styles.recommendationName} numberOfLines={1}>Pants {item}</Text>
                        <Text style={styles.recommendationBrand}>Brand</Text>
                        <Text style={styles.recommendationDescription} numberOfLines={2} ellipsizeMode="tail">
                          Product description goes here
                        </Text>
                        <Text style={styles.recommendationPrice}>$0.00</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Shoes Section */}
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>Favourite Shoes</Text>
                <ScrollView
                  horizontal
                  bounces={false}
                  ref={shoesScrollRef}
                  overScrollMode="never"
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalScrollContent}
                >
                  {[1, 2, 3].map((item, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[styles.recommendationCard, index !== 2 && styles.cardMarginRight]}
                      activeOpacity={0.8}
                    >
                      <View style={styles.recommendationImageContainer}>
                        <Image
                          source={{ uri: 'https://via.placeholder.com/150' }}
                          style={styles.recommendationImage}
                          resizeMode="cover"
                        />
                        <TouchableOpacity
                          style={styles.heartButton}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name="heart"
                            size={24}
                            color="#FF3B30"
                          />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.recommendationContent}>
                        <Text style={styles.recommendationName} numberOfLines={1}>Shoes {item}</Text>
                        <Text style={styles.recommendationBrand}>Brand</Text>
                        <Text style={styles.recommendationDescription} numberOfLines={2} ellipsizeMode="tail">
                          Product description goes here
                        </Text>
                        <Text style={styles.recommendationPrice}>$0.00</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Other Section */}
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>Favourite Other</Text>
                <ScrollView
                  horizontal
                  bounces={false}
                  ref={otherScrollRef}
                  overScrollMode="never"
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalScrollContent}
                >
                  {[1, 2, 3].map((item, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[styles.recommendationCard, index !== 2 && styles.cardMarginRight]}
                      activeOpacity={0.8}
                    >
                      <View style={styles.recommendationImageContainer}>
                        <Image
                          source={{ uri: 'https://via.placeholder.com/150' }}
                          style={styles.recommendationImage}
                          resizeMode="cover"
                        />
                        <TouchableOpacity
                          style={styles.heartButton}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name="heart"
                            size={24}
                            color="#FF3B30"
                          />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.recommendationContent}>
                        <Text style={styles.recommendationName} numberOfLines={1}>Accessory {item}</Text>
                        <Text style={styles.recommendationBrand}>Brand</Text>
                        <Text style={styles.recommendationDescription} numberOfLines={2} ellipsizeMode="tail">
                          Product description goes here
                        </Text>
                        <Text style={styles.recommendationPrice}>$0.00</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </View>
        )}
        {activeTab === 'settings' && (
          <View style={styles.settingsContainer}>
            <Text style={styles.settingsTitle}>Settings</Text>

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
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.settingsCard}>
                <Text style={styles.settingsLabel}>Email</Text>
                <TextInput
                  style={styles.settingsInput}
                  placeholder="Enter your email"
                  placeholderTextColor="#999"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.settingsCard}>
                <Text style={styles.settingsLabel}>Birth</Text>
                <TextInput
                  style={styles.settingsInput}
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor="#999"
                  value={birth}
                  onChangeText={setBirth}
                  keyboardType="number-pad"
                  maxLength={10}
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
                  onChangeText={setLocation}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.settingsCard}>
                <Text style={styles.settingsLabel}>Height (cm)</Text>
                <TextInput
                  style={styles.settingsInput}
                  placeholder="Enter your height"
                  placeholderTextColor="#999"
                  value={height}
                  onChangeText={setHeight}
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
                  onChangeText={setWeight}
                  keyboardType="decimal-pad"
                  maxLength={5}
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
                      onChangeText={setPriceMin}
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
                      onChangeText={setPriceMax}
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
                  onChangeText={setFavoriteBrands}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
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
                style={styles.saveButton}
                onPress={handleSaveSettings}
                activeOpacity={0.7}
              >
                <Ionicons name="cloud-upload" size={20} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.saveButtonText}>Save Settings</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resetButton}
                onPress={handleDeleteAccount}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={20} color="#FF3B30" style={styles.buttonIcon} />
                <Text style={styles.resetButtonText}>Delete Account</Text>
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
    color: '#3a3b3e',
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
    color: '#3a3b3e',
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
    color: '#3a3b3e',
    marginBottom: 2,
  },
  recommendationBrand: {
    fontSize: 14,
    color: '#007AFF',
    marginBottom: 4,
  },
  recommendationDescription: {
    fontSize: 13,
    color: '#3a3b3e',
    lineHeight: 18,
    marginBottom: 4,
  },
  recommendationPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#3a3b3e',
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
  settingsTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3a3b3e',
    letterSpacing: 0.5,
    marginBottom: 24,
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
    color: '#3a3b3e',
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
    color: '#3a3b3e',
    marginBottom: 8,
  },
  settingsInput: {
    fontSize: 16,
    color: '#3a3b3e',
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
    color: '#3a3b3e',
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
    color: '#3a3b3e',
    fontWeight: '600',
    marginRight: 4,
  },
  priceInput: {
    flex: 1,
    fontSize: 16,
    color: '#3a3b3e',
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
    color: '#3a3b3e',
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
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resetButton: {
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
  resetButtonText: {
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
    color: '#3a3b3e',
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
