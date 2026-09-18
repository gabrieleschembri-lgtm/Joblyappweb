import React, { type ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

export const JOBLY_ICON_SIZES = {
  small: 16,
  standard: 20,
  medium: 24,
  large: 32,
  feature: 44,
} as const;

export type JoblyIconName = ComponentProps<typeof Ionicons>['name'];
export type JoblyIconSize = keyof typeof JOBLY_ICON_SIZES;

type JoblyIconProps = Omit<ComponentProps<typeof Ionicons>, 'size'> & {
  size?: JoblyIconSize | number;
};

const JoblyIcon: React.FC<JoblyIconProps> = ({ size = 'standard', ...props }) => (
  <Ionicons
    {...props}
    size={typeof size === 'number' ? size : JOBLY_ICON_SIZES[size]}
  />
);

export default JoblyIcon;
