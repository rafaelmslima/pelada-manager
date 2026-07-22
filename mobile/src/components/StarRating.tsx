import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { colors } from '@/theme';

/** Seletor de nota por estrelas (0 a 5). Tocar na mesma estrela zera. */
export function StarRating({
  value,
  onChange,
  size = 26,
}: {
  value: number;
  onChange: (value: number) => void;
  size?: number;
}) {
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity key={n} onPress={() => onChange(n === value ? 0 : n)} hitSlop={4} activeOpacity={0.7}>
          <Ionicons
            name={n <= value ? 'star' : 'star-outline'}
            size={size}
            color={n <= value ? colors.gold : colors.ink4}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 2 },
});
