import type { PressableStateCallbackType } from 'react-native';

/** react-native-web also reports hover and keyboard focus to Pressable styles. */
export type InteractionState = PressableStateCallbackType & {
  hovered?: boolean;
  focused?: boolean;
};
