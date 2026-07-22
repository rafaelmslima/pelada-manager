import { useState } from 'react';
import { Alert, Share } from 'react-native';

import { PrimaryButton } from '@/components/form';
import { api, ApiError } from '@/lib/api';
import { getApiBaseUrl } from '@/lib/config';

/**
 * Gera (ou reaproveita) o link público de confirmação e abre o compartilhamento
 * nativo do device para o organizador mandar no WhatsApp/grupo.
 */
export function ConvocarButton({ peladaName, label = 'Convocar (enviar link)' }: { peladaName: string; label?: string }) {
  const [loading, setLoading] = useState(false);

  async function convocar() {
    setLoading(true);
    try {
      const link = await api.confirmationLink();
      const url = `${getApiBaseUrl()}${link.path}`;
      await Share.share({
        message: `⚽ Bora pra ${peladaName}? Confirma sua presença aqui:\n${url}`,
      });
    } catch (err) {
      Alert.alert(
        'Não foi possível gerar o link',
        err instanceof ApiError ? err.message : 'Verifique a conexão com o servidor.',
      );
    } finally {
      setLoading(false);
    }
  }

  return <PrimaryButton label={label} onPress={convocar} loading={loading} />;
}
