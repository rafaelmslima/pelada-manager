import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '@/theme';

/**
 * Bottom sheet simples (RN Modal deslizando de baixo), com backdrop que fecha ao
 * tocar fora. Equivalente aos bottom sheets da web (rounded-t + drag handle).
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Pressable interno com noop captura o toque e impede que feche ao tocar no conteúdo. */}
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + spacing.four }]} onPress={() => {}}>
          <View style={styles.handle} />
          {title ? <Text style={styles.title}>{title}</Text> : null}
          <ScrollView keyboardShouldPersistTaps="handled" style={styles.body} contentContainerStyle={styles.bodyContent}>
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(26,23,20,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.four,
    paddingTop: spacing.two,
    maxHeight: '88%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border2,
    marginBottom: spacing.three,
  },
  title: { color: colors.ink, fontSize: 18, fontWeight: '800', marginBottom: spacing.three },
  body: { flexGrow: 0 },
  bodyContent: { gap: spacing.three, paddingBottom: spacing.two },
});
