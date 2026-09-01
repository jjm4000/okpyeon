# Chrome Web Store listing

## Name

Okpyeon: Hanja Popup Dictionary

## Short description (manifest `description`, 132 char limit)

A study tool for Korean learners. Highlight hanja, hanzi, or kanji to read them in Korean, or a hangul word to see its hanja.

<!-- 125 chars. The fuller phrasing "or highlight a Korean (hangul) word" runs
     144 and will not fit this field; it opens the detailed description below.
     Search was considered for 1.1 and left out: every variant that fits under
     132 has to drop either "them" (leaving the ungrammatical "to read in
     Korean") or "a hangul word" (the second half of the value proposition).
     Search is covered in the detailed description and the screenshots. -->

## Detailed description

<!-- The store renders this field as PLAIN TEXT: no markdown, no bold. The
     dash-wrapped uppercase lines are the section separators, pasted as-is.
     Rewritten for 1.2 from the decluttered README (user-directed): user-facing
     only, one or two sentences per section, examples over explanation, no
     implementation reassurances. -->

Okpyeon is a popup hanja dictionary for Korean learners. Much of Korean vocabulary is built from hanja roots the way English words are built from Latin, so once you know that 國 is 나라 국, the shared root in 국민, 국가, and 외국 becomes visible.

Select text on any page and a card appears. Or click the toolbar icon for a sidebar with a search box; typing hj in the address bar searches from anywhere.

--  CHARACTERS INTO KOREAN  --
Select a hanja to see its eumhun (나라 국 for 國), English definitions, and common compounds. Simplified Chinese and Japanese forms resolve to the same entries, so those pages work too.

--  KOREAN WORDS INTO HANJA  --
Highlight a Sino-Korean word in hangul (국민) to see its hanja (國民), meaning, and component characters. A word with several spellings shows all of them (사기: 詐欺, 士氣, 沙器).

--  CHARACTERS SPLIT INTO PARTS  --
A character's card shows what it is made of (樂 = 幺 + 白 + 幺 + 木), each part with its own reading, and which characters use it as a part.

--  EVERY CHARACTER IS GRADED  --
Middle school and High school mark the roughly 1,800 characters of the Korean Ministry of Education list. Advanced and Rare cover everything else, so a glance tells you whether a character is worth your time.

--  NO KOREAN KEYBOARD NEEDED  --
Typing toddlf with the keyboard still in English finds 생일, and gungmin or gukmin finds 국민.

--  BROWSE BY SOUND  --
Highlight a single syllable like 국 to list every hanja read that way, most common first.

--  FOLLOW THE CONNECTIONS  --
Everything on a card is clickable, and word cards climb upward too: 학생 opens a list with 대학생 and 중학생. A breadcrumb trail returns to any earlier step.

--  SAVED WORDS AND ANKI EXPORT  --
Star any card to save it into a folder. Folders export as an Anki text file or a CSV, and settings picks the card fields.

--  NATIVE KOREAN WORDS (OPTIONAL)  --
One setting adds native words as their own cards and an All words search scope, making Okpyeon a dictionary of all Korean.

--  JAPANESE AND CHINESE READINGS (OPTIONAL)  --
Two settings add each character's on'yomi and pinyin beside its Korean reading: 學 is 학 in Korean, ガク in Japanese, xué in Mandarin.

--  WHAT IS INSIDE  --
- 9,469 hanja characters with readings, eumhun, definitions, levels and compounds
- 27,627 Sino-Korean words indexed by both hanja and hangul
- 15,527 native Korean words, included when the option is on
- Japanese readings for 3,566 characters and Mandarin for 9,249
- 9,178 character decompositions
- 3,737 variant mappings covering simplified Chinese and Japanese shinjitai

--  PRIVATE AND OFFLINE  --
The whole dictionary ships inside the extension. It makes no network requests and collects no data, and saved words stay on your device.

--  SOURCES  --
Definitions and compounds: English Wiktionary via kaikki.org (CC BY-SA). Variant mappings and Chinese readings: Wiktionary and Unicode Unihan. Japanese readings: the joyo kanji table via Wikipedia (CC BY-SA). Decompositions: BabelStone IDS (public domain). School tiers: the Korean Wikipedia article 대한민국 중고등학교 기초한자 목록 (CC BY-SA 4.0). The Advanced and Rare levels are Okpyeon's own classification.

## Privacy tab (dashboard form)

Single purpose description:

Looks up the Korean reading and meaning of Chinese characters (hanja, hanzi, kanji) and Korean words that are written with hanja, when the user selects them on a webpage.

sidePanel justification:

Clicking the toolbar icon opens the extension's dictionary in the side panel: a search box over the same offline dictionary that selection lookups use, plus the user's saved words and settings. The panel shows only the extension's own dictionary content, nothing from the page, and makes no network requests.

storage justification:

Users can star dictionary entries to save them into folders for later study and export, and adjust a few preferences such as the default folder and the Anki card layout. Saved entries and settings are kept in chrome.storage.local on the user's own device. Nothing is transmitted anywhere.

Host permission justification:

The content script needs to run on all pages so users can highlight hanja or Korean text on any website and see a definition popup. It does not read, modify, or transmit page content beyond the text the user selects, and makes no network requests.

Remote code: No. Data usage: no categories collected; all three certifications checked.

Privacy policy URL: https://jjm4000.github.io/okpyeon/privacy-policy.html
Homepage: https://github.com/jjm4000/okpyeon
