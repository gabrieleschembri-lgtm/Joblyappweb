import React, { forwardRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { useTheme, useThemedStyles } from '../app/theme';
import JoblyIcon, { type JoblyIconName } from './jobly-icon';

type IconTextInputProps = TextInputProps & {
  icon: JoblyIconName;
  containerStyle?: StyleProp<ViewStyle>;
  trailingIcon?: JoblyIconName;
  trailingAccessibilityLabel?: string;
  onTrailingPress?: () => void;
};

const IconTextInput = forwardRef<TextInput, IconTextInputProps>(
  (
    {
      icon,
      containerStyle,
      style,
      trailingIcon,
      trailingAccessibilityLabel,
      onTrailingPress,
      multiline,
      onFocus,
      onBlur,
      placeholderTextColor,
      ...inputProps
    },
    ref
  ) => {
    const { theme } = useTheme();
    const styles = useThemedStyles((t) => createStyles(t));
    const [focused, setFocused] = useState(false);

    return (
      <View
        style={[
          styles.container,
          multiline && styles.multilineContainer,
          focused && styles.containerFocused,
          containerStyle,
        ]}
      >
        <JoblyIcon
          name={icon}
          size="standard"
          color={focused ? theme.colors.primary : theme.colors.muted}
          style={multiline ? styles.multilineIcon : undefined}
        />
        <TextInput
          {...inputProps}
          ref={ref}
          multiline={multiline}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          placeholderTextColor={placeholderTextColor ?? theme.colors.muted}
          selectionColor={theme.colors.primary}
          style={[styles.input, multiline && styles.multilineInput, style]}
        />
        {trailingIcon && onTrailingPress ? (
          <Pressable
            style={styles.trailingButton}
            onPress={onTrailingPress}
            accessibilityRole="button"
            accessibilityLabel={trailingAccessibilityLabel}
            hitSlop={8}
          >
            <JoblyIcon name={trailingIcon} size="standard" color={theme.colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
    );
  }
);

IconTextInput.displayName = 'IconTextInput';

const createStyles = (t: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    container: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.card,
      borderRadius: 12,
      paddingLeft: 14,
      paddingRight: 8,
    },
    containerFocused: {
      borderColor: t.colors.primary,
    },
    multilineContainer: {
      alignItems: 'flex-start',
    },
    multilineIcon: {
      marginTop: 14,
    },
    input: {
      flex: 1,
      minWidth: 0,
      color: t.colors.textPrimary,
      fontSize: 15,
      paddingVertical: 12,
      paddingHorizontal: 0,
    },
    multilineInput: {
      textAlignVertical: 'top',
    },
    trailingButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
    },
  });

export default IconTextInput;
