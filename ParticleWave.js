// Native fallback – plain black background
import { View } from 'react-native';

export default function ParticleWave() {
  return (
    <View
      style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: '#000',
      }}
    />
  );
}
