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
     Kept deliberately short: one or two sentences per section, examples over
     explanation. -->

Okpyeon is a popup hanja dictionary for Korean learners. Much of Korean vocabulary is built from hanja roots the way English words are built from Latin, so once you know that 國 is 나라 국, the shared root in 국민, 국가, and 외국 becomes visible.

Select text on any page and a card appears. Or click the toolbar icon for a sidebar with a search box that stays open across tabs; typing hj in the address bar searches from anywhere.

--  CHARACTERS INTO KOREAN  --

Select a hanja to get its eumhun (나라 국 for 國), English definitions, and its most common compounds. Simplified Chinese and Japanese shinjitai resolve to the same entries, so those pages work too.

--  KOREAN WORDS INTO HANJA  --

Highlight a Sino-Korean word in hangul to see the hanja behind it: 국민 becomes 國民, and 자본주의는 in a sentence still finds 자본주의. Words break into their component words and characters, all clickable.

--  CHARACTERS SPLIT INTO PARTS  --

A character's card shows what it is made of (樂 opens into 幺, 白, 幺, and 木), each part a full entry of its own, and lists the characters it is itself a part of.

--  EVERY CHARACTER IS GRADED  --

Middle school and High school mark the roughly 1,800 characters of the Korean Ministry of Education list, a natural study list for learners. Advanced and Rare cover everything else, so a glance tells you whether a character is worth your time.

--  NO KOREAN KEYBOARD NEEDED  --

Typing toddlf with the keyboard still in English finds 생일, and gungmin or gukmin finds 국민. A query that reads both ways shows both.

--  BROWSE BY SOUND  --

Highlight a single syllable like 국 to list every hanja read that way, most common first.

--  FOLLOW THE CONNECTIONS  --

Compound lists are complete, a page at a time, and word cards climb upward too: 학생 opens a list of 대학생, 중학생, and the rest. A breadcrumb trail returns to any earlier step.

--  SAVED WORDS AND ANKI EXPORT  --

Star any card to save it into a folder. Folders export as an Anki text file (settings picks the card fields, Japanese and Chinese readings included if you want them, folder names become tags) or as a CSV.

--  MULTIPLE SPELLINGS AND NATIVE WORDS  --

A word with several hanja spellings shows all of them (사기: 詐欺, 士氣, 沙器, and more). Native Korean words return nothing rather than a forced match, and an obscure hanja spelling of a common native word is labelled a rare homograph, not the word's origin.

--  OPTIONAL: NATIVE KOREAN WORDS TOO  --

One setting turns Okpyeon into a dictionary of all Korean. Native words get their own cards, search gains an All words scope, and a word like 사랑 leads with its real meaning, the rare hanja homograph one tap away.

--  OPTIONAL: JAPANESE AND CHINESE READINGS  --

Two settings add each character's Japanese on'yomi and Mandarin pinyin beside its Korean reading: 學 is 학 in Korean, ガク in Japanese, xué in Mandarin. For learners coming from those languages, or heading to them.

--  WHAT IS INSIDE  --

- 9,469 hanja characters with readings, eumhun, definitions, levels and compounds
- 27,627 Sino-Korean words indexed by both hanja and hangul
- 15,527 native Korean words, included when the option is on
- Japanese readings for 3,566 characters and Mandarin for 9,249
- 9,178 character decompositions
- 3,737 variant mappings covering simplified Chinese and Japanese shinjitai

--  PRIVATE AND OFFLINE  --

The whole dictionary ships inside the extension: no network requests, no data collection. Saved words stay on your device.

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
