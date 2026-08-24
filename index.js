import {
  DMSans_500Medium,
  DMSans_700Bold,
  useFonts,
} from "@expo-google-fonts/dm-sans";
import { registerRootComponent } from "expo";
import { ActivityIndicator, View } from "react-native";

import AppNavigator from "./core/components/navigation/Navigator";

function Navigator() {
  const [fontsLoaded] = useFonts({
    DMSans_500Medium,
    DMSans_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ alignItems: "center", flex: 1, justifyContent: "center" }}>
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
