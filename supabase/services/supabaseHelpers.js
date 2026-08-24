import { decode } from "base64-arraybuffer";

import { supabase } from "./supabase";

const formatAppleFullName = (fullName) => {
  if (!fullName) return null;

  const name = [fullName.givenName, fullName.middleName, fullName.familyName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return name || null;
};

export const syncAppleProfileFromCredential = async (credential, user) => {
  try {
    if (!user?.id) return;

    const name = formatAppleFullName(credential?.fullName);
    const email = credential?.email || user.email || null;

    if (name) {
      const { error: metadataError } = await supabase.auth.updateUser({
        data: { name },
      });
      void metadataError;
    }

    const profileUpdates = { id: user.id };

    if (name) profileUpdates.name = name;
    if (email) profileUpdates.email = email;

    if (Object.keys(profileUpdates).length === 1) return;

    const { error } = await supabase.from("profiles").upsert(profileUpdates);

    if (error) throw error;
  } catch {
    // Apple profile enrichment is best-effort and must not block sign-in.
  }
};

/**
 * Upload a photo to Supabase Storage
 * @param {string} base64Data - Base64 encoded image data
 * @param {string} bucket - Storage bucket name ('outfit-photos' or 'try-on-results')
 * @param {string} fileName - Optional custom filename (auto-generated if not provided)
 * @returns {Promise<{url: string, path: string}>} - Public URL and storage path
 */
export const uploadPhoto = async (
  base64Data,
  bucket = "outfit-photos",
  fileName = null,
) => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const timestamp = Date.now();
    const resolvedFileName = fileName || `${timestamp}.jpg`;
    const filePath = `${user.id}/${resolvedFileName}`;

    const arrayBuffer = decode(base64Data);

    const { error } = await supabase.storage
      .from(bucket)
      .upload(filePath, arrayBuffer, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (error) throw error;

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(filePath);

    return {
      path: filePath,
      url: publicUrl,
    };
  } catch {
    throw new Error("Failed to upload photo");
  }
};

/**
 * Delete a photo from Supabase Storage
 * @param {string} filePath - Storage file path
 * @param {string} bucket - Storage bucket name
 */
export const deletePhoto = async (filePath, bucket = "outfit-photos") => {
  try {
    const { error } = await supabase.storage.from(bucket).remove([filePath]);

    if (error) throw error;
  } catch {
    throw new Error("Failed to delete photo");
  }
};

/**
 * Save outfit analysis to database
 * @param {object} analysisData - Analysis result from edge function
 * @param {string} photoUrl - URL of uploaded photo in storage
 * @returns {Promise<string>} - Analysis ID
 */
export const saveOutfitAnalysis = async (analysisData, photoUrl) => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { data, error } = await supabase
      .from("outfit_analyses")
      .insert({
        is_valid_photo: analysisData.isValidPhoto,
        outfit_name: analysisData.outfitName,
        photo_url: photoUrl,
        rating: analysisData.rating,
        search_terms: analysisData.searchTerms || "",
        short_description: analysisData.shortDescription,
        user_id: user.id,
      })
      .select("id")
      .single();

    if (error) throw error;
    return data.id;
  } catch {
    throw new Error("Failed to save outfit analysis");
  }
};

/**
 * Get user's outfit analysis history
 * @param {number} limit - Number of analyses to fetch
 * @returns {Promise<Array>} - Array of outfit analyses
 */
export const getOutfitHistory = async (limit = 20) => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { data, error } = await supabase
      .from("outfit_analyses")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  } catch {
    throw new Error("Failed to fetch outfit history");
  }
};

/**
 * Save product recommendations for an analysis
 * @param {string} analysisId - Analysis ID
 * @param {Array} recommendations - Array of product recommendations
 */
export const saveRecommendations = async (analysisId, recommendations) => {
  try {
    const recommendationRows = recommendations.map((recommendation) => ({
      analysis_id: analysisId,
      brand: recommendation.brand,
      category: recommendation.category || "other",
      description: recommendation.description,
      image_url: recommendation.imageUrl,
      name: recommendation.name,
      price: recommendation.price,
      purchase_url: recommendation.purchaseUrl,
    }));

    const { error } = await supabase
      .from("product_recommendations")
      .insert(recommendationRows);

    if (error) throw error;
  } catch {
    throw new Error("Failed to save recommendations");
  }
};

