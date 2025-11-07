# 🏠 HomeScreen.js Supabase Integration Summary

## What I'm Updating:

### **1. Load Profile on Mount** ✅
- Fetch user profile from Supabase when screen loads
- Populate all settings fields with saved data
- Show loading spinner while fetching

### **2. Save Settings to Supabase** ✅
- When user clicks "Save Settings", save to database
- Update profile table with all user preferences
- Show success message

### **3. Add Sign Out Button** ✅
- Add "Sign Out" button in settings
- Calls `supabase.auth.signOut()`
- Returns user to AuthScreen

### **4. Keep All UI** ✅
- No visual changes - same beautiful design
- Just connecting to backend instead of local state

---

## Files Being Modified:

1. `HomeScreen.js` - Main updates (load/save profile, sign out)

---

## Key Changes:

```javascript
// OLD: Local state only
const [name, setName] = useState('');

// NEW: Load from Supabase on mount
useEffect(() => {
  loadProfile();
}, []);

const loadProfile = async () => {
  const profile = await getProfile();
  setName(profile.name);
  // ... etc
};

// Save to Supabase
const handleSaveSettings = async () => {
  await updateProfile({
    name, email, birth, gender, // ... all fields
  });
};
```

---

This keeps your app working exactly the same, but data persists across devices! 🚀
