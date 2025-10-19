// TEMPORARY API KEY STORAGE
// WARNING: This is for development purposes only
// In production, use environment variables and secure storage methods
// Never commit actual API keys to version control

export const ANTHROPIC_API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY || 'your-anthropic-api-key-here';
export const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_API_KEY || 'your-google-api-key-here';

// Validation function to ensure API key is configured
export const validateApiKey = () => {
  if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY === 'your-anthropic-api-key-here') {
    throw new Error('Anthropic API key not configured. Please set ANTHROPIC_API_KEY in constants/apiKeys.js');
  }
  return true;
};

// Validation function for Google API key
export const validateGoogleApiKey = () => {
  if (!GOOGLE_API_KEY || GOOGLE_API_KEY === 'your-google-api-key-here') {
    throw new Error('Google API key not configured. Please set GOOGLE_API_KEY in constants/apiKeys.js or .env');
  }
  return true;
};

// Simple obfuscation for logging (shows only first 4 and last 4 characters)
export const obfuscateApiKey = (key) => {
  if (!key || key.length < 8) return '****';
  return `${key.substring(0, 4)}****${key.substring(key.length - 4)}`;
};