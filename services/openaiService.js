import axios from 'axios';
import { ANTHROPIC_API_KEY, validateApiKey, obfuscateApiKey } from '../constants/apiKeys';

// Anthropic Claude API configuration
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const TIMEOUT = 30000; // 30 seconds

// Backend URL - update this with your ngrok URL when using ngrok
// IMPORTANT: Use HTTP (not HTTPS) to avoid SSL certificate issues on Android
// Example: 'http://abc123.ngrok-free.app' (without /api at the end)
const BACKEND_URL = 'http://192.168.1.19:8000'; // UPDATE THIS WITH HTTP URL!

// Validate API key on import
try {
  validateApiKey();
  if (__DEV__) {
    console.log('Anthropic API Key configured:', obfuscateApiKey(ANTHROPIC_API_KEY));
  }
} catch (error) {
  console.error('Anthropic API Key validation failed:', error.message);
}

// Create axios instance with base configuration
const apiClient = axios.create({
  baseURL: 'https://api.anthropic.com/v1',
  timeout: TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
  },
});

// Request interceptor for logging in development
apiClient.interceptors.request.use(
  (config) => {
    if (__DEV__) {
      console.log('Anthropic API Request:', config.method?.toUpperCase(), config.url);
    }
    return config;
  },
  (error) => {
    if (__DEV__) {
      console.error('Anthropic API Request Error:', error);
    }
    return Promise.reject(error);
  }
);

// Response interceptor for logging in development
apiClient.interceptors.response.use(
  (response) => {
    if (__DEV__) {
      console.log('Anthropic API Response:', response.status, response.data);
    }
    return response;
  },
  (error) => {
    if (__DEV__) {
      console.error('Anthropic API Response Error:', error.response?.status, error.response?.data);
    }
    return Promise.reject(error);
  }
);

// Validation function for outfit analysis response
const validateOutfitAnalysis = (data) => {
  const errors = [];
  
  if (!data || typeof data !== 'object') {
    errors.push('Response data is not an object');
    return errors;
  }
  
  // Check required string fields
  const requiredStrings = ['outfitName', 'shortDescription'];
  requiredStrings.forEach(field => {
    if (!data[field] || typeof data[field] !== 'string') {
      errors.push(`Missing or invalid ${field} (expected string)`);
    }
  });
  
  // Check rating
  if (typeof data.rating !== 'number' || data.rating < 1 || data.rating > 10) {
    errors.push('Invalid rating (expected number between 1-10)');
  }
  
  // Check isValidPhoto
  if (typeof data.isValidPhoto !== 'boolean') {
    errors.push('Invalid isValidPhoto (expected boolean)');
  }
  
  // Check recommendations array (optional - added later by generateRecommendations)
  if (data.recommendations !== undefined) {
    if (!Array.isArray(data.recommendations)) {
      errors.push('Invalid recommendations (expected array)');
    } else if (data.recommendations.length > 0) {
      // Validate each recommendation if present
      data.recommendations.forEach((rec, index) => {
        const requiredRecFields = ['name', 'brand', 'description', 'price', 'imageUrl', 'purchaseUrl'];
        requiredRecFields.forEach(field => {
          if (!rec[field] || typeof rec[field] !== 'string') {
            errors.push(`Recommendation ${index + 1}: Missing or invalid ${field} (expected string)`);
          }
        });
      });
    }
  }
  
  return errors;
};

// Parse and validate Claude response
const parseOutfitResponse = (response) => {
  try {
    if (!response.content || !Array.isArray(response.content) || response.content.length === 0) {
      throw new Error('Invalid Claude response structure');
    }

    // Find the text content block
    const textBlock = response.content.find(block => block.type === 'text');
    if (!textBlock || !textBlock.text) {
      throw new Error('No text content found in response');
    }

    const content = textBlock.text;

    // Try to parse JSON from the content
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response content');
    }

    const parsedData = JSON.parse(jsonMatch[0]);

    // Validate the parsed data
    const validationErrors = validateOutfitAnalysis(parsedData);
    if (validationErrors.length > 0) {
      throw new Error(`Validation errors: ${validationErrors.join(', ')}`);
    }

    return parsedData;
  } catch (error) {
    console.error('Error parsing outfit response:', error);
    throw new Error(`Response parsing failed: ${error.message}`);
  }
};

// Enhanced error handling with retry logic
const handleApiError = (error, attempt = 1) => {
  if (error.response) {
    // Server responded with error status
    const status = error.response.status;
    const data = error.response.data;
    
    switch (status) {
      case 401:
        throw new Error('Invalid API key. Please check your Anthropic API key configuration.');
      case 429:
        const errorMessage = data?.error?.message || 'Rate limit exceeded';
        if (attempt <= 3) {
          // Return retry info for rate limit
          return { 
            shouldRetry: true, 
            retryAfter: Math.pow(2, attempt) * 1000, // Exponential backoff
            message: `${errorMessage}. Retrying in ${Math.pow(2, attempt)} seconds...` 
          };
        }
        throw new Error('Rate limit exceeded. Please try again later.');
      case 500:
      case 502:
      case 503:
      case 504:
        if (attempt <= 3) {
          return { 
            shouldRetry: true, 
            retryAfter: 2000, // 2 second delay for server errors
            message: `Server error (${status}). Retrying...` 
          };
        }
        throw new Error('Anthropic server is currently unavailable. Please try again later.');
      default:
        throw new Error(`API request failed with status ${status}: ${data?.error?.message || 'Unknown error'}`);
    }
  } else if (error.request) {
    // Network error
    if (attempt <= 3) {
      return { 
        shouldRetry: true, 
        retryAfter: 3000, // 3 second delay for network errors
        message: 'Network error. Retrying...' 
      };
    }
    throw new Error('Network connection failed. Please check your internet connection.');
  } else if (error.code === 'ECONNABORTED') {
    // Timeout error
    if (attempt <= 3) {
      return { 
        shouldRetry: true, 
        retryAfter: 5000, // 5 second delay for timeout
        message: 'Request timed out. Retrying...' 
      };
    }
    throw new Error('Request timed out. The analysis is taking too long.');
  } else {
    // Other errors (validation, parsing, etc.)
    throw error;
  }
};

