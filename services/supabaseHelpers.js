// =====================================================
// Supabase Helper Functions
// Utility functions for database and storage operations
// =====================================================

import { supabase } from './supabase'
import { decode } from 'base64-arraybuffer'

// =====================================================
// STORAGE FUNCTIONS
// =====================================================

/**
 * Upload a photo to Supabase Storage
 * @param {string} base64Data - Base64 encoded image data
 * @param {string} bucket - Storage bucket name ('outfit-photos' or 'try-on-results')
 * @param {string} fileName - Optional custom filename (auto-generated if not provided)
 * @returns {Promise<{url: string, path: string}>} - Public URL and storage path
 */
export const uploadPhoto = async (base64Data, bucket = 'outfit-photos', fileName = null) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    // Generate unique filename if not provided
    const timestamp = Date.now()
    const filename = fileName || `${timestamp}.jpg`
    const filePath = `${user.id}/${filename}`

    // Convert base64 to array buffer
    const arrayBuffer = decode(base64Data)

    // Upload to storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, arrayBuffer, {
        contentType: 'image/jpeg',
        upsert: false
      })

    if (error) throw error

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath)

    return {
      url: publicUrl,
      path: filePath
    }
  } catch (error) {
    console.error('Error uploading photo:', error)
    throw new Error('Failed to upload photo')
  }
}

/**
 * Delete a photo from Supabase Storage
 * @param {string} filePath - Storage file path
 * @param {string} bucket - Storage bucket name
 */
export const deletePhoto = async (filePath, bucket = 'outfit-photos') => {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath])

    if (error) throw error
  } catch (error) {
    console.error('Error deleting photo:', error)
    throw new Error('Failed to delete photo')
  }
}

// =====================================================
// OUTFIT ANALYSIS FUNCTIONS
// =====================================================

/**
 * Save outfit analysis to database
 * @param {object} analysisData - Analysis result from edge function
 * @param {string} photoUrl - URL of uploaded photo in storage
 * @returns {Promise<string>} - Analysis ID
 */
export const saveOutfitAnalysis = async (analysisData, photoUrl) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data, error } = await supabase
      .from('outfit_analyses')
      .insert({
        user_id: user.id,
        photo_url: photoUrl,
        outfit_name: analysisData.outfitName,
        short_description: analysisData.shortDescription,
        rating: analysisData.rating,
        search_terms: analysisData.searchTerms || '',
        is_valid_photo: analysisData.isValidPhoto
      })
      .select('id')
      .single()

    if (error) throw error
    return data.id
  } catch (error) {
    console.error('Error saving outfit analysis:', error)
    throw new Error('Failed to save outfit analysis')
  }
}

/**
 * Get user's outfit analysis history
 * @param {number} limit - Number of analyses to fetch
 * @returns {Promise<Array>} - Array of outfit analyses
 */
export const getOutfitHistory = async (limit = 20) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data, error } = await supabase
      .from('outfit_analyses')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error fetching outfit history:', error)
    throw new Error('Failed to fetch outfit history')
  }
}

// =====================================================
// PRODUCT RECOMMENDATION FUNCTIONS
// =====================================================

/**
 * Save product recommendations for an analysis
 * @param {string} analysisId - Analysis ID
 * @param {Array} recommendations - Array of product recommendations
 */
export const saveRecommendations = async (analysisId, recommendations) => {
  try {
    const recommendationsData = recommendations.map(rec => ({
      analysis_id: analysisId,
      name: rec.name,
      brand: rec.brand,
      description: rec.description,
      price: rec.price,
      image_url: rec.imageUrl,
      purchase_url: rec.purchaseUrl,
      category: rec.category || 'other'
    }))

    const { error } = await supabase
      .from('product_recommendations')
      .insert(recommendationsData)

    if (error) throw error
  } catch (error) {
    console.error('Error saving recommendations:', error)
    throw new Error('Failed to save recommendations')
  }
}

