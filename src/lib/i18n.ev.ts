/* Work-evidence release copy for Hindi, Telugu, Tamil and Bengali.
 *
 * Side module (see ./i18n.profile.ts for the reasoning): the regional
 * dictionaries resist large non-ASCII insertions, so these are merged via
 * initBnGateway() in i18n.tsx. The English keys live in i18n.tsx.
 */

export const EV_HI: Record<string, string> = {
  ev_released: "फ़ोटो सत्यापन के बाद हटा दी गई",
};

export const EV_TE: Record<string, string> = {
  ev_released: "ధృవీకరణ తర్వాత ఫోటో తొలగించబడింది",
};

export const EV_TA: Record<string, string> = {
  ev_released: "சரிபார்த்த பின் படம் நீக்கப்பட்டது",
};

export const EV_BN: Record<string, string> = {
  ev_released: "যাচাইয়ের পর ছবি মুছে ফেলা হয়েছে",
};