/**
 * Get recommendations for a specific analysis
 * @param {string} analysisId - Analysis ID
 * @returns {Promise<Array>} - Array of recommendations
 */
export const getRecommendations = async (analysisId) => {
  try {
    const { data, error } = await supabase
      .from("product_recommendations")
      .select("*")
      .eq("analysis_id", analysisId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data;
  } catch {
    throw new Error("Failed to fetch recommendations");
  }
};

/**
 * Add a product to favorites
 * @param {object} product - Product object with recommendation_id or product details
 */
export const addFavorite = async (product) => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const favoriteData = {
      brand: product.brand,
      category: product.category || "other",
      description: product.description || null,
      image_url: product.imageUrl || product.image_url,
      name: product.name,
      price: product.price || null,
      purchase_url: product.purchaseUrl || product.purchase_url,
      recommendation_id: product.recommendation_id || null,
      user_id: user.id,
    };

    const { data, error } = await supabase
      .from("favorite_products")
      .insert(favoriteData)
      .select("id")
      .single();

    if (error) throw error;
    return data.id;
  } catch {
    throw new Error("Failed to add favorite");
  }
};

/**
 * Remove a product from favorites
 * @param {string} favoriteId - Favorite product ID
 */
export const removeFavorite = async (favoriteId) => {
  try {
    const { error } = await supabase
      .from("favorite_products")
      .delete()
      .eq("id", favoriteId);

    if (error) throw error;
  } catch {
    throw new Error("Failed to remove favorite");
  }
};

/**
 * Get user's favorite products
 * @returns {Promise<Array>} - Array of favorite products
 */
export const getFavorites = async () => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { data, error } = await supabase
      .from("favorite_products")
      .select("*")
      .eq("user_id", user.id)
      .order("favorited_at", { ascending: false });

    if (error) throw error;
    return data;
  } catch {
    throw new Error("Failed to fetch favorites");
  }
};

/**
 * Save virtual try-on result
 * @param {string} originalPhotoUrl - Original photo URL
 * @param {string} productImageUrl - Product image URL
 * @param {string} resultImageUrl - Result image URL
 * @returns {Promise<string>} - Try-on result ID
 */
export const saveTryOnResult = async (
  originalPhotoUrl,
  productImageUrl,
  resultImageUrl,
) => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { data, error } = await supabase
      .from("try_on_results")
      .insert({
        original_photo_url: originalPhotoUrl,
        product_image_url: productImageUrl,
        result_image_url: resultImageUrl,
        user_id: user.id,
      })
      .select("id")
      .single();

    if (error) throw error;
    return data.id;
  } catch {
    throw new Error("Failed to save try-on result");
  }
};

/**
 * Get user's try-on results history
 * @param {number} limit - Number of results to fetch
 * @returns {Promise<Array>} - Array of try-on results
 */
export const getTryOnHistory = async (limit = 20) => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { data, error } = await supabase
      .from("try_on_results")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  } catch {
    throw new Error("Failed to fetch try-on history");
  }
};

/**
 * Get user profile
 * @returns {Promise<object>} - User profile data
 */
export const getProfile = async () => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) throw error;
    return data;
  } catch {
    throw new Error("Failed to fetch profile");
  }
};

/**
 * Update user profile
 * @param {object} profileData - Profile fields to update
 */
export const updateProfile = async (profileData) => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { error } = await supabase
      .from("profiles")
      .update(profileData)
      .eq("id", user.id);

    if (error) throw error;
  } catch {
    throw new Error("Failed to update profile");
  }
};

/**
 * Delete the authenticated user's account and associated data.
 */
export const deleteAccount = async () => {
  const { data, error } = await supabase.functions.invoke("delete-account", {
    method: "POST",
  });

  if (error) throw error;
  return data;
};
