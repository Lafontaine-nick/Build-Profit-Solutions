import React from 'react';
import { InputAccessoryView, Platform, View } from 'react-native';

type Props = {
  nativeID: string;
  /** Match screen bg — opaque fill avoids iOS painting a black strip above the keyboard. */
  backgroundColor?: string;
};

/** Zero-height iOS accessory so numeric fields do not inherit a stale global Done bar. */
export default function KeyboardPlainAccessory({
  nativeID,
  backgroundColor = '#000000',
}: Props) {
  if (Platform.OS !== 'ios') return null;

  return (
    <InputAccessoryView nativeID={nativeID} backgroundColor={backgroundColor}>
      <View style={{ height: 0, width: '100%' }} collapsable={false} />
    </InputAccessoryView>
  );
}
