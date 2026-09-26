/* Gateway-checkout copy for Telugu.
 *
 * Kept in a side module (see ./i18n.profile.ts for the reasoning): the regional
 * dictionaries resist large non-ASCII insertions, and a translation fix never
 * touches the English source of truth. Merged into the `te` dictionary at
 * module load (see initBnGateway in i18n.tsx). */

export const GATEWAY_TE: Record<string, string> = {
  bd_gw_pay: "₹{amount} సురక్షితంగా చెల్లించండి",
  bd_gw_note:
    "Razorpay ద్వారా కార్డ్, UPI లేదా నెట్‌బ్యాంకింగ్ — ఫెడరేషన్ బోర్డుకు సంతకం చేసిన రసీదు వెళ్తుంది; కింది UPI QR నేరుగా కళాకారుడికే చెల్లిస్తుంది.",
};
