/* Gateway-checkout copy for Telugu, Tamil and Bengali.
 *
 * Kept in a side module (see ./i18n.profile.ts for the reasoning): the regional
 * dictionaries resist large non-ASCII insertions, and a translation fix never
 * touches the English source of truth. Merged into the regional dictionaries at
 * module load (see the DICTS object in i18n.tsx). */

export const GATEWAY_TE: Record<string, string> = {
  bd_gw_pay: "సురక్షితంగా చెల్లించండి",
  bd_gw_note:
    "Razorpay ద్వారా కార్డ్, UPI లేదా నెట్‌బ్యాంకింగ్ — ఫెడరేషన్ బోర్డుకు సంతకం చేసిన రసీదు వెళ్తుంది; కింది UPI QR నేరుగా కళాకారుడికే చెల్లిస్తుంది.",
};

export const GATEWAY_TA: Record<string, string> = {
  bd_gw_pay: "பாதுகாப்பாகச் செலுத்துங்கள்",
  bd_gw_note:
    "Razorpay வழியாக அட்டை, UPI அல்லது நெட்‌பேங்கிங் — பெடரேஷன் வாரியத்திற்கு கையொப்பமிடப்பட்ட ரசீது செல்கிறது; கீழே உள்ள UPI QR கைத்தொழிலாளிக்கே நேரடியாகச் செலுத்துகிறது.",
};

export const GATEWAY_BN: Record<string, string> = {
  bd_gw_pay: "নিরাপদে পরিশোধ করুন",
  bd_gw_note:
    "Razorpay-এর মাধ্যমে কার্ড, UPI বা নেট ব্যাংকিং — ফেডারেশন বোর্ডে স্বাক্ষরিত রসিদ যায়; নিচের UPI QR সরাসরি কারিগরকেই টাকা দেয়।",
};
