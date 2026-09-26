/* Worker-profile copy for Tamil.
 *
 * Same reason as ./i18n.skill.ts and ./i18n.bn-gw.ts: the regional dictionaries
 * are kept in side modules so the main i18n dictionary resists large non-ASCII
 * insertions, and so a translation fix never touches the English source of truth.
 *
 * Merged into the `ta` dictionary at module load (see initBnGateway in i18n.tsx). */

export const PROFILE_TA: Record<string, string> = {
  dl_title: "இந்த வாரம் உங்கள் பெசா",
  dl_high: "அதிக தேவை எதிர்பார்க்கப்படுகிறது",
  dl_elevated: "வழக்கத்தை விட அதிகம்",
  dl_normal: "வழக்கமான தேவை",
  dl_footnote: "வானிலை, திருவிழா நாட்காட்டி, சமீபத்தைய வேலைகளின் அடிப்படையில் கூட்டின் மதிப்பீடு — வேலைகளுக்கான உறுதி அல்ல.",

  av_title: "எப்போது கிடைக்கும்",
  av_sub: "வேலை ஏற்கக்கூடிய நேரங்களைக் குறிக்கவும். வாடிக்கையாளர்கள் இதைப் பார்த்தே பதிவு செய்கிறார்கள், எனவே உண்மையாக வைக்கவும்.",
  av_morning: "காலை",
  av_afternoon: "மதியம்",
  av_evening: "மாலை",

  gb_visit: "வருகை",
  gb_details: "விவரங்கள்",
  gb_in: "இல்",
  gb_spots_left: "இடங்கள் காலியாக:",
  gb_others: "குடும்பங்கள் ஏற்கனவே சேர்ந்துள்ளன",
  gb_leave: "இந்தப் பகிர்ந்த வருகையிலிருந்து வெளியேறவும்",
  wp_directory: "கைவினைஞர்கள் — பணம் செலுத்தியவர்களின் மதிப்பீட்டின் அடிப்படையில்",
  wp_missing: "கைவினைஞர் கிடைக்கவில்லை.",
  wp_reputation: "நற்பெயர்",
  wp_no_reviews: "இன்னும் மதிப்பீடு இல்லை",
  wp_years: "ஆண்டுகள் அனுபவம்",
  wp_credential: "கூட்டச் சான்றிதழ்",
  wp_skill_on: "வேலைச் சான்றுகள் ஒப்புதல் செய்யப்பட்டன",
  wp_skill_verified: "வேலை சரிபார்க்கப்பட்டது",
  wp_work_verified: "வேலை சரிபார்க்கப்பட்டது",
  wp_online: "இப்போது கிடைக்கும்",
  wp_work: "இந்தக் கைவினைஞர் வெளியிடும் வேலைகள்",
  wp_top_rated: "சிறந்த மதிப்பீடு",
  wp_tap: "சுயவிவரம் திற",
};
