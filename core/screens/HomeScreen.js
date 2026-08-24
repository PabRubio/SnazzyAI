import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useCameraPermissions } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { usePlacement, useUser } from "expo-superwall";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Keyboard,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "../../supabase/services/supabase";
import {
  addFavorite,
  deleteAccount,
  getOutfitHistory,
  getProfile,
  removeFavorite,
  updateProfile,
} from "../../supabase/services/supabaseHelpers";
import { useNavigation } from "../components/navigation/NavigationContext";
import Text from "../components/typography/Text";
import TextInput from "../components/typography/TextInput";

const { height, width } = Dimensions.get("window");
const getDiscoverProductKey = (item, index) =>
  item.purchaseUrl || `${item.name}-${item.brand}-${index}`;
const INITIAL_DISCOVER_STATE = {
  products: [],
  prompt: "",
  status: "idle",
  validationError: "",
};

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
  const shirtsScrollRef = useRef(null);
  const pantsScrollRef = useRef(null);
  const shoesScrollRef = useRef(null);
  const otherScrollRef = useRef(null);
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef(null);
  const deletingAccountRef = useRef(false);
  const discoverRequestRef = useRef({ controller: null, id: 0 });
  const outfitPhotoHeadersRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [outfitHistory, setOutfitHistory] = useState([]);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [favoriteItems, setFavoriteItems] = useState(new Map());
  const [lookbookStatus, setLookbookStatus] = useState("loading");
  const [favoritesStatus, setFavoritesStatus] = useState("loading");
  const [settingsStatus, setSettingsStatus] = useState("loading");
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [activeTab, setActiveTab] = useState("home");
  const [discover, setDiscover] = useState(INITIAL_DISCOVER_STATE);
  const { getEntitlements, subscriptionStatus, update } = useUser();
  const { switchToAuthStack } = useNavigation();
  const { registerPlacement: registerCameraPlacement } = usePlacement({
    onDismiss: (info, result) => {
      if (["purchased", "restored"].includes(result?.type)) {
        navigation.navigate("Camera");
      }
    },
    onError: (error) => {
      console.error("Paywall error:", error);
      Alert.alert("Error", "Failed to show paywall. Please try again.");
    },
  });
  const canSearchDiscover =
    Platform.OS === "android" || subscriptionStatus?.status === "ACTIVE";

  useEffect(() => {
    if (!canSearchDiscover) Keyboard.dismiss();
  }, [canSearchDiscover]);

  // Settings state - Personal Information
  const [name, setName] = useState("");
  const [birth, setBirth] = useState("");
  const [birthDate, setBirthDate] = useState(null);
  const [showBirthPicker, setShowBirthPicker] = useState(false);
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState("");
  const [location, setLocation] = useState("");
  const [loadingLocation, setLoadingLocation] = useState(false);

  // Physical
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");

  // Shopping Preferences
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [shirtSize, setShirtSize] = useState("");
  const [pantsSize, setPantsSize] = useState("");
  const [shoeSize, setShoeSize] = useState("");
  const [favoriteStyles, setFavoriteStyles] = useState("");
  const [favoriteBrands, setFavoriteBrands] = useState("");

  // General Settings
  const [language, setLanguage] = useState("English");
  const [pushNotifications, setPushNotifications] = useState(true);

  // Load profile from Supabase on mount
  useEffect(() => {
    loadOutfitHistory();
    loadProfileData();
    loadFavorites();
  }, []);

  const loadProfileData = async () => {
    setSettingsStatus("loading");
    try {
      // Check if user is still authenticated before loading profile
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) {
        // User is not authenticated (likely signing out), skip loading
        setSettingsStatus("empty");
        return;
      }

      const profile = await getProfile();

      if (profile) {
        setName(profile.name || "");
        setEmail(profile.email || "");

        // Convert birth from YYYY-MM-DD to DD/MM/YYYY and Date object
        if (profile.birth) {
          const [year, month, day] = profile.birth.split("-");
          setBirth(`${day}/${month}/${year}`);
          setBirthDate(
            new Date(parseInt(year), parseInt(month) - 1, parseInt(day)),
          );
        } else {
          setBirth("");
          setBirthDate(null);
        }

        setGender(profile.gender || "");
        setLocation(profile.location || "");
        setHeight(profile.height?.toString() || "");
        setWeight(profile.weight?.toString() || "");
        setCurrency(profile.currency || "USD");
        setPriceMin(profile.price_min?.toString() || "");
        setPriceMax(profile.price_max?.toString() || "");
        setShirtSize(profile.shirt_size || "");
        setPantsSize(profile.pants_size || "");
        setShoeSize(profile.shoe_size || "");
        setFavoriteBrands(profile.favorite_brands?.join(", ") || "");
        setFavoriteStyles(profile.favorite_styles?.join(", ") || "");
        setLanguage(profile.language || "English");

        // Sync notification toggle with actual permission status
        const { status } = await Notifications.getPermissionsAsync();
        const hasPermission = status === "granted";
        setPushNotifications(
          hasPermission && (profile.push_notifications ?? true),
        );
        setSettingsStatus("ready");
      } else {
        setSettingsStatus("empty");
      }
    } catch (error) {
      console.error("Error loading profile:", error);
      setSettingsStatus("error");
    }
  };

  const loadFavorites = async () => {
    setFavoritesStatus("loading");
    try {
      const user = (await supabase.auth.getSession()).data.session?.user;

      if (!user) {
        setFavorites([]);
        setFavoritesStatus("ready");
        return;
      }

      const { data, error } = await supabase
        .from("favorite_products")
        .select("*")
        .eq("user_id", user.id)
        .order("favorited_at", { ascending: false });

      if (error) {
        throw error;
      }

      setFavorites(data || []);

      // Initialize favoriteItems Map with all items as favorited
      const favMap = new Map();
      (data || []).forEach((item) => {
        favMap.set(item.id, item.id); // Store database ID as value
      });
      setFavoriteItems(favMap);
      setFavoritesStatus("ready");
    } catch {
      setFavoritesStatus("error");
    }
  };

  const loadOutfitHistory = async () => {
    setLookbookStatus("loading");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      outfitPhotoHeadersRef.current = {
        Authorization: `Bearer ${session.access_token}`,
      };
      setOutfitHistory(await getOutfitHistory());
      setLookbookStatus("ready");
    } catch {
      setLookbookStatus("error");
    }
  };

  const handleLongPressAnalysis = (analysis) => {
    Alert.alert(
      "Delete analysis?",
      `"${analysis.outfit_name}" will be deleted from your Lookbook...`,
      [
        { style: "cancel", text: "Cancel" },
        {
          onPress: async () => {
            try {
              const { error } = await supabase
                .from("outfit_analyses")
                .delete()
                .eq("id", analysis.id);

              if (error) throw error;
              setOutfitHistory((history) =>
                history.filter((item) => item.id !== analysis.id),
              );
            } catch {
              Alert.alert(
                "Error",
                "Failed to delete analysis. Please try again.",
              );
            }
          },
          style: "destructive",
          text: "Delete",
        },
      ],
    );
  };

  // Predefined options
  const genderOptions = ["Male", "Female", "Other"];
  const currencyOptions = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD"];
  const languageOptions = ["English" /*, 'Spanish'*/];
  const shirtSizeOptions = ["XS", "S", "M", "L", "XL", "XXL"];
  const pantsSizeOptions = ["28", "30", "32", "34", "36", "38", "40", "42"];
  const shoeSizeOptions = ["6", "7", "8", "9", "10", "11", "12", "13"];

  // Birth date constraints (13-100 years old, same as onboarding)
  const maxBirthDate = new Date();
  maxBirthDate.setFullYear(maxBirthDate.getFullYear() - 13);
  const minBirthDate = new Date();
  minBirthDate.setFullYear(minBirthDate.getFullYear() - 100);

  // Format date for display (same as onboarding)
  const formatBirthDate = (date) => {
    if (!date) return "";
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  // Handle birth date change
  const handleBirthDateChange = (event, selectedDate) => {
    if (Platform.OS === "android") {
      setShowBirthPicker(false);
    }
    if (selectedDate) {
      setBirthDate(selectedDate);
      const day = String(selectedDate.getDate()).padStart(2, "0");
      const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
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
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== "granted") {
          // Permission denied - revert toggle and show alert
          setPushNotifications(false);
          Alert.alert(
            "Notifications Disabled",
            "To receive reminders, please enable notifications in Settings.",
            [
              { style: "cancel", text: "Cancel" },
              { onPress: () => Linking.openSettings(), text: "Open Settings" },
            ],
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
      const { status: existingStatus } =
        await Location.getForegroundPermissionsAsync();

      let hasPermission = existingStatus === "granted";

      if (!hasPermission) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        hasPermission = status === "granted";
      }

      if (!hasPermission) {
        setLoadingLocation(false);
        Alert.alert(
          "Location Access Required",
          "To auto-detect your location, please enable location permissions in Settings.",
          [
            { style: "cancel", text: "Cancel" },
            { onPress: () => Linking.openSettings(), text: "Open Settings" },
          ],
        );
        return;
      }

      // Get current location with 5 second timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 5000),
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
        const city = address.city || address.subregion || "";
        const country = address.country || "";
        const locationString =
          city && country ? `${city}, ${country}` : city || country || "";
        setLocation(locationString);
      }
    } catch (error) {
      console.error("Error getting location:", error);
      if (error.message === "timeout") {
        Alert.alert(
          "Timeout",
          "Location detection took too long. Please try again.",
        );
      } else {
        Alert.alert("Error", "Failed to get location. Please try again.");
      }
    } finally {
      setLoadingLocation(false);
    }
  };

  // Handle export data
  const handleExportData = async () => {
    Alert.alert(
      "Export Data",
      "To export your data, please contact us at contact@pablorubio.com with your account email. We will process your request within 24 hours.",
      [{ text: "OK" }],
    );
  };

  // Handle opening external links
  const handleOpenLink = async (url, title) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert("Error", `Unable to open ${title}`);
    }
  };

  // Handle save settings
  const handleSaveSettings = async () => {
    Keyboard.dismiss();

    try {
      setSaving(true);

      // Parse favorite styles from comma-separated string to array
      const stylesArray = favoriteStyles
        .split(",")
        .map((style) => style.trim())
        .filter((style) => style.length > 0);

      // Parse favorite brands from comma-separated string to array
      const brandsArray = favoriteBrands
        .split(",")
        .map((brand) => brand.trim())
        .filter((brand) => brand.length > 0);

      // Validate required fields
      if (!birthDate) {
        Alert.alert("Birth Date Required", "Please select your birth date.", [
          { text: "OK" },
        ]);
        setSaving(false);
        return;
      }

      if (!gender) {
        Alert.alert("Gender Required", "Please select your gender.", [
          { text: "OK" },
        ]);
        setSaving(false);
        return;
      }

      if (!height) {
        Alert.alert("Height Required", "Please enter your height.", [
          { text: "OK" },
        ]);
        setSaving(false);
        return;
      }

      if (!weight) {
        Alert.alert("Weight Required", "Please enter your weight.", [
          { text: "OK" },
        ]);
        setSaving(false);
        return;
      }

      if (!shirtSize) {
        Alert.alert("Shirt Size Required", "Please select your shirt size.", [
          { text: "OK" },
        ]);
        setSaving(false);
        return;
      }

      if (!pantsSize) {
        Alert.alert("Pants Size Required", "Please select your pants size.", [
          { text: "OK" },
        ]);
        setSaving(false);
        return;
      }

      if (!shoeSize) {
        Alert.alert("Shoe Size Required", "Please select your shoe size.", [
          { text: "OK" },
        ]);
        setSaving(false);
        return;
      }

      if (stylesArray.length === 0) {
        Alert.alert(
          "Favorite Styles Required",
          "Please enter at least one favorite style.",
          [{ text: "OK" }],
        );
        setSaving(false);
        return;
      }

      if (brandsArray.length === 0) {
        Alert.alert(
          "Favorite Brands Required",
          "Please enter at least one favorite brand.",
          [{ text: "OK" }],
        );
        setSaving(false);
        return;
      }

      // Validate height range
      const heightVal = parseInt(height);
      if (heightVal < 150 || heightVal > 250) {
        Alert.alert(
          "Invalid Height",
          "Please enter a height between 150 and 250 cm.",
          [{ text: "OK" }],
        );
        setSaving(false);
        return;
      }

      // Validate weight range
      const weightVal = parseInt(weight);
      if (weightVal < 50 || weightVal > 200) {
        Alert.alert(
          "Invalid Weight",
          "Please enter a weight between 50 and 200 kg.",
          [{ text: "OK" }],
        );
        setSaving(false);
        return;
      }

      // Validate price range (required)
      if (!priceMin || !priceMax) {
        Alert.alert(
          "Price Range Required",
          "Please enter both minimum and maximum price.",
          [{ text: "OK" }],
        );
        setSaving(false);
        return;
      }

      const minPrice = parseInt(priceMin);
      const maxPrice = parseInt(priceMax);

      if (minPrice >= maxPrice) {
        Alert.alert(
          "Invalid Price Range",
          "Minimum price must be less than maximum price.",
          [{ text: "OK" }],
        );
        setSaving(false);
        return;
      }

      // Format birth date as YYYY-MM-DD for database
      let birthForDb = null;
      if (birthDate) {
        const year = birthDate.getFullYear();
        const month = String(birthDate.getMonth() + 1).padStart(2, "0");
        const day = String(birthDate.getDate()).padStart(2, "0");
        birthForDb = `${year}-${month}-${day}`;
      }

      await updateProfile({
        birth: birthForDb,
        currency,
        favorite_brands: brandsArray,
        favorite_styles: stylesArray,
        gender: gender || null,
        height: height ? parseInt(height) : null,
        language,
        location: location || null,
        pants_size: pantsSize || null,
        price_max: priceMax ? parseInt(priceMax) : null,
        price_min: priceMin ? parseInt(priceMin) : null,
        push_notifications: pushNotifications,
        shirt_size: shirtSize || null,
        shoe_size: shoeSize || null,
        weight: weight ? parseInt(weight) : null,
      });

      Alert.alert(
        "Settings Saved",
        "Your preferences have been updated successfully.",
        [{ text: "OK" }],
      );
    } catch (error) {
      console.error("Error saving settings:", error);
      Alert.alert("Error", "Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Handle sign out
  const handleSignOut = async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { style: "cancel", text: "Cancel" },
      {
        onPress: async () => {
          try {
            await supabase.auth.signOut();
            // Manually switch to auth stack
            switchToAuthStack();
          } catch (error) {
            console.error("Error signing out:", error);
            Alert.alert("Error", "Failed to sign out. Please try again.");
          }
        },
        style: "destructive",
        text: "Sign Out",
      },
    ]);
  };

  // Handle delete account
  const handleDeleteAccount = async () => {
    if (deletingAccountRef.current || deletingAccount) return;

    Alert.alert(
      "Delete Account",
      "Are you sure you want to permanently delete your account?",
      [
        { style: "cancel", text: "Cancel" },
        {
          onPress: performDeleteAccount,
          style: "destructive",
          text: "Delete",
        },
      ],
    );
  };

  async function performDeleteAccount() {
    if (deletingAccountRef.current || deletingAccount) return;

    try {
      deletingAccountRef.current = true;
      setDeletingAccount(true);
      await update({ email: null, name: null });
      await deleteAccount();
      await supabase.auth.signOut({ scope: "local" });

      switchToAuthStack();

      await new Promise((resolve) => setTimeout(resolve, 1000));

      Alert.alert(
        "Account Deleted",
        "Your Snazzy AI account has been deleted. If you have an active subscription, deleting your account does not cancel billing. Manage or cancel subscriptions through your settings.",
      );
    } catch (error) {
      console.error("Error deleting account:", error);
      deletingAccountRef.current = false;
      setDeletingAccount(false);
      Alert.alert("Error", "Failed to delete account. Please try again.");
    }
  }

  // Reset settings to saved values (discard unsaved changes)
  const resetSettings = async () => {
    setShowBirthPicker(false);
    await loadProfileData();
  };

  const resetDiscover = () => {
    discoverRequestRef.current.id += 1;
    discoverRequestRef.current.controller?.abort();
    discoverRequestRef.current.controller = null;
    setDiscover(INITIAL_DISCOVER_STATE);
    Keyboard.dismiss();
  };

  const runDiscoverSearch = async (searchPrompt) => {
    discoverRequestRef.current.controller?.abort();

    const controller = new AbortController();
    const requestId = discoverRequestRef.current.id + 1;
    discoverRequestRef.current = { controller, id: requestId };
    setDiscover((current) => ({ ...current, products: [], status: "loading" }));

    try {
      let userProfile = null;
      try {
        userProfile = await getProfile();
      } catch {
        // Match CameraScreen: search still works with default preferences.
      }

      if (discoverRequestRef.current.id !== requestId) return;

      const { data, error } = await supabase.functions.invoke(
        "discover-products",
        {
          body: { prompt: searchPrompt, userProfile },
          signal: controller.signal,
        },
      );

      if (error) throw error;
      if (!Array.isArray(data?.products))
        throw new Error("Invalid product search response");
      if (discoverRequestRef.current.id !== requestId) return;

      setDiscover((current) => ({
        ...current,
        products: data.products.slice(0, 10),
        status: "success",
      }));
    } catch (error) {
      if (
        controller.signal.aborted ||
        discoverRequestRef.current.id !== requestId
      )
        return;
      setDiscover((current) => ({ ...current, status: "error" }));
    } finally {
      if (discoverRequestRef.current.id === requestId) {
        discoverRequestRef.current.controller = null;
      }
    }
  };

  const handleDiscoverSubmit = () => {
    Keyboard.dismiss();
    if (!canSearchDiscover) return;

    const trimmedPrompt = discover.prompt.trim();
    if (!trimmedPrompt) {
      setDiscover((current) => ({
        ...current,
        validationError: "Enter a clothing product to search for.",
      }));
      return;
    }

    setDiscover((current) => ({
      ...current,
      prompt: trimmedPrompt,
      validationError: "",
    }));
    runDiscoverSearch(trimmedPrompt);
  };

  const handleTabPress = async (tabName) => {
    if (
      activeTab === "discover" &&
      tabName !== "discover" &&
      tabName !== "add"
    ) {
      resetDiscover();
    }

    // If switching to home tab, reload favorites
    if (tabName === "home" && activeTab !== "home") {
      loadFavorites();
    }

    // If leaving settings tab, reset unsaved changes
    if (activeTab === "settings" && tabName !== "settings") {
      resetSettings();
    }

    if (tabName === "lookbook" && activeTab !== "lookbook") {
      loadOutfitHistory();
    }

    if (
      tabName === "settings" &&
      activeTab !== "settings" &&
      settingsStatus !== "loading"
    ) {
      loadProfileData();
    }

    if (tabName === "add") {
      const requestAccessPaywall = () => {
        if (subscriptionStatus?.status === "ACTIVE") {
          navigation.navigate("Camera");
          return;
        }

        if (Platform.OS === "android") {
          navigation.navigate("Camera");
          return;
        }

        return registerCameraPlacement({
          placement: "campaign_trigger",
        });
      };

      // Check camera permission before navigating
      if (cameraPermission?.granted) {
        await requestAccessPaywall();
      } else {
        // Request permission
        const result = await requestCameraPermission();
        if (result.granted) {
          await requestAccessPaywall();
        } else {
          // Permission denied - show alert with Settings option
          Alert.alert(
            "Camera Access Required",
            "SnazzyAI needs camera access to analyze your outfits. Please enable camera permissions in Settings.",
            [
              { style: "cancel", text: "Cancel" },
              { onPress: () => Linking.openSettings(), text: "Open Settings" },
            ],
          );
        }
      }
    } else {
      setActiveTab(tabName);
    }
  };

  // Handle toggling favorite (like CameraScreen)
  const handleToggleFavorite = async (item, itemId = item.id) => {
    const isFavorited = favoriteItems.has(itemId);
    const dbUuid = favoriteItems.get(itemId);

    // Optimistically update UI
    setFavoriteItems((prevFavorites) => {
      const newFavorites = new Map(prevFavorites);
      if (isFavorited) {
        newFavorites.delete(itemId);
      } else {
        newFavorites.set(itemId, "pending"); // Temporary until we get the UUID
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
          brand: item.brand,
          category: item.category || "other",
          description: item.description,
          imageUrl: item.imageUrl || item.image_url,
          name: item.name,
          price: item.price,
          purchaseUrl: item.purchaseUrl || item.purchase_url,
        });
        // Update with actual database UUID
        setFavoriteItems((prevFavorites) => {
          const newFavorites = new Map(prevFavorites);
          newFavorites.set(itemId, newDbUuid);
          return newFavorites;
        });
      }
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
      // Revert optimistic update on error
      setFavoriteItems((prevFavorites) => {
        const newFavorites = new Map(prevFavorites);
        if (isFavorited) {
          newFavorites.set(itemId, dbUuid); // Restore with original UUID
        } else {
          newFavorites.delete(itemId);
        }
        return newFavorites;
      });
      Alert.alert("Error", "Failed to update favorite");
    }
  };

  // Handle internal tab switching - scroll main view to top
  useEffect(() => {
    scrollViewRef.current?.scrollTo({ animated: false, y: 0 });
  }, [activeTab]);

  // Handle screen navigation - reset before leaving to prevent glitches on return
  useEffect(() => {
    const unsubscribeBlur = navigation.addListener("blur", () => {
      // Reset everything when leaving the screen (e.g., going to Camera)
      // This happens before navigation, so no glitch when returning
      scrollViewRef.current?.scrollTo({ animated: false, y: 0 });
      shirtsScrollRef.current?.scrollTo({ animated: false, x: 0 });
      pantsScrollRef.current?.scrollTo({ animated: false, x: 0 });
      shoesScrollRef.current?.scrollTo({ animated: false, x: 0 });
      otherScrollRef.current?.scrollTo({ animated: false, x: 0 });
      if (activeTab === "discover") resetDiscover();
    });

    const unsubscribeFocus = navigation.addListener("focus", () => {
      // Reload favorites when returning to HomeScreen (e.g., from Camera)
      if (activeTab === "home") {
        loadFavorites();
      }
      if (activeTab === "lookbook") {
        loadOutfitHistory();
      }
    });

    // Cleanup listeners when component unmounts
    return () => {
      unsubscribeBlur();
      unsubscribeFocus();
      if (activeTab === "discover") {
        discoverRequestRef.current.id += 1;
        discoverRequestRef.current.controller?.abort();
        discoverRequestRef.current.controller = null;
      }
    };
  }, [navigation, activeTab]);

  return (
    <LinearGradient
      colors={["#fef9f3", "#f5f3f1", "#ffffff"]}
      locations={[0, 0.5, 1]}
      style={styles.container}
    >
      {/* Main content area - currently empty */}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        style={styles.contentContainer}
      >
        {activeTab === "home" && (
          <View>
            <View style={styles.logoContainer}>
              <Image
                resizeMode="contain"
                source={require("../../assets/logo3-transparent.png")}
                style={styles.logo}
              />
            </View>

            {/* Sections Container */}
            <View
              style={[
                styles.sectionsContainer,
                (favoritesStatus !== "ready" || favorites.length === 0) && {
                  marginTop: -35,
                },
              ]}
            >
              {favoritesStatus === "loading" ? (
                <View style={styles.emptyContainer}>
                  <ActivityIndicator color="#007AFF" size="small" />
                </View>
              ) : favorites.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons color="#ccc" name="heart-outline" size={48} />
                  <Text style={styles.emptyText}>No favorites yet</Text>
                </View>
              ) : favoritesStatus === "error" ? (
                <View style={styles.emptyContainer}>
                  <Ionicons
                    color="#ccc"
                    name="alert-circle-outline"
                    size={48}
                  />
                  <Text style={styles.emptyText}>
                    {"Couldn't load favorites"}
                  </Text>
                </View>
              ) : (
                <>
                  {/* Shirts Section */}
                  {favorites.filter((item) => item.category === "shirts")
                    .length > 0 && (
                    <View style={styles.sectionContainer}>
                      <Text style={styles.sectionTitle}>Favourite Tops</Text>
                      <ScrollView
                        bounces={false}
                        contentContainerStyle={styles.horizontalScrollContent}
                        horizontal
                        overScrollMode="never"
                        ref={shirtsScrollRef}
                        showsHorizontalScrollIndicator={false}
                      >
                        {favorites
                          .filter((item) => item.category === "shirts")
                          .map((item, index, arr) => {
                            const isFavorited = favoriteItems.has(item.id);
                            return (
                              <TouchableOpacity
                                activeOpacity={0.8}
                                key={item.id}
                                onPress={() =>
                                  handleOpenLink(item.purchase_url, item.name)
                                }
                                style={[
                                  styles.recommendationCard,
                                  index !== arr.length - 1 &&
                                    styles.cardMarginRight,
                                ]}
                              >
                                <View
                                  style={styles.recommendationImageContainer}
                                >
                                  <Image
                                    resizeMode="cover"
                                    source={{
                                      uri:
                                        item.image_url ||
                                        "https://via.placeholder.com/150",
                                    }}
                                    style={styles.recommendationImage}
                                  />
                                  <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={() => handleToggleFavorite(item)}
                                    style={styles.heartButton}
                                  >
                                    <Ionicons
                                      color={isFavorited ? "#FF3B30" : "#999"}
                                      name={
                                        isFavorited ? "heart" : "heart-outline"
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
                          })}
                      </ScrollView>
                    </View>
                  )}

                  {/* Pants Section */}
                  {favorites.filter((item) => item.category === "pants")
                    .length > 0 && (
                    <View style={styles.sectionContainer}>
                      <Text style={styles.sectionTitle}>Favourite Pants</Text>
                      <ScrollView
                        bounces={false}
                        contentContainerStyle={styles.horizontalScrollContent}
                        horizontal
                        overScrollMode="never"
                        ref={pantsScrollRef}
                        showsHorizontalScrollIndicator={false}
                      >
                        {favorites
                          .filter((item) => item.category === "pants")
                          .map((item, index, arr) => {
                            const isFavorited = favoriteItems.has(item.id);
                            return (
                              <TouchableOpacity
                                activeOpacity={0.8}
                                key={item.id}
                                onPress={() =>
                                  handleOpenLink(item.purchase_url, item.name)
                                }
                                style={[
                                  styles.recommendationCard,
                                  index !== arr.length - 1 &&
                                    styles.cardMarginRight,
                                ]}
                              >
                                <View
                                  style={styles.recommendationImageContainer}
                                >
                                  <Image
                                    resizeMode="cover"
                                    source={{
                                      uri:
                                        item.image_url ||
                                        "https://via.placeholder.com/150",
                                    }}
                                    style={styles.recommendationImage}
                                  />
                                  <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={() => handleToggleFavorite(item)}
                                    style={styles.heartButton}
                                  >
                                    <Ionicons
                                      color={isFavorited ? "#FF3B30" : "#999"}
                                      name={
                                        isFavorited ? "heart" : "heart-outline"
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
                          })}
                      </ScrollView>
                    </View>
                  )}

                  {/* Shoes Section */}
                  {favorites.filter((item) => item.category === "shoes")
                    .length > 0 && (
                    <View style={styles.sectionContainer}>
                      <Text style={styles.sectionTitle}>Favourite Shoes</Text>
                      <ScrollView
                        bounces={false}
                        contentContainerStyle={styles.horizontalScrollContent}
                        horizontal
                        overScrollMode="never"
                        ref={shoesScrollRef}
                        showsHorizontalScrollIndicator={false}
                      >
                        {favorites
                          .filter((item) => item.category === "shoes")
                          .map((item, index, arr) => {
                            const isFavorited = favoriteItems.has(item.id);
                            return (
                              <TouchableOpacity
                                activeOpacity={0.8}
                                key={item.id}
                                onPress={() =>
                                  handleOpenLink(item.purchase_url, item.name)
                                }
                                style={[
                                  styles.recommendationCard,
                                  index !== arr.length - 1 &&
                                    styles.cardMarginRight,
                                ]}
                              >
                                <View
                                  style={styles.recommendationImageContainer}
                                >
                                  <Image
                                    resizeMode="cover"
                                    source={{
                                      uri:
                                        item.image_url ||
                                        "https://via.placeholder.com/150",
                                    }}
                                    style={styles.recommendationImage}
                                  />
                                  <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={() => handleToggleFavorite(item)}
                                    style={styles.heartButton}
                                  >
                                    <Ionicons
                                      color={isFavorited ? "#FF3B30" : "#999"}
                                      name={
                                        isFavorited ? "heart" : "heart-outline"
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
                          })}
                      </ScrollView>
                    </View>
                  )}

                  {/* Other Section */}
                  {favorites.filter((item) => item.category === "other")
                    .length > 0 && (
                    <View style={styles.sectionContainer}>
                      <Text style={styles.sectionTitle}>Favourite Other</Text>
                      <ScrollView
                        bounces={false}
                        contentContainerStyle={styles.horizontalScrollContent}
                        horizontal
                        overScrollMode="never"
                        ref={otherScrollRef}
                        showsHorizontalScrollIndicator={false}
                      >
                        {favorites
                          .filter((item) => item.category === "other")
                          .map((item, index, arr) => {
                            const isFavorited = favoriteItems.has(item.id);
                            return (
                              <TouchableOpacity
                                activeOpacity={0.8}
                                key={item.id}
                                onPress={() =>
                                  handleOpenLink(item.purchase_url, item.name)
                                }
                                style={[
                                  styles.recommendationCard,
                                  index !== arr.length - 1 &&
                                    styles.cardMarginRight,
                                ]}
                              >
                                <View
                                  style={styles.recommendationImageContainer}
                                >
                                  <Image
                                    resizeMode="cover"
                                    source={{
                                      uri:
                                        item.image_url ||
                                        "https://via.placeholder.com/150",
                                    }}
                                    style={styles.recommendationImage}
                                  />
                                  <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={() => handleToggleFavorite(item)}
                                    style={styles.heartButton}
                                  >
                                    <Ionicons
                                      color={isFavorited ? "#FF3B30" : "#999"}
                                      name={
                                        isFavorited ? "heart" : "heart-outline"
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
                          })}
                      </ScrollView>
                    </View>
                  )}
                </>
              )}
            </View>
          </View>
        )}
        {activeTab === "lookbook" && (
          <View style={styles.settingsContainer}>
            <View style={[styles.settingsHeader, styles.lookbookHeader]}>
              <Text style={styles.settingsTitle}>Lookbook</Text>
            </View>

            {lookbookStatus === "loading" ? (
              <View style={styles.emptyContainer}>
                <ActivityIndicator color="#007AFF" size="small" />
              </View>
            ) : outfitHistory.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons color="#ccc" name="layers-outline" size={48} />
                <Text style={styles.emptyText}>No saved looks yet</Text>
              </View>
            ) : lookbookStatus === "error" ? (
              <View style={styles.emptyContainer}>
                <Ionicons color="#ccc" name="alert-circle-outline" size={48} />
                <Text style={styles.emptyText}>{"Couldn't load lookbook"}</Text>
              </View>
            ) : (
              outfitHistory.map((analysis) => (
                <TouchableOpacity
                  activeOpacity={0.8}
                  key={analysis.id}
                  onLongPress={() => handleLongPressAnalysis(analysis)}
                  style={[styles.recommendationCard, styles.lookbookCard]}
                >
                  <View style={styles.lookbookImageContainer}>
                    <Image
                      resizeMode="cover"
                      source={{
                        headers: outfitPhotoHeadersRef.current,
                        uri: analysis.photo_url?.replace(
                          "/object/public/",
                          "/object/",
                        ),
                      }}
                      style={styles.lookbookImage}
                    />
                    <Text style={styles.lookbookTitle}>
                      {analysis.outfit_name}
                    </Text>
                  </View>
                  <View style={styles.lookbookContent}>
                    <View style={styles.lookbookMeta}>
                      <Text style={styles.lookbookDate}>
                        {new Date(analysis.analyzed_at).toLocaleDateString()}
                      </Text>
                      <Text style={styles.recommendationBrand}>
                        {analysis.rating == null
                          ? "Not rated"
                          : `⭐ ${analysis.rating}/10`}
                      </Text>
                    </View>
                    <Text style={styles.recommendationDescription}>
                      {analysis.short_description}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
        {activeTab === "discover" && (
          <View style={styles.settingsContainer}>
            <View style={[styles.settingsHeader, styles.lookbookHeader]}>
              <Text style={styles.settingsTitle}>Discover</Text>
            </View>

            <View style={styles.discoverSearchCard}>
              <View style={styles.discoverSearchRow}>
                <View style={styles.discoverInputContainer}>
                  <TextInput
                    editable={canSearchDiscover}
                    multiline={false}
                    numberOfLines={1}
                    onChangeText={(value) => {
                      setDiscover((current) => ({
                        ...current,
                        prompt: value,
                        validationError: "",
                      }));
                    }}
                    onSubmitEditing={handleDiscoverSubmit}
                    placeholder="Search clothing products"
                    placeholderTextColor="#999"
                    returnKeyType="search"
                    style={[styles.settingsInput, styles.discoverSearchInput]}
                    value={discover.prompt}
                  />
                </View>

                <TouchableOpacity
                  activeOpacity={0.7}
                  disabled={discover.status === "loading" || !canSearchDiscover}
                  onPress={handleDiscoverSubmit}
                  style={[
                    styles.discoverSearchButton,
                    discover.status === "loading" &&
                      styles.discoverButtonDisabled,
                    !canSearchDiscover && styles.discoverButtonLocked,
                  ]}
                >
                  {discover.status === "loading" ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Ionicons color="#fff" name="search" size={21} />
                  )}
                </TouchableOpacity>
              </View>
              {!!discover.validationError && (
                <Text style={styles.discoverValidationText}>
                  {discover.validationError}
                </Text>
              )}
              <Text style={styles.discoverSearchTipText}>
                💡 Try: brand + gender + color + item{`\n`}
                {"(Ralph Lauren men's navy quarter zip)"}
              </Text>
            </View>

            {discover.status === "error" && (
              <View
                style={[styles.emptyContainer, styles.discoverStateContainer]}
              >
                <Ionicons color="#ccc" name="alert-circle-outline" size={48} />
                <Text style={styles.emptyText}>
                  {"Couldn't load discovery"}
                </Text>
              </View>
            )}

            {discover.status === "success" &&
              discover.products.length === 0 && (
                <View
                  style={[styles.emptyContainer, styles.discoverStateContainer]}
                >
                  <Ionicons color="#ccc" name="basket-outline" size={48} />
                  <Text style={styles.emptyText}>No products found</Text>
                </View>
              )}

            {discover.products.map((item, index) => {
              const itemId = getDiscoverProductKey(item, index);
              const isFavorited = favoriteItems.has(itemId);
              return (
                <TouchableOpacity
                  activeOpacity={0.8}
                  key={`${itemId}-${index}`}
                  onPress={() => handleOpenLink(item.purchaseUrl, item.name)}
                  style={[
                    styles.recommendationCard,
                    styles.discoverProductCard,
                  ]}
                >
                  <View style={styles.recommendationImageContainer}>
                    <Image
                      resizeMode="cover"
                      source={{
                        uri: item.imageUrl || "https://via.placeholder.com/150",
                      }}
                      style={styles.recommendationImage}
                    />
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => handleToggleFavorite(item, itemId)}
                      style={styles.heartButton}
                    >
                      <Ionicons
                        color={isFavorited ? "#FF3B30" : "#999"}
                        name={isFavorited ? "heart" : "heart-outline"}
                        size={24}
                      />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.recommendationContent}>
                    <Text numberOfLines={1} style={styles.recommendationName}>
                      {item.name}
                    </Text>
                    <Text numberOfLines={1} style={styles.recommendationBrand}>
                      {item.brand}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={styles.recommendationDescription}
                    >
                      {item.description}
                    </Text>
                    <Text style={styles.recommendationPrice}>{item.price}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        {activeTab === "settings" && (
          <View style={styles.settingsContainer}>
            <View style={styles.settingsHeader}>
              <Text style={styles.settingsTitle}>Settings</Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleSignOut}
                style={styles.signOutButton}
              >
                <Ionicons color="#3a3b3c" name="log-out-outline" size={24} />
              </TouchableOpacity>
            </View>

            {settingsStatus === "loading" ? (
              <View style={styles.emptyContainer}>
                <ActivityIndicator color="#007AFF" size="small" />
              </View>
            ) : settingsStatus === "empty" ? (
              <View style={styles.emptyContainer}>
                <Ionicons color="#ccc" name="person-outline" size={48} />
                <Text style={styles.emptyText}>No profile ID found</Text>
              </View>
            ) : settingsStatus === "error" ? (
              <View style={styles.emptyContainer}>
                <Ionicons color="#ccc" name="alert-circle-outline" size={48} />
                <Text style={styles.emptyText}>{"Couldn't load settings"}</Text>
              </View>
            ) : (
              <>
                {/* Personal Information Section */}
                <View style={styles.settingsSection}>
                  <Text style={styles.settingsSectionTitle}>
                    Personal Information
                  </Text>

                  <View style={styles.settingsCard}>
                    <Text style={styles.settingsLabel}>Name</Text>
                    <View style={[styles.settingsInput, styles.locationRow]}>
                      <Text
                        ellipsizeMode="tail"
                        numberOfLines={1}
                        style={[
                          styles.locationText,
                          !name && { color: "#999" },
                        ]}
                      >
                        {name || "Enter your name"}
                      </Text>
                      <Ionicons
                        color="#999"
                        name="person-outline"
                        size={24}
                        style={{ marginLeft: 8 }}
                      />
                    </View>
                  </View>

                  <View style={styles.settingsCard}>
                    <Text style={styles.settingsLabel}>Email</Text>
                    <View style={[styles.settingsInput, styles.locationRow]}>
                      <Text
                        ellipsizeMode="tail"
                        numberOfLines={1}
                        style={[
                          styles.locationText,
                          !email && { color: "#999" },
                        ]}
                      >
                        {email || "Enter your email"}
                      </Text>
                      <Ionicons
                        color="#999"
                        name="mail-outline"
                        size={24}
                        style={{ marginLeft: 8 }}
                      />
                    </View>
                  </View>

                  <View style={styles.settingsCard}>
                    <Text style={styles.settingsLabel}>Birth</Text>
                    <View style={[styles.settingsInput, styles.locationRow]}>
                      <Text
                        ellipsizeMode="tail"
                        numberOfLines={1}
                        style={[
                          styles.locationText,
                          !birthDate && { color: "#999" },
                        ]}
                      >
                        {formatBirthDate(birthDate) || "DD/MM/YYYY"}
                      </Text>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => setShowBirthPicker(!showBirthPicker)}
                      >
                        <Ionicons
                          color="#007AFF"
                          name="calendar-outline"
                          size={24}
                          style={{ marginLeft: 8 }}
                        />
                      </TouchableOpacity>
                    </View>
                    {showBirthPicker && (
                      <DateTimePicker
                        display={Platform.OS === "ios" ? "spinner" : "default"}
                        maximumDate={maxBirthDate}
                        minimumDate={minBirthDate}
                        mode="date"
                        onChange={handleBirthDateChange}
                        style={styles.datePicker}
                        value={birthDate || maxBirthDate}
                      />
                    )}
                  </View>

                  <View style={styles.settingsCard}>
                    <Text style={styles.settingsLabel}>Gender</Text>
                    <View style={styles.styleChipsContainer}>
                      {genderOptions.map((option) => (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          key={option}
                          onPress={() => selectGender(option)}
                          style={[
                            styles.styleChip,
                            gender === option && styles.styleChipSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.styleChipText,
                              gender === option && styles.styleChipTextSelected,
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
                        ellipsizeMode="tail"
                        numberOfLines={1}
                        style={[
                          styles.locationText,
                          !location && { color: "#999" },
                        ]}
                      >
                        {location || "City, Country"}
                      </Text>
                      <TouchableOpacity
                        activeOpacity={0.7}
                        disabled={loadingLocation}
                        onPress={handleUpdateLocation}
                      >
                        {loadingLocation ? (
                          <ActivityIndicator color="#007AFF" size="small" />
                        ) : (
                          <Ionicons
                            color="#007AFF"
                            name="locate"
                            size={24}
                            style={{ marginLeft: 8 }}
                          />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.settingsCard}>
                    <Text style={styles.settingsLabel}>Height (cm)</Text>
                    <View style={styles.measurementInputWrapper}>
                      <TextInput
                        keyboardType="number-pad"
                        maxLength={3}
                        onChangeText={(text) =>
                          setHeight(text.replace(/[^0-9]/g, ""))
                        }
                        placeholder="Enter your height"
                        placeholderTextColor="#999"
                        style={styles.measurementInput}
                        value={height}
                      />
                      {height && cmToFt(parseInt(height)) && (
                        <Text style={styles.conversionText}>
                          ≈ {cmToFt(parseInt(height))}
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.settingsCard}>
                    <Text style={styles.settingsLabel}>Weight (kg)</Text>
                    <View style={styles.measurementInputWrapper}>
                      <TextInput
                        keyboardType="number-pad"
                        maxLength={3}
                        onChangeText={(text) =>
                          setWeight(text.replace(/[^0-9]/g, ""))
                        }
                        placeholder="Enter your weight"
                        placeholderTextColor="#999"
                        style={styles.measurementInput}
                        value={weight}
                      />
                      {weight && kgToLb(parseInt(weight)) && (
                        <Text style={styles.conversionText}>
                          ≈ {kgToLb(parseInt(weight))}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>

                {/* Shopping Preferences Section */}
                <View style={styles.settingsSection}>
                  <Text style={styles.settingsSectionTitle}>
                    Shopping Preferences
                  </Text>

                  <View style={styles.settingsCard}>
                    <Text style={styles.settingsLabel}>Currency</Text>
                    <View style={styles.styleChipsContainer}>
                      {currencyOptions.map((curr) => (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          key={curr}
                          onPress={() => selectCurrency(curr)}
                          style={[
                            styles.styleChip,
                            styles.currencyChip,
                            currency === curr && styles.styleChipSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.styleChipText,
                              currency === curr && styles.styleChipTextSelected,
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
                        <Text style={styles.pricePrefix}>
                          {currency === "USD"
                            ? "$"
                            : currency === "EUR"
                              ? "€"
                              : currency === "GBP"
                                ? "£"
                                : currency === "JPY"
                                  ? "¥"
                                  : "$"}
                        </Text>
                        <TextInput
                          keyboardType="number-pad"
                          maxLength={5}
                          onChangeText={(text) =>
                            setPriceMin(text.replace(/[^0-9]/g, ""))
                          }
                          placeholder="Min"
                          placeholderTextColor="#999"
                          style={styles.priceInput}
                          value={priceMin}
                        />
                      </View>
                      <Text style={styles.priceSeparator}>—</Text>
                      <View style={styles.priceInputWrapper}>
                        <Text style={styles.pricePrefix}>
                          {currency === "USD"
                            ? "$"
                            : currency === "EUR"
                              ? "€"
                              : currency === "GBP"
                                ? "£"
                                : currency === "JPY"
                                  ? "¥"
                                  : "$"}
                        </Text>
                        <TextInput
                          keyboardType="number-pad"
                          maxLength={5}
                          onChangeText={(text) =>
                            setPriceMax(text.replace(/[^0-9]/g, ""))
                          }
                          placeholder="Max"
                          placeholderTextColor="#999"
                          style={styles.priceInput}
                          value={priceMax}
                        />
                      </View>
                    </View>
                  </View>

                  <View style={styles.settingsCard}>
                    <Text style={styles.settingsLabel}>Shirt Size</Text>
                    <View style={styles.styleChipsContainer}>
                      {shirtSizeOptions.map((size) => (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          key={size}
                          onPress={() => selectShirtSize(size)}
                          style={[
                            styles.sizeChip,
                            styles.styleChip,
                            shirtSize === size && styles.styleChipSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.styleChipText,
                              shirtSize === size &&
                                styles.styleChipTextSelected,
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
                          activeOpacity={0.7}
                          key={size}
                          onPress={() => selectPantsSize(size)}
                          style={[
                            styles.sizeChip,
                            styles.styleChip,
                            pantsSize === size && styles.styleChipSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.styleChipText,
                              pantsSize === size &&
                                styles.styleChipTextSelected,
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
                          activeOpacity={0.7}
                          key={size}
                          onPress={() => selectShoeSize(size)}
                          style={[
                            styles.sizeChip,
                            styles.styleChip,
                            shoeSize === size && styles.styleChipSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.styleChipText,
                              shoeSize === size && styles.styleChipTextSelected,
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
                      autoCapitalize="words"
                      blurOnSubmit={true}
                      maxLength={100}
                      multiline

                      numberOfLines={3}
                      onBlur={() =>
                        setFavoriteStyles(favoriteStyles.replace(/[,\s]+$/, ""))
                      }
                      onChangeText={(text) => {
                        // Allow only letters, spaces, commas, and hyphens
                        let filtered = text.replace(/[^a-zA-Z\s,]/g, "");

                        // Remove leading commas and spaces
                        filtered = filtered.replace(/^[,\s]+/, "");

                        // Collapse multiple spaces into one
                        filtered = filtered.replace(/\s+/g, " ");

                        // Collapse multiple commas into one
                        filtered = filtered.replace(/,+/g, ",");

                        // Remove spaces before commas
                        filtered = filtered.replace(/\s+,/g, ",");

                        // Ensure comma is always followed by a space
                        filtered = filtered.replace(/,(?!\s)/g, ", ");

                        setFavoriteStyles(filtered);
                      }}
                      placeholder="e.g., Old Money style"
                      placeholderTextColor="#999"
                      style={[styles.settingsInput, styles.textAreaInput]}
                      textAlignVertical="top"
                      value={favoriteStyles}
                    />
                  </View>

                  <View style={styles.settingsCard}>
                    <Text style={styles.settingsLabel}>Favorite Brands</Text>
                    <TextInput
                      autoCapitalize="words"
                      blurOnSubmit={true}
                      maxLength={100}
                      multiline

                      numberOfLines={3}
                      onBlur={() =>
                        setFavoriteBrands(favoriteBrands.replace(/[,\s]+$/, ""))
                      }
                      onChangeText={(text) => {
                        // Allow only letters, spaces, and commas
                        let filtered = text.replace(/[^a-zA-Z\s,]/g, "");

                        // Remove leading commas and spaces
                        filtered = filtered.replace(/^[,\s]+/, "");

                        // Collapse multiple spaces into one
                        filtered = filtered.replace(/\s+/g, " ");

                        // Collapse multiple commas into one
                        filtered = filtered.replace(/,+/g, ",");

                        // Remove spaces before commas
                        filtered = filtered.replace(/\s+,/g, ",");

                        // Ensure comma is always followed by a space
                        filtered = filtered.replace(/,(?!\s)/g, ", ");

                        setFavoriteBrands(filtered);
                      }}
                      placeholder="e.g., Nike, Adidas, Zara"
                      placeholderTextColor="#999"
                      style={[styles.settingsInput, styles.textAreaInput]}
                      textAlignVertical="top"
                      value={favoriteBrands}
                    />
                  </View>
                </View>

                {/* General Device Settings Section */}
                <View style={styles.settingsSection}>
                  <Text style={styles.settingsSectionTitle}>
                    General Device Settings
                  </Text>

                  <View style={styles.settingsCard}>
                    <Text style={styles.settingsLabel}>Language</Text>
                    <View style={styles.styleChipsContainer}>
                      {languageOptions.map((lang) => (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          key={lang}
                          onPress={() => selectLanguage(lang)}
                          style={[
                            styles.styleChip,
                            language === lang && styles.styleChipSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.styleChipText,
                              language === lang && styles.styleChipTextSelected,
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
                        <Text style={styles.settingsLabel}>
                          Push Notifications
                        </Text>
                        <Text style={styles.toggleDescription}>
                          Receive useful reminders
                        </Text>
                      </View>
                      <Switch
                        onValueChange={handleNotificationToggle}
                        thumbColor="#fff"
                        trackColor={{ false: "#f0f0f0", true: "#007AFF" }}
                        value={pushNotifications}
                      />
                    </View>
                  </View>
                </View>

                {/* Data & Privacy Section */}
                <View style={styles.settingsSection}>
                  <Text style={styles.settingsSectionTitle}>
                    Data & Privacy Controls
                  </Text>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() =>
                      handleOpenLink(
                        "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/",
                        "Terms of Use",
                      )
                    }
                    style={styles.linkCard}
                  >
                    <View style={styles.linkCardContent}>
                      <Ionicons
                        color="#007AFF"
                        name="document-text-outline"
                        size={20}
                        style={styles.linkCardIcon}
                      />
                      <Text style={styles.linkCardText}>Terms of Use</Text>
                    </View>
                    <Ionicons color="#999" name="chevron-forward" size={20} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() =>
                      handleOpenLink(
                        "https://snazzyai.app/privacy/",
                        "Privacy Policy",
                      )
                    }
                    style={styles.linkCard}
                  >
                    <View style={styles.linkCardContent}>
                      <Ionicons
                        color="#007AFF"
                        name="shield-checkmark-outline"
                        size={20}
                        style={styles.linkCardIcon}
                      />
                      <Text style={styles.linkCardText}>Privacy Policy</Text>
                    </View>
                    <Ionicons color="#999" name="chevron-forward" size={20} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleExportData}
                    style={styles.linkCard}
                  >
                    <View style={styles.linkCardContent}>
                      <Ionicons
                        color="#007AFF"
                        name="download-outline"
                        size={20}
                        style={styles.linkCardIcon}
                      />
                      <Text style={styles.linkCardText}>Export My Data</Text>
                    </View>
                    <Ionicons color="#999" name="chevron-forward" size={20} />
                  </TouchableOpacity>
                </View>

                {/* Action Buttons */}
                <View style={styles.settingsActions}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    disabled={saving}
                    onPress={handleSaveSettings}
                    style={[
                      styles.saveButton,
                      saving && styles.saveButtonDisabled,
                    ]}
                  >
                    {saving ? (
                      <>
                        <ActivityIndicator
                          color="#fff"
                          size="small"
                          style={styles.buttonIcon}
                        />
                        <Text style={styles.saveButtonText}>Saving...</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons
                          color="#fff"
                          name="cloud-upload"
                          size={20}
                          style={styles.buttonIcon}
                        />
                        <Text style={styles.saveButtonText}>Save Settings</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    disabled={deletingAccount}
                    onPress={handleDeleteAccount}
                    style={[
                      styles.deleteButton,
                      deletingAccount && styles.deleteButtonDisabled,
                    ]}
                  >
                    {deletingAccount ? (
                      <>
                        <ActivityIndicator
                          color="#FF3B30"
                          size="small"
                          style={styles.buttonIcon}
                        />
                        <Text style={styles.deleteButtonText}>Deleting...</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons
                          color="#FF3B30"
                          name="trash-outline"
                          size={20}
                          style={styles.buttonIcon}
                        />
                        <Text style={styles.deleteButtonText}>
                          Delete Account
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <Text style={styles.versionFooter}>Version 1.0.2</Text>
                </View>
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* Bottom Navigation Bar */}
      <View
        style={[styles.navigationBar, { paddingBottom: insets.bottom + 12 }]}
      >
        {/* Home Icon - Left */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => handleTabPress("home")}
          style={styles.navItem}
        >
          <Ionicons
            color={activeTab === "home" ? "#007AFF" : "#999"}
            name="home"
            size={28}
          />
        </TouchableOpacity>

        {/* Discover Icon */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => handleTabPress("discover")}
          style={styles.navItem}
        >
          <Ionicons
            color={activeTab === "discover" ? "#007AFF" : "#999"}
            name="search"
            size={28}
          />
        </TouchableOpacity>

        {/* Plus Icon - Center */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => handleTabPress("add")}
          style={styles.navItem}
        >
          <Image
            resizeMode="cover"
            source={require("../../assets/icon.png")}
            style={styles.plusIconContainer}
          />
        </TouchableOpacity>

        {/* Lookbook Icon */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => handleTabPress("lookbook")}
          style={styles.navItem}
        >
          <Ionicons
            color={activeTab === "lookbook" ? "#007AFF" : "#999"}
            name="albums"
            size={28}
          />
        </TouchableOpacity>

        {/* Settings Icon - Right */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => handleTabPress("settings")}
          style={styles.navItem}
        >
          <Ionicons
            color={activeTab === "settings" ? "#007AFF" : "#999"}
            name="settings"
            size={28}
          />
        </TouchableOpacity>
      </View>

      <StatusBar style="dark" />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  buttonIcon: {
    marginRight: 8,
  },
  cardMarginRight: {
    marginRight: 12,
  },
  container: {
    backgroundColor: "transparent",
    flex: 1,
  },
  contentContainer: {
    backgroundColor: "transparent",
    flex: 1,
  },
  conversionText: {
    bottom: 0,
    color: "#999",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 46,
    position: "absolute",
    right: 12,
    textAlignVertical: "center",
    top: 0,
  },
  // Currency and size chip styles
  currencyChip: {
    minWidth: 60,
  },
  datePicker: {
    marginTop: 8,
  },
  deleteButton: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderColor: "#FF3B30",
    borderRadius: 12,
    borderWidth: 1,
    elevation: 3,
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: 23,
    paddingVertical: 13,
    shadowColor: "#000",
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  deleteButtonDisabled: {
    opacity: 0.5,
  },
  deleteButtonText: {
    color: "#FF3B30",
    fontSize: 16,
    fontWeight: "500",
  },
  discoverButtonDisabled: {
    opacity: 0.6,
  },
  discoverButtonLocked: {
    backgroundColor: "#999",
    opacity: 0.5,
  },
  discoverInputContainer: {
    flex: 1,
  },
  discoverProductCard: {
    marginBottom: 18,
    width: "100%",
  },
  discoverSearchButton: {
    alignItems: "center",
    backgroundColor: "#007AFF",
    borderRadius: 23,
    height: 46,
    justifyContent: "center",
    marginLeft: 10,
    width: 46,
  },
  discoverSearchCard: {
    marginBottom: 22,
  },
  discoverSearchInput: {
    backgroundColor: "rgba(255, 255, 255, 0.65)",
    borderColor: "rgba(58, 59, 60, 0.08)",
    borderRadius: 23,
    fontSize: 14,
    height: 46,
    paddingHorizontal: 16,
    paddingVertical: 0,
    width: "100%",
  },
  discoverSearchRow: {
    alignItems: "center",
    flexDirection: "row",
  },
  discoverSearchTipText: {
    color: "#999",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  discoverStateContainer: {
    minHeight: 210,
  },
  discoverValidationText: {
    color: "#FF3B30",
    fontSize: 13,
    marginTop: 8,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyText: {
    color: "#999",
    fontSize: 16,
    fontWeight: "500",
    marginTop: 12,
  },
  gradientBackground: {
    minHeight: "100%",
  },
  heartButton: {
    alignItems: "center",
    height: 24,
    justifyContent: "center",
    marginBottom: "auto",
    marginTop: "auto",
    width: 24,
  },
  horizontalScrollContent: {
    paddingLeft: 5,
    paddingRight: 5,
    paddingVertical: 8,
  },
  labelWithIcon: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 8,
  },
  // Link card styles
  linkCard: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderColor: "rgba(255, 255, 255, 0.7)",
    borderRadius: 12,
    borderWidth: 1.5,
    elevation: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  linkCardContent: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
  },
  linkCardIcon: {
    marginRight: 12,
  },
  linkCardText: {
    color: "#3a3b3c",
    fontSize: 16,
    fontWeight: "500",
  },
  locationRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  locationText: {
    color: "#3a3b3c",
    flex: 1,
    fontSize: 16,
  },
  logo: {
    height: 300,
    marginBottom: -100,
    marginTop: -60,
    width: width * 0.9,
  },
  logoContainer: {
    alignItems: "center",
    paddingHorizontal: 20,
  },
  lookbookCard: {
    alignItems: "stretch",
    alignSelf: "center",
    flexDirection: "column",
    marginBottom: 12,
    overflow: "hidden",
    padding: 0,
    width: "90%",
  },
  lookbookContent: {
    padding: 12,
  },
  lookbookDate: {
    color: "#999",
    fontSize: 13,
  },
  lookbookHeader: {
    justifyContent: "center",
  },
  lookbookImage: {
    backgroundColor: "#f5f5f5",
    height: "100%",
    width: "100%",
  },
  lookbookImageContainer: {
    aspectRatio: 4 / 5,
    width: "100%",
  },
  lookbookMeta: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  lookbookTitle: {
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    borderRadius: 8,
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    left: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    position: "absolute",
    right: 12,
    textAlign: "center",
    top: 12,
  },
  measurementInput: {
    backgroundColor: "#f5f5f5",
    borderColor: "#f0f0f0",
    borderRadius: 8,
    borderWidth: 1,
    color: "#3a3b3c",
    fontSize: 16,
    padding: 12,
    paddingRight: 90,
  },
  measurementInputWrapper: {
    position: "relative",
  },
  navigationBar: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderTopColor: "rgba(255, 255, 255, 0.7)",
    borderTopWidth: 1.5,
    elevation: 0,
    flexDirection: "row",
    paddingBottom: 12,
    paddingHorizontal: 8,
    paddingTop: 12,
    shadowColor: "#000",
    shadowOffset: { height: -2, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  navItem: {
    alignItems: "center",
    flex: 1,
    height: 56,
    justifyContent: "center",
  },
  plusIconContainer: {
    alignItems: "center",
    backgroundColor: "#007AFF",
    borderRadius: 28,
    elevation: 8,
    height: 56,
    justifyContent: "center",
    shadowColor: "#007AFF",
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    width: 56,
  },
  priceInput: {
    color: "#3a3b3c",
    flex: 1,
    fontSize: 16,
    padding: 12,
    paddingLeft: 0,
  },
  priceInputWrapper: {
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderColor: "#f0f0f0",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    paddingHorizontal: 12,
  },
  pricePrefix: {
    color: "#3a3b3c",
    fontSize: 16,
    fontWeight: "500",
    marginRight: 4,
  },
  priceRangeContainer: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  priceSeparator: {
    color: "#999",
    fontSize: 16,
    fontWeight: "500",
  },
  recommendationBrand: {
    color: "#007AFF",
    fontSize: 14,
    marginBottom: 4,
  },
  recommendationCard: {
    alignItems: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderColor: "rgba(255, 255, 255, 0.7)",
    borderRadius: 12,
    borderWidth: 1.5,
    elevation: 0,
    flexDirection: "row",
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    width: width * 0.82,
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
  saveButton: {
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
  saveButtonDisabled: {
    backgroundColor: "#999",
    opacity: 0.5,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  sectionContainer: {
    marginBottom: 30,
  },
  sectionsContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionTitle: {
    color: "#3a3b3c",
    fontSize: 18,
    fontWeight: "500",
    marginBottom: 15,
  },
  settingsActions: {
    gap: 12,
    marginTop: 12,
  },
  settingsCard: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderColor: "rgba(255, 255, 255, 0.7)",
    borderRadius: 12,
    borderWidth: 1.5,
    elevation: 0,
    marginBottom: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  // Settings styles
  settingsContainer: {
    paddingBottom: 32,
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  settingsHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  settingsInput: {
    backgroundColor: "#f5f5f5",
    borderColor: "#f0f0f0",
    borderRadius: 8,
    borderWidth: 1,
    color: "#3a3b3c",
    fontSize: 16,
    padding: 12,
  },
  settingsLabel: {
    color: "#3a3b3c",
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
  },
  // Settings page uses proportional spacing (80% scale) for a more compact feel
  // Home sections: 30px spacing with 15px title margin (2:1 ratio)
  // Settings sections: 24px spacing with 12px title margin (2:1 ratio)
  settingsSection: {
    marginBottom: 24,
  },
  settingsSectionTitle: {
    color: "#3a3b3c",
    fontSize: 18,
    fontWeight: "500",
    marginBottom: 12,
  },
  settingsTitle: {
    color: "#3a3b3c",
    fontSize: 32,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  signOutButton: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderColor: "rgba(255, 255, 255, 0.7)",
    borderRadius: 22,
    borderWidth: 1.5,
    elevation: 0,
    height: 44,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    width: 44,
  },
  sizeChip: {
    minWidth: 50,
  },
  splitInput: {
    color: "#3a3b3c",
    flex: 1,
    fontSize: 16,
    padding: 12,
    paddingLeft: 0,
  },
  splitInputContainer: {
    flexDirection: "row",
    gap: 12,
  },
  splitInputUnit: {
    color: "#999",
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 4,
  },
  splitInputWrapper: {
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderColor: "#f0f0f0",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    paddingHorizontal: 12,
  },
  styleChip: {
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderColor: "#f0f0f0",
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  styleChipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  styleChipSelected: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  styleChipText: {
    color: "#3a3b3c",
    fontSize: 14,
    fontWeight: "500",
  },
  styleChipTextSelected: {
    color: "#fff",
  },
  textAreaInput: {
    minHeight: 80,
    paddingTop: 12,
  },
  title: {
    color: "#3a3b3c",
    fontSize: 32,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  titleContainer: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  toggleDescription: {
    color: "#999",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  toggleLabelContainer: {
    flex: 1,
    marginRight: 12,
  },
  // Toggle styles
  toggleRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  // Version footer text
  versionFooter: {
    color: "#999",
    fontSize: 12,
    marginTop: 20,
    textAlign: "center",
  },
});
