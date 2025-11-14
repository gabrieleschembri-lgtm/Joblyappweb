import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

type MapPinProps = {
  color?: string;
  accentColor?: string;
  style?: StyleProp<ViewStyle>;
};

const MapPin: React.FC<MapPinProps> = ({
  color = '#2563eb',
  accentColor = '#ffffff',
  style,
}) => {
  return (
    <View style={[styles.wrapper, style]}>
      <View style={[styles.shell, { backgroundColor: color }]}>
        <View style={[styles.dot, { backgroundColor: accentColor }]} />
      </View>
      <View style={[styles.pointer, { borderTopColor: color }]} />
      <View style={styles.base} />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  shell: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 5,
    backgroundColor: '#2563eb',
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  pointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#2563eb',
    marginTop: -2,
  },
  base: {
    width: 28,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0f172a',
    opacity: 0.25,
    marginTop: 2,
  },
});

export default MapPin;
