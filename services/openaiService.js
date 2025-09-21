import axios from 'axios';
import { OPENAI_API_KEY, validateApiKey, obfuscateApiKey } from '../constants/apiKeys';

// OpenAI API configuration
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const TIMEOUT = 30000; // 30 seconds

// Backend URL - update this with your ngrok URL when using ngrok
// IMPORTANT: Use HTTP (not HTTPS) to avoid SSL certificate issues on Android
// Example: 'http://abc123.ngrok-free.app' (without /api at the end)
// Prefer environment variable (Expo public) with fallback.
// EXPO_PUBLIC_BACKEND_URL should be defined in .env for dynamic environments (e.g., Docker: http://backend:8000)
// Fallback remains a local LAN IP placeholder for quick manual testing.
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://192.168.1.34:8000'; // UPDATE THIS WITH HTTP URL IF NO ENV VAR

// Validate API key on import
try {
  validateApiKey();
  if (__DEV__) {
    console.log('OpenAI API Key configured:', obfuscateApiKey(OPENAI_API_KEY));
  }
} catch (error) {
  console.error('OpenAI API Key validation failed:', error.message);
}

// Create axios instance with base configuration
const apiClient = axios.create({
  baseURL: 'https://api.openai.com/v1',
  timeout: TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${OPENAI_API_KEY}`,
  },
});

// Request interceptor for logging in development
apiClient.interceptors.request.use(
  (config) => {
    if (__DEV__) {
      console.log('OpenAI API Request:', config.method?.toUpperCase(), config.url);
    }
    return config;
  },
  (error) => {
    if (__DEV__) {
      console.error('OpenAI API Request Error:', error);
    }
    return Promise.reject(error);
  }
);

// Response interceptor for logging in development
apiClient.interceptors.response.use(
  (response) => {
    if (__DEV__) {
      console.log('OpenAI API Response:', response.status, response.data);
    }
    return response;
  },
  (error) => {
    if (__DEV__) {
      console.error('OpenAI API Response Error:', error.response?.status, error.response?.data);
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
  
  // Check recommendations array
  if (!Array.isArray(data.recommendations)) {
    errors.push('Invalid recommendations (expected array)');
  } else if (data.recommendations.length !== 5) {
    errors.push(`Invalid recommendations length (expected 5, got ${data.recommendations.length})`);
  } else {
    // Validate each recommendation
    data.recommendations.forEach((rec, index) => {
      const requiredRecFields = ['name', 'brand', 'description', 'price', 'imageUrl', 'purchaseUrl'];
      requiredRecFields.forEach(field => {
        if (!rec[field] || typeof rec[field] !== 'string') {
          errors.push(`Recommendation ${index + 1}: Missing or invalid ${field} (expected string)`);
        }
      });
    });
  }
  
  return errors;
};

// Parse and validate OpenAI response
const parseOutfitResponse = (response) => {
  try {
    if (!response.choices || !response.choices[0] || !response.choices[0].message) {
      throw new Error('Invalid OpenAI response structure');
    }
    
    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('Empty response content');
    }
    
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
        throw new Error('Invalid API key. Please check your OpenAI API key configuration.');
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
        throw new Error('OpenAI server is currently unavailable. Please try again later.');
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
const searchForProducts = async (searchTerms) => {
  try {
    console.log('Searching for products with web search:', searchTerms);
    console.log('Using backend URL:', BACKEND_URL);

    // Use fetch instead of axios to avoid SSL certificate issues with ngrok
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout

    try {
      const response = await fetch(`${BACKEND_URL}/api/search-products/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420',
          'User-Agent': 'SnazzyApp/1.0'
        },
        body: JSON.stringify({ searchTerms }),
        signal: controller.signal
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
export const analyzeOutfit = async (base64Image, maxRetries = 3) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Validate API key before making request
      validateApiKey();

      // Step 1: Analyze the image with regular gpt-4o (supports images)
      const analysisRequest = {
        model: 'gpt-4o',
        max_tokens: 500,
        messages: [
          {
            role: 'system',
            content: `You are a fashion stylist AI. Analyze the outfit and suggest what items would complement it.
            
Return a JSON response:
{
  "outfitName": "creative name for the outfit (max 3 words)",
  "shortDescription": "fashion review description (must be 10-15 words exactly)",
  "rating": number from 3-7 (be moderate with ratings),
  "isValidPhoto": boolean,
  "searchTerms": "specific search terms for complementary items"
}`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this outfit and suggest specific product search terms.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ]
      };

      const analysisResponse = await apiClient.post('/chat/completions', analysisRequest);
      const analysisContent = analysisResponse.data.choices[0].message.content;
      const analysisJson = JSON.parse(analysisContent.match(/\{[\s\S]*\}/)[0]);

      // Step 2: Search for real products based on analysis
      let recommendations = [];
      
      // Try to get real product recommendations first
      try {
        if (analysisJson.searchTerms) {
          console.log('Searching for real products with terms:', analysisJson.searchTerms);
          recommendations = await searchForProducts(analysisJson.searchTerms);
        }
      } catch (searchError) {
        console.error('Product search failed, using fallback:', searchError.message);
      }
      
      // Static clothing items as fallback if search fails or returns empty
      const staticClothingItems = [
        {
          name: "Plain white t-shirt",
          brand: "Zara",
          description: "Classic cotton crew neck tee in crisp white, perfect for layering.",
          price: "$25",
          imageUrl: "https://tse1.mm.bing.net/th/id/OIP.V2u0mcmx-nYk3jltqDY6_wHaE8?pid",
          purchaseUrl: "#"
        },
        {
          name: "Plain black t-shirt",
          brand: "H&M",
          description: "Soft cotton jersey tee in black with a relaxed, everyday fit.",
          price: "$20",
          imageUrl: "https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcR5DQoK9W79lIpLtaW5zUtFvLifb_BpOf1BnpehisCcQoxe1F5qVxU_lWrc5gHVo3DONEOjX1TwDGBmKcFe0PFSXyI0VO11VjKezCtvqMfMwl97O9zP47XWkU-cqqoQcIDHyNUnc8k&usqp=CAc",
          purchaseUrl: "#"
        },
        {
          name: "Plain white chinos",
          brand: "Ralph Lauren",
          description: "Slim-fit chino shorts in white cotton.",
          price: "$85",
          imageUrl: "https://img01.ztat.net/article/spp-media-p1/84245e8911c14e52b65d70a5eee932c4/894e0e11fad94479877bad8e16a6e3d9.jpg?imwidth=762&filter=packshot",
          purchaseUrl: "#"
        },
        {
          name: "Plain green chinos",
          brand: "Zara",
          description: "Lightweight chino shorts in olive green with a tailored cut.",
          price: "$60",
          imageUrl: "https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcQWkc7Xbq6KgVkEK8mbCouNEhN8Q4fouWXa1tjueyKw7M-7x_n-SariOmEkKdOK2xfOGaAsG5h9HJvSnVc9yfAjXQc9u0gmR7FbxxEZUWNW20wurhcJIuEmEAvmz5MuEwIHUPpM7RwxRgU&usqp=CAc",
          purchaseUrl: "#"
        },
        {
          name: "Plain light blue jeans",
          brand: "H&M",
          description: "Casual light blue denim jeans with a clean flat-front design.",
          price: "$55",
          imageUrl: "https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcTJBBVhQMpy-dBLUE_Ed60EST86xgQgasK87cycZkisVvEXDBV_xkA64G9j3FVrznUzq5uLaYr0YQW1isWjEeygqoxfdWwV0XYfjY22FSwcW9fnaylzbbIUnRF7iuQjWNI7PP7gTRpS&usqp=CAc",
          purchaseUrl: "#"
        },
        {
          name: "Knitted summer sweater",
          brand: "Ralph Lauren",
          description: "Lightweight knitted pullover in breathable cotton blend.",
          price: "$95",
          imageUrl: "https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcS9k5Ejrspp5PwbiuizkGyrxW9_Boi9AJS5L1MPSnctYKveN_GOpVpYH50jHQ_gDsHdy4FwfLoxz6dnnvw3Y89jPxQ8flgZL5yuEXlQZqpVp-9rolIHzEkki5h_h0tK2FlAnvTNndg&usqp=CAc",
          purchaseUrl: "#"
        },
        {
          name: "Corduroy pants",
          brand: "Zara",
          description: "Loose-fit vintage-style corduroy trousers in beige polyester.",
          price: "$75",
          imageUrl: "https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcSc_lPylQq4FrBO56zyi6VLq-fBUBVUvk1VFxUEQLy1tDMDicdv3NTfVTEr9_eUCiD5cJFqO5tO98866lM9166OzslTjGuF-3OSFVqHTcIb5-QQBFvjtuMZT1GiuSRD-h_hnsXd4vg&usqp=CAc",
          purchaseUrl: "#"
        },
        {
          name: "Corduroy shorts",
          brand: "H&M",
          description: "Relaxed vintage-inspired shorts in corduroy with soft texture.",
          price: "$50",
          imageUrl: "https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcR2oOYJ7k7lt2qf-Py100ZVbQgWY3_aKdlP55kMZr_wWSJFeyD16TqPvyaaOJuCNNJsxgEheCgd0b53xE5znp2o795daxyPLmHBiCfKy4wVOZnQiqf04LSNk0N8YxZsVLE4jZraARz6&usqp=CAc",
          purchaseUrl: "#"
        },
        {
          name: "White linen shirt",
          brand: "Ralph Lauren",
          description: "Breezy linen button-down shirt in crisp white for effortless elegance.",
          price: "$110",
          imageUrl: "https://encrypted-tbn2.gstatic.com/shopping?q=tbn:ANd9GcQXx4JEp5OLAUnNrdt6ifZIB8tRzDJgryqvm8dAmDa37En8S1XAPFTXZgzqLzCLegYzGgGN4sHEDJ59SvTGivPT1Gf8jrlLO5ltQSn_ZnFKRPGxZYeywO5-Hx05pY3zlfWkFUCmlaY&usqp=CAc",
          purchaseUrl: "#"
        },
        {
          name: "White polo shirt",
          brand: "Tommy Hilfiger",
          description: "Iconic white cotton polo with embroidered flag logo.",
          price: "$70",
          imageUrl: "https://img01.ztat.net/article/spp-media-p1/83be198eb1904de29bed8903fa8fc80c/4ab00bc1082b4706a6b1f57f6f0dc0a5.jpg?imwidth=762&filter=packshot",
          purchaseUrl: "#"
        },
        {
          name: "Dark blue polo shirt",
          brand: "Tommy Hilfiger",
          description: "Navy polo with two-button placket and signature Tommy details.",
          price: "$70",
          imageUrl: "https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcS7qBaZCBFwcNT77QRB_mYtfzFUtQ1SruW-MfItO3eIP5PFrxpOaDX8nreMwOUCAybjqbRyJRl09SHbYVIqmv1cRFKFMVgd88OipEc1wSJfa-4DFnqUw6NvfNDs2Bl9gpTwSqMXdCU&usqp=CAc",
          purchaseUrl: "#"
        },
        {
          name: "Nike Court Vision Mid",
          brand: "Nike",
          description: "Classic basketball-inspired mid-top sneakers in all white leather.",
          price: "$90",
          imageUrl: "https://static.nike.com/a/images/t_PDP_936_v1/f_auto%2Cq_auto%3Aeco/dac41466-a8e8-4b3a-99c3-c6e7662dde42/NIKE%2BCOURT%2BVISION%2BMID%2BNN.png",
          purchaseUrl: "#"
        },
        {
          name: "Nike Revolution Comfort",
          brand: "Nike",
          description: "Lightweight dark blue running sneakers with cushioned sole.",
          price: "$65",
          imageUrl: "https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcThc2NBSdlNeRtEJNiWOnwB7ub-22Egvw9FKbaB85dLKRW6aFgIG3Rrb-F5UTrEyxRtdWuyN5lwgk3E7oAemO3yVNDeCIEYWm1NM5JoWM-pEgacO9OTMh1_rW_o2H5omEaMtN1uVig&usqp=CAc",
          purchaseUrl: "#"
        }
      ];
      
      // Only use real recommendations from search, no fallback to static items
      // Keep static items in code but don't use them
      if (!recommendations || recommendations.length === 0) {
        console.log('No real products found from search');
        recommendations = [];
      }

      // Combine analysis with recommendations
      const finalResult = {
        outfitName: analysisJson.outfitName,
        shortDescription: analysisJson.shortDescription,
        rating: analysisJson.rating, // Use the actual rating from the analysis
        isValidPhoto: analysisJson.isValidPhoto,
        recommendations: recommendations
      };
      
      if (__DEV__) {
        console.log('Successfully parsed outfit analysis:', finalResult);
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

export { apiClient, OPENAI_API_URL };
