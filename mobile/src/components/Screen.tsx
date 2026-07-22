import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

/**
 * Container padrão das telas: fundo da página, respeito ao safe-area no topo
 * e conteúdo rolável centralizado. (Layout mobile-first, como na web.)
 */
export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const insets = useSafeAreaInsets();
  const paddingTop = insets.top + spacing.four;

  if (!scroll) {
    return <View style={[styles.page, { paddingTop }]}>{children}</View>;
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.content, { paddingTop }]}
      keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.page,
  },
  content: {
    paddingHorizontal: spacing.four,
    paddingBottom: spacing.six,
    gap: spacing.four,
  },
});
