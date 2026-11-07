import { Linking } from 'react-native';

/** WhatsApp number that receives Premium requests: 0766107047, written in international format (212…, no + or leading 0). */
export const WHATSAPP_NUMBER = '212766107047';

/**
 * Opens WhatsApp with the message already written. The user only has to tap Send:
 * an app can't send a WhatsApp message by itself.
 * Without WhatsApp installed, wa.me opens in the browser instead.
 */
export async function openWhatsApp(message: string): Promise<boolean> {
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

export function premiumRequestMessage(user: { email: string; id: string; name: string }) {
  return [
    "Bonjour, je souhaite activer l'abonnement Premium de l'application Marchés Publics.",
    `Nom : ${user.name}`,
    `E-mail du compte : ${user.email}`,
    `N° de compte : ${user.id}`,
  ].join('\n');
}

export function passwordResetMessage(email: string) {
  return [
    "Bonjour, j'ai oublié le mot de passe de mon compte Marchés Publics.",
    `E-mail du compte : ${email}`,
  ].join('\n');
}
