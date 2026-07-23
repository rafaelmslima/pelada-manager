import * as Haptics from 'expo-haptics';

/**
 * Feedback tátil central do app. Cada chamada é protegida: se o módulo nativo não
 * estiver disponível (ex.: rodando por OTA num build antigo), vira no-op em vez de crashar.
 * Requer um build nativo com `expo-haptics` (não vai por OTA).
 */
function run(fn: () => Promise<unknown>): void {
  try {
    fn().catch(() => {});
  } catch {
    /* módulo nativo ausente: ignora */
  }
}

export const haptics = {
  /** Toque leve — seleções, ajustes, +assistência. */
  light: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Toque médio — ações confirmadas (gol, iniciar confronto). */
  medium: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Toque forte — momentos de destaque. */
  heavy: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  /** Sucesso — sorteio pronto, confronto finalizado, pelada encerrada. */
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Aviso — tempo esgotado, mensalista atrasado. */
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  /** Erro — falhas/impedimentos. */
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  /** Seleção — mudança de opção/segmento. */
  select: () => run(() => Haptics.selectionAsync()),
};
