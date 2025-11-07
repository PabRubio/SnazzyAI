# 🔐 Google Sign-In Setup for React Native

## Prerequisites

You already have:
- ✅ Google Cloud Console OAuth Client ID
- ✅ Supabase configured with Google OAuth

Now you need to configure the mobile apps.

---

## Step 1: Get Web Client ID from Google Cloud Console

1. Go to: https://console.cloud.google.com/apis/credentials

2. Find your **OAuth 2.0 Client ID** (Type: Web application)

3. Copy the **Client ID** - it looks like:
   ```
   100333808813-kmd7l1lkm9k18g99g1ah0dogn2o0rb8e.apps.googleusercontent.com
   ```

4. **Save this** - you'll need it in Step 3

---

## Step 2: Create Android OAuth Client (Required for Android)

1. In Google Cloud Console → Credentials → "+ CREATE CREDENTIALS" → "OAuth client ID"

2. Application type: **"Android"**

3. Name: `SnazzyAI Android Client`

4. **Package name**: Get it by running:
   ```bash
   cd android && grep applicationId app/build.gradle
   ```

   It should be something like: `com.snazzy` or `com.yourname.snazzy`

5. **SHA-1 certificate fingerprint**: Get it by running:
   ```bash
   cd android && ./gradlew signingReport
   ```

   Copy the **SHA-1** from the **debug** variant (looks like: `AA:BB:CC:...`)

6. Click **CREATE**

7. ✅ You'll get an Android Client ID (save it, but you won't need to paste it anywhere - Google handles it automatically)

---

## Step 3: Create iOS OAuth Client (Required for iOS)

1. In Google Cloud Console → Credentials → "+ CREATE CREDENTIALS" → "OAuth client ID"

2. Application type: **"iOS"**

3. Name: `SnazzyAI iOS Client`

4. **Bundle ID**: Get it from:
   ```bash
   grep PRODUCT_BUNDLE_IDENTIFIER ios/snazzy.xcodeproj/project.pbxproj
   ```

   It should be something like: `com.snazzy` or `org.reactjs.native.example.snazzy`

5. Click **CREATE**

6. ✅ You'll get an iOS Client ID (save it for later)

---

## Step 4: Configure App with Web Client ID

1. Create/update `.env` file in project root:

   ```bash
   # Add this to your .env file
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=100333808813-kmd7l1lkm9k18g99g1ah0dogn2o0rb8e.apps.googleusercontent.com
   ```

   **Replace with YOUR actual Web Client ID from Step 1!**

2. For iOS, also add the **iOS Client ID URL Scheme**:

   - Open `ios/snazzy/Info.plist`
   - Add this (replace `YOUR_REVERSED_CLIENT_ID` with your iOS Client ID reversed):

   ```xml
   <key>CFBundleURLTypes</key>
   <array>
     <dict>
       <key>CFBundleTypeRole</key>
       <string>Editor</string>
       <key>CFBundleURLSchemes</key>
       <array>
         <!-- Example: if iOS Client ID is com.googleusercontent.apps.123456789-abc -->
         <!-- Then reversed is: com.googleusercontent.apps.123456789-abc -->
         <string>com.googleusercontent.apps.YOUR_IOS_CLIENT_ID_HERE</string>
       </array>
     </dict>
   </array>
   ```

---

## Step 5: Rebuild Native Apps

After configuration, rebuild:

### Android:
```bash
cd android && ./gradlew clean && cd ..
npx expo run:android
```

### iOS:
```bash
cd ios && rm -rf Pods && pod install && cd ..
npx expo run:ios
```

---

## Verification

After setup, the app should:
1. Show Google Sign-In button
2. Open Google login page when tapped
3. Redirect back to app after login
4. Store session in Supabase

---

## Troubleshooting

### Error: "Developer Error" or "Sign-In Failed"
- Check that you created **all 3** OAuth clients (Web, Android, iOS)
- Verify package name/bundle ID matches exactly
- Make sure SHA-1 fingerprint is correct for Android

### Error: "Redirect URI mismatch"
- Add the Supabase callback URL to **Web Client** authorized redirect URIs
- URL format: `https://lwyuwkcbcgfhhtbfyieo.supabase.co/auth/v1/callback`

### Button doesn't respond
- Run `npx expo prebuild` to regenerate native files
- Rebuild the app completely

---

## Quick Reference

**Web Client ID**: Use this in `.env` file
**Android Client ID**: Auto-detected by Google (no manual config needed)
**iOS Client ID**: Add reversed URL scheme to `Info.plist`

---

All set! Come back when you've completed these steps.
