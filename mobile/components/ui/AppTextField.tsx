import React from 'react';
import {
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

  // Never let spread props override keyboard / accessory (ZIP vs Phone bugs when keys leak into `props`).
  const spreadProps = { ...props } as Record<string, unknown>;
  delete spreadProps.keyboardType;
  delete spreadProps.textContentType;
  delete spreadProps.inputAccessoryViewID;

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