/**
 * Get recommendations for a specific analysis
 * @param {string} analysisId - Analysis ID
 * @returns {Promise<Array>} - Array of recommendations
 */
export const getRecommendations = async (analysisId) => {
  try {
    const { data, error } = await supabase
      .from('product_recommendations')
      .select('*')
      .eq('analysis_id', analysisId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error fetching recommendations:', error)
    throw new Error('Failed to fetch recommendations')
  }
}

// =====================================================
// FAVORITE PRODUCTS FUNCTIONS
// =====================================================

/**
 * Add a product to favorites
 * @param {object} product - Product object with recommendation_id or product details
 */
export const addFavorite = async (product) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const favoriteData = {
      user_id: user.id,
      recommendation_id: product.recommendation_id || null,
      name: product.name,
      brand: product.brand,
      price: product.price || null,
      description: product.description || null,
      image_url: product.imageUrl || product.image_url,
      purchase_url: product.purchaseUrl || product.purchase_url,
      category: product.category || 'other'
    }

    const { data, error } = await supabase
      .from('favorite_products')
      .insert(favoriteData)
      .select('id')
      .single()

    if (error) throw error
    return data.id  // Return the database UUID
  } catch (error) {
    console.error('Error adding favorite:', error)
    throw new Error('Failed to add favorite')
  }
}

/**
 * Remove a product from favorites
 * @param {string} favoriteId - Favorite product ID
 */
export const removeFavorite = async (favoriteId) => {
  try {
    const { error } = await supabase
      .from('favorite_products')
      .delete()
      .eq('id', favoriteId)

    if (error) throw error
  } catch (error) {
    console.error('Error removing favorite:', error)
    throw new Error('Failed to remove favorite')
  }
}

/**
 * Get user's favorite products
 * @returns {Promise<Array>} - Array of favorite products
 */
export const getFavorites = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data, error } = await supabase
      .from('favorite_products')
      .select('*')
      .eq('user_id', user.id)
      .order('favorited_at', { ascending: false })

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error fetching favorites:', error)
    throw new Error('Failed to fetch favorites')
  }
}

// =====================================================
// TRY-ON RESULTS FUNCTIONS
// =====================================================

/**
 * Save virtual try-on result
 * @param {string} originalPhotoUrl - Original photo URL
 * @param {string} productImageUrl - Product image URL
 * @param {string} resultImageUrl - Result image URL
 * @returns {Promise<string>} - Try-on result ID
 */
export const saveTryOnResult = async (originalPhotoUrl, productImageUrl, resultImageUrl) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data, error } = await supabase
      .from('try_on_results')
      .insert({
        user_id: user.id,
        original_photo_url: originalPhotoUrl,
        product_image_url: productImageUrl,
        result_image_url: resultImageUrl
      })
      .select('id')
      .single()

    if (error) throw error
    return data.id
  } catch (error) {
    console.error('Error saving try-on result:', error)
    throw new Error('Failed to save try-on result')
  }
}

/**
 * Get user's try-on results history
 * @param {number} limit - Number of results to fetch
 * @returns {Promise<Array>} - Array of try-on results
 */
export const getTryOnHistory = async (limit = 20) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data, error } = await supabase
      .from('try_on_results')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error fetching try-on history:', error)
    throw new Error('Failed to fetch try-on history')
  }
}

// =====================================================
// PROFILE FUNCTIONS
// =====================================================

/**
 * Get user profile
 * @returns {Promise<object>} - User profile data
 */
export const getProfile = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error fetching profile:', error)
    throw new Error('Failed to fetch profile')
  }
}

/**
 * Update user profile
 * @param {object} profileData - Profile fields to update
 */
export const updateProfile = async (profileData) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { error } = await supabase
      .from('profiles')
      .update(profileData)
      .eq('id', user.id)

    if (error) throw error
  } catch (error) {
    console.error('Error updating profile:', error)
    throw new Error('Failed to update profile')
  }
}