// Sleep utility for retry delays
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Function to search for real products using backend API
const searchForProducts = async (searchTerms, signal) => {
  try {
    console.log('Searching for products with web search:', searchTerms);
    console.log('Using backend URL:', BACKEND_URL);

    // Use fetch with provided signal or create a timeout controller
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), 300000); // 5 minute timeout

    // If a signal was provided, listen for its abort event
    if (signal) {
      signal.addEventListener('abort', () => timeoutController.abort());
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/search-products/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420',
          'User-Agent': 'SnazzyApp/1.0'
        },
        body: JSON.stringify({ searchTerms }),
        signal: timeoutController.signal
      });

      clearTimeout(timeoutId);

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Backend error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Backend response:', data);

      if (data.products && Array.isArray(data.products)) {
        console.log(`Found ${data.products.length} products`);
        return data.products;
      }

      console.log('No products found in response');
      return [];
    } catch (fetchError) {
      if (fetchError.name === 'AbortError') {
        console.error('Request timeout - search took too long');
      } else {
        console.error('Fetch error:', fetchError);
        console.error('Fetch error message:', fetchError.message);
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('Product search error:', error.message);
    console.error('Full error object:', error);
    console.log('Network or configuration error - check BACKEND_URL');
    console.log('Current BACKEND_URL:', BACKEND_URL);

    // If it's an SSL error, provide helpful message
    if (error.message && error.message.includes('certificate')) {
      console.error('SSL Certificate issue detected. This is common with ngrok on Android.');
      console.error('Make sure your ngrok URL is correct and the tunnel is running.');
    }

    return [];
  }
};

// Function to analyze outfit from base64 image with retry logic
export const analyzeOutfit = async (base64Image, signal, maxRetries = 3) => {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Validate API key before making request
      validateApiKey();

      // Analyze the image with Claude Sonnet 4.5 (supports images)
      const analysisRequest = {
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: base64Image
                }
              },
              {
                type: 'text',
                text: `You are a fashion stylist AI that ONLY analyzes outfits worn by people.

STRICT VALIDATION RULES:
- ONLY accept photos showing a person wearing clothing/outfit
- REJECT photos of: rooms, furniture, objects, plants, tools, landscapes, animals, food, etc.
- REJECT photos without a visible person in clothing
- If the photo is not fashion-related, set "isValidPhoto": false and return minimal data

Analyze this outfit and suggest specific product search terms.

Return a JSON response:
{
  "outfitName": "creative name for the outfit (max 3 words)" OR "Invalid Photo" if not fashion,
  "shortDescription": "fashion review description (must be 10-15 words exactly)" OR "Photo does not show a person wearing an outfit" if invalid,
  "rating": number from 3-7 (be moderate with ratings) OR 0 if invalid photo,
  "isValidPhoto": true ONLY if photo shows a person in clothing, false otherwise,
  "searchTerms": "specific search terms for complementary fashion items" OR "" if invalid
}

If isValidPhoto is false, set searchTerms to empty string "".`
              }
            ]
          }
        ]
      };

      const analysisResponse = await apiClient.post('/messages', analysisRequest, {
        signal: signal
      });
      const analysisJson = parseOutfitResponse(analysisResponse.data);

      // Return analysis without recommendations
      const finalResult = {
        outfitName: analysisJson.outfitName,
        shortDescription: analysisJson.shortDescription,
        rating: analysisJson.rating,
        isValidPhoto: analysisJson.isValidPhoto,
        searchTerms: analysisJson.searchTerms,
        recommendations: [] // Empty initially
      };

      if (__DEV__) {
        console.log('Successfully parsed outfit analysis (no recommendations yet):', finalResult);
      }

      return finalResult;

    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error.message);
      lastError = error;

      try {
        const errorInfo = handleApiError(error, attempt);
        if (errorInfo.shouldRetry && attempt < maxRetries) {
          console.log(errorInfo.message);
          await sleep(errorInfo.retryAfter);
          continue; // Try again
        }
      } catch (finalError) {
        // If handleApiError throws, it's a final error
        throw finalError;
      }

      // If we get here, it's the last attempt or no retry needed
      break;
    }
  }

  // All retries exhausted
  throw lastError || new Error('Failed to analyze outfit after multiple attempts');
};

// Function to generate recommendations based on search terms
export const generateRecommendations = async (searchTerms, signal) => {
  try {
    if (!searchTerms || searchTerms.trim() === '') {
      console.log('No search terms provided, returning empty recommendations');
      return [];
    }

    console.log('Generating recommendations with search terms:', searchTerms);
    const products = await searchForProducts(searchTerms, signal);

    if (!products || products.length === 0) {
      console.log('No products found from search');
      return [];
    }

    console.log(`Found ${products.length} product recommendations`);
    return products;
  } catch (error) {
    console.error('Failed to generate recommendations:', error.message);
    throw new Error('Failed to generate recommendations. Please try again.');
  }
};

export { apiClient, ANTHROPIC_API_URL };
