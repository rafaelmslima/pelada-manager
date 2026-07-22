import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { colors, radius, spacing } from '@/theme';

/**
 * Placeholder de tela ainda não portada (Fase 1). Mostra título e um aviso.
 */
export function Placeholder({
  icon,
  title,
  description,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}) {
  return (
    <Screen>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.card}>
        <Ionicons name={icon} size={32} color={colors.ink3} />
        <Text style={styles.text}>{description}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Em construção · Fase 1</Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.ink, fontSize: 26, fontWeight: '800' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.cardLg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: spacing.five,
    alignItems: 'center',
    gap: spacing.three,
  },
  text: { color: colors.ink2, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  badge: {
    backgroundColor: colors.raised,
    paddingHorizontal: spacing.three,
    paddingVertical: spacing.one,
    borderRadius: radius.chip,
  },
  badgeText: { color: colors.ink3, fontSize: 12, fontWeight: '600' },
});
