import axios from 'axios';
import { GOOGLE_API_KEY, validateGoogleApiKey, obfuscateApiKey } from '../constants/apiKeys';

// Google Gemini API configuration
const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_MODEL = 'gemini-2.5-flash-image-preview';
const TIMEOUT = 60000; // 60 seconds for image generation

// Validate API key on import
try {
  validateGoogleApiKey();
  if (__DEV__) {
    console.log('Google API Key configured:', obfuscateApiKey(GOOGLE_API_KEY));
  }
} catch (error) {
  console.error('Google API Key validation failed:', error.message);
}

// Create axios instance with base configuration
const apiClient = axios.create({
  baseURL: GEMINI_API_BASE_URL,
  timeout: TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging in development
apiClient.interceptors.request.use(
  (config) => {
    if (__DEV__) {
      console.log('Gemini API Request:', config.method?.toUpperCase(), config.url);
    }
    return config;
  },
  (error) => {
    if (__DEV__) {
      console.error('Gemini API Request Error:', error);
    }
    return Promise.reject(error);
  }
);

// Response interceptor for logging in development
apiClient.interceptors.response.use(
  (response) => {
    if (__DEV__) {
      console.log('Gemini API Response:', response.status);
    }
    return response;
  },
  (error) => {
    if (__DEV__) {
      console.error('Gemini API Response Error:', error.response?.status, error.response?.data);
    }
    return Promise.reject(error);
  }
);

// Download image from URL and convert to base64
const downloadImageAsBase64 = async (imageUrl) => {
  try {
    console.log('Downloading image:', imageUrl);

    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`);
    }

    // Get the image as a blob
    const blob = await response.blob();

    // Convert blob to base64
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Extract base64 data (remove data:image/...;base64, prefix)
        const base64data = reader.result.split(',')[1];
        resolve(base64data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error downloading image:', error);
    throw new Error('Failed to download clothing image');
  }
};

// Function to perform virtual try-on using Gemini 2.5 Flash Image (Nano Banana)
export const performVirtualTryOn = async (userPhotoBase64, clothingImageUrl, signal) => {
  try {
    // Validate API key before making request
    validateGoogleApiKey();

    console.log('Starting virtual try-on...');
    console.log('Clothing image URL:', clothingImageUrl);

    // Download clothing image and convert to base64
    console.log('Downloading clothing image...');
    const clothingImageBase64 = await downloadImageAsBase64(clothingImageUrl);

    // Prepare the API request
    const prompt = `You are an expert virtual try-on AI. Take the person from the first image and seamlessly place the clothing item from the second image onto them. Make it look realistic and natural, as if they are actually wearing the clothing item. Ensure proper fit, lighting, and shadows. The result should look like a professional photo of the person wearing the new clothing.`;

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt
            },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: userPhotoBase64
              }
            },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: clothingImageBase64
              }
            }
          ]
        }
      ],
      generationConfig: {
        responseModalities: ['IMAGE'],
        temperature: 0.4,
        topP: 0.95,
        topK: 40
      }
    };

    console.log('Sending request to Gemini API...');

    // Make the API request with API key as query parameter
    const response = await apiClient.post(
      `/models/${GEMINI_MODEL}:generateContent?key=${GOOGLE_API_KEY}`,
      requestBody,
      {
        signal: signal
      }
    );

    console.log('Received response from Gemini API');

    // Extract the generated image from response
    if (response.data && response.data.candidates && response.data.candidates.length > 0) {
      const candidate = response.data.candidates[0];

      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          // Check for both camelCase and snake_case formats
          const imageData = part.inlineData || part.inline_data;

          if (imageData && imageData.data) {
            console.log('Successfully extracted generated image');

            // Get the mime type (could be image/png or image/jpeg)
            const mimeType = imageData.mimeType || imageData.mime_type || 'image/jpeg';

            // Return the base64 data directly (can be used with data URI)
            return {
              success: true,
              base64: imageData.data,
              dataUri: `data:${mimeType};base64,${imageData.data}`
            };
          }
        }
      }
    }

    // If we get here, no image was found in the response
    console.error('No image found in Gemini response:', JSON.stringify(response.data).substring(0, 500));
    throw new Error('No image generated in response');

  } catch (error) {
    console.error('Virtual try-on failed:', error);

    // Handle specific error types
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      switch (status) {
        case 401:
          throw new Error('Invalid Google API key. Please check your configuration.');
        case 429:
          throw new Error('Rate limit exceeded. Please try again later.');
        case 500:
        case 502:
        case 503:
        case 504:
          throw new Error('Google server error. Please try again later.');
        default:
          throw new Error(`API request failed: ${data?.error?.message || 'Unknown error'}`);
      }
    } else if (error.request) {
      throw new Error('Network connection failed. Please check your internet connection.');
    } else if (error.message.includes('API key')) {
      throw error; // Re-throw validation errors
    } else {
      throw new Error('Virtual try-on failed. Please try again.');
    }
  }
};

export { apiClient, GEMINI_API_BASE_URL };
