import React from 'react';
import {
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  StyleProp,
  ViewStyle,
  TextStyle,
  RefObject,
} from 'react-native';
import { resolveTextInputKeyboardProps, type MultilineKeyboardMode } from '@/constants/inputKeyboardPresets';

/** LOCKED — wraps resolveTextInputKeyboardProps(); see `.cursor/rules/mobile-keyboard-presets.mdc`. */

export type AppTextFieldFocusMode = 'none' | 'text' | 'number';

type Props = TextInputProps & {
  label?: string;
  required?: boolean;
  leftIcon?: React.ReactNode;
  /** Override shell (e.g. match estimate `s.input` in light mode). */
  shellStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  placeholderTextColor?: string;
  wrapperStyle?: StyleProp<ViewStyle>;
  /** Notifies parent of keyboard mode from `keyboardType` on focus/blur. */
  onFocusMode?: (mode: AppTextFieldFocusMode) => void;
  /** `growable` keeps native multiline height; default `compact` for notes-style fields. */
  multilineKeyboardMode?: MultilineKeyboardMode;
  /** Ref to the inner `TextInput` (e.g. custom keypad + blur from parent). */
  textInputRef?: RefObject<TextInput | null>;
};

export default function AppTextField({
  label,
  required,
  leftIcon,
  shellStyle,
  labelStyle,
  style,
  placeholderTextColor = 'rgba(255,255,255,0.34)',
  wrapperStyle,
  onFocusMode,
  multilineKeyboardMode,
  textInputRef,
  onFocus,
  onBlur,
  keyboardType,
  textContentType,
  inputAccessoryViewID,
  ...props
}: Props) {
  const isNumericKeyboard =
    keyboardType === 'phone-pad' ||
    keyboardType === 'decimal-pad';

  const keyboardProps = resolveTextInputKeyboardProps({
    multiline: !!props.multiline,
    multilineMode: props.multiline ? (multilineKeyboardMode ?? 'compact') : undefined,
    returnKeyType: props.returnKeyType,
    keyboardType,
  });

  const useKeyboardPreset = Object.keys(keyboardProps).length > 0;
  const shouldAutoDismiss = useKeyboardPreset && props.onSubmitEditing == null;

  // Never let spread props override keyboard / accessory (ZIP vs Phone bugs when keys leak into `props`).
  const spreadProps = { ...props } as Record<string, unknown>;
  delete spreadProps.keyboardType;
  delete spreadProps.textContentType;
  delete spreadProps.inputAccessoryViewID;
  if (useKeyboardPreset) {
    delete spreadProps.returnKeyType;
    delete spreadProps.blurOnSubmit;
    delete spreadProps.submitBehavior;
    delete spreadProps.multiline;
    delete spreadProps.scrollEnabled;
    delete spreadProps.textAlignVertical;
  }

  return (
    <View style={[styles.wrapper, wrapperStyle]}>
      {!!label && (
        <Text style={[styles.label, labelStyle]}>
          {label}
          {required ? ' *' : ''}
        </Text>
      )}

      <View style={[styles.inputShell, shellStyle]}>
        {!!leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}

        <TextInput
          ref={textInputRef}
          {...(spreadProps as TextInputProps)}
          {...keyboardProps}
          {...(shouldAutoDismiss
            ? { onSubmitEditing: () => Keyboard.dismiss() }
            : {})}
          style={[
            styles.input,
            leftIcon ? { paddingLeft: 8 } : null,
            style,
          ]}
          placeholderTextColor={placeholderTextColor}
          selectionColor="#2EE6A6"
          cursorColor={Platform.OS === 'ios' ? '#2EE6A6' : undefined}
          autoCapitalize={props.autoCapitalize ?? 'sentences'}
          autoCorrect={props.autoCorrect ?? false}
          onFocus={(e) => {
            onFocusMode?.(isNumericKeyboard ? 'number' : 'text');
            onFocus?.(e);
          }}
          onBlur={(e) => {
            onFocusMode?.('none');
            onBlur?.(e);
          }}
          textContentType={textContentType}
          keyboardType={keyboardType}
          inputAccessoryViewID={inputAccessoryViewID}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 18,
  },
  label: {
    color: '#F5F7FA',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  inputShell: {
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: '#0B0B0D',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  leftIcon: {
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '500',
    paddingVertical: 16,
    ...(Platform.OS === 'web'
      ? ({
          outlineStyle: 'none',
          outlineWidth: 0,
        } as const)
      : {}),
  },
});
