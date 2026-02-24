import { registerRootComponent } from 'expo';
import { View, ActivityIndicator } from 'react-native';
import { useFonts, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';

import AppNavigator from './navigation/Navigator';

function Navigator() {
  const [fontsLoaded] = useFonts({
    DMSans_500Medium,
    DMSans_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <AppNavigator />;
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => Navigator);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(Navigator);
