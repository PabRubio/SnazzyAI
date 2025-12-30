import { registerRootComponent } from 'expo';

import Navigator from './navigation/Navigator';

// registerRootComponent calls AppRegistry.registerComponent('main', () => Navigator);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(Navigator);
