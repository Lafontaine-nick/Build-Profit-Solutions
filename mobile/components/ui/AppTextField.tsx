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
} from 'react-native';

type Props = TextInputProps & {
  label?: string;
  required?: boolean;
  accessoryID?: string;
  leftIcon?: React.ReactNode;
  /** Override shell (e.g. match estimate `s.input` in light mode). */
  shellStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  placeholderTextColor?: string;
  wrapperStyle?: StyleProp<ViewStyle>;
};

export default function AppTextField({
  label,
  required,
  accessoryID,
  leftIcon,
  shellStyle,
  labelStyle,
  style,
  placeholderTextColor = 'rgba(255,255,255,0.34)',
  wrapperStyle,
  ...props
}: Props) {
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
          {...props}
          style={[
            styles.input,
            leftIcon ? { paddingLeft: 8 } : null,
            style,
          ]}
          placeholderTextColor={placeholderTextColor}
          selectionColor="#2EE6A6"
          cursorColor={Platform.OS === 'ios' ? '#2EE6A6' : undefined}
          inputAccessoryViewID={Platform.OS === 'ios' ? accessoryID : undefined}
          autoCapitalize={props.autoCapitalize ?? 'sentences'}
          autoCorrect={props.autoCorrect ?? false}
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
  },
});
