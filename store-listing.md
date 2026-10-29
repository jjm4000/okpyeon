# Chrome Web Store listing

<!-- Firefox (addons.mozilla.org) reuses this file: the same name, the same
     detailed description and both screenshot sets. AMO's summary field
     allows 250 characters, so the short description below fits as is.
     Package: okpyeon-firefox-<version>.zip from pipeline/make_firefox.py.
     Add-on id okpyeon@jjm4000.github.io (permanent once submitted).
     Data collection: none. The privacy policy URL is the same. -->

## Name

Okpyeon: Korean Hanja Popup Dictionary

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
     This is Jesse's edited 1.2 text, verbatim (the uploaded version is the
     canonical one): user-facing sections ordered by value, navigation
     mechanics cut, and cryptic examples decoded in short parentheticals.
     The 1.3 text below is Jesse's own edit, verbatim, with the WHAT IS
     INSIDE counts corrected to the built data after the glyph-alias
     merge. He cut the drafted KOREAN LANGUAGE MODE section from the
     English listing; it stays in the Korean one.
     1.4 (2026-10-14): every WHAT IS INSIDE count re-verified against the
     built data. Two moved, in both listings: native words 15,527 to
     16,607 (native.json headwords, now including 604 place names and
     the mixed-form hybrids) and native Korean definitions 12,071 to
     13,115 (keys in the Korean natives table). The rest are unchanged.
     1.5 (2026-10-28): drafted by Claude for Jesse's edit, in both
     listings. Native words lose "(optional)" (on by default) and gain the
     conjugated-form sentence; the readings section names word cards; two
     new sections, recent lookups and turning the popup off on a site.
     Every WHAT IS INSIDE count re-verified against the built data: all
     unchanged, plus the new word-level readings (Japanese 16,969 words,
     Mandarin 14,755). JMdict joins the sources. -->

Okpyeon is a popup hanja dictionary for Korean learners. Much of Korean vocabulary is built from hanja roots the way English words are built from Latin, so once you know that 國 is 나라 국, the shared root in 국민, 국가, and 외국 becomes visible.

Select text on any page and a card appears. Or click the toolbar icon for a sidebar with a search box; typing hj in the address bar searches from anywhere.

--  CHARACTERS INTO KOREAN  --
Select a hanja to see its eumhun (나라 국 for 國), English definitions, and common compounds. Simplified Chinese and Japanese forms resolve to the same entries, so those pages work too.

--  KOREAN WORDS INTO HANJA  --
Highlight a Sino-Korean word in hangul to see its hanja, meaning, and component characters. A word with several spellings shows all of them (사기: 詐欺, 士氣, 沙器).

--  CHARACTERS SPLIT INTO PARTS  --
A character's card shows what it is made of (樂 = 幺 + 白 + 幺 + 木), each part with its own reading, and which other characters use it as a component. The part that gives a character its sound is marked. For example, in 請 (청), that part is 靑 (청).

--  SAVED WORDS AND ANKI EXPORT  --
Star any card to save it into a folder. Folders export as an Anki text file or a CSV, with adjustable card fields in the settings section.

--  NO KOREAN KEYBOARD NEEDED  --
Typing toddlf (what would normally be the keys for ㅅㅐㅇㅇㅣㄹ on a Korean keyboard) finds 생일, and gungmin or gukmin (romanized versions) finds 국민.

--  BROWSE BY SOUND  --
Highlight a single syllable like 국 to list every hanja read that way.

--  EVERY CHARACTER IS GRADED  --
Middle school and High school mark the roughly 1,800 characters of the Korean Ministry of Education list. Advanced and Rare cover everything else, so a glance tells you whether a character is worth your time.

--  NATIVE KOREAN WORDS  --
Native words get their own cards too, and search gains an All words scope, making Okpyeon a dictionary of all Korean. A conjugated form finds its dictionary form: 먹었어 (ate) opens 먹다 (to eat). One setting turns native words off.

--  JAPANESE AND CHINESE READINGS (OPTIONAL)  --
Two settings add the on'yomi and pinyin beside the Korean reading, on character cards and on word cards: 學 is 학 in Korean, ガク in Japanese, xué in Mandarin, and 學校 (school) is がっこう and xuéxiào.

--  RECENT LOOKUPS  --
The empty sidebar lists what you looked up last, on a page or in the search box. The list stays on your computer, and one setting turns it off.

--  TURN IT OFF ON A SITE  --
The line at the bottom of the popup turns it off on that site with one click. The settings list those sites, to turn back on.

--  WHAT IS INSIDE  --
- 9,415 hanja characters with readings, eumhun, definitions, levels and compounds
- 27,620 Sino-Korean words indexed by both hanja and hangul
- 16,607 native Korean words
- Korean definitions for 25,508 Sino-Korean words, 13,115 native words, and 3,983 characters
- Japanese readings for 3,513 characters and 16,969 words, Mandarin readings for 9,195 characters and 14,755 words
- 9,130 character decompositions, with the sound-giving part marked on 7,151
- 3,791 variant mappings covering simplified Chinese and Japanese shinjitai

--  PRIVATE AND OFFLINE  --
The whole dictionary ships inside the extension. It makes no network requests and collects no data, and saved words and recent lookups stay on your device.

--  SOURCES  --
Definitions and compounds: English Wiktionary via kaikki.org (CC BY-SA). Korean definitions: 우리말샘, National Institute of Korean Language (CC BY-SA 2.0 KR), and Korean Wiktionary for characters (CC BY-SA). Variant mappings, Chinese readings, and sound-giving parts: Wiktionary and Unicode Unihan. Japanese readings: the joyo kanji table via Wikipedia (CC BY-SA), and for words JMdict (EDRDG, CC BY-SA 4.0). Decompositions: BabelStone IDS (public domain). School tiers: the Korean Wikipedia article 대한민국 중고등학교 기초한자 목록 (CC BY-SA 4.0). The Advanced and Rare levels are Okpyeon's own classification.

Support the project: ko-fi.com/okpyeon

## Korean listing (dashboard language 한국어)

<!-- Draft for Jesse to edit, the way the English was. The name and the
     short description come from the package (_locales/ko), so only the
     detailed description is pasted here. Same plain-text rules: dash
     separators, no blank line after a separator. Mirrors his 1.3 English
     edit (no 국민/國民 parentheticals, the sound sentence split, "most
     common first" dropped, the ko-fi line) and keeps the Korean mode
     section, which he cut from the English listing. The Korean listing
     addresses native speakers deepening their own vocabulary, not
     learners of Korean (user rule), so the keyboard-free search section
     is left out here: a Korean user has a Korean keyboard. -->

Name (from the package): 옥편: 한자 팝업 사전

Short description (from the package, 70 chars): 한자 학습 도구. 한자·한자(간체)·일본어 한자를 드래그하면 한국어 음훈과 뜻을, 한글 단어를 드래그하면 한자를 보여 줍니다.

Detailed description:

옥편은 웹 페이지 위에서 바로 쓰는 한자 팝업 사전입니다. 한국어 어휘의 많은 부분이 한자로 이루어져 있어서, 國이 나라 국이라는 것을 알면 국민, 국가, 외국에 같은 뿌리가 보입니다.

페이지에서 글자를 드래그하면 카드가 뜹니다. 툴바 아이콘을 누르면 검색창이 있는 사이드바가 열리고, 주소창에 hj를 입력하면 어디서든 검색할 수 있습니다.

--  한자를 우리말로  --
한자를 드래그하면 음훈(國은 나라 국), 뜻풀이, 자주 쓰는 단어가 나옵니다. 중국어 간체와 일본어 한자도 같은 글자로 찾아 주므로 중국어와 일본어 페이지에서도 쓸 수 있습니다.

--  한글 단어를 한자로  --
한글로 쓰인 한자어를 드래그하면 한자, 뜻, 구성 한자가 나옵니다. 한자 표기가 여럿인 단어는 모두 보여 줍니다(사기: 詐欺, 士氣, 沙器).

--  한자의 짜임  --
글자 카드에는 그 글자가 무엇으로 이루어졌는지(樂 = 幺 + 白 + 幺 + 木), 각 부분의 음훈, 그리고 그 글자를 부분으로 쓰는 다른 글자들이 나옵니다. 소리를 나타내는 부분에는 표시가 붙습니다. 예를 들어 請(청)에서는 靑(청)이 그 부분입니다.

--  단어 저장과 Anki 내보내기  --
카드의 별을 누르면 폴더에 저장됩니다. 폴더는 Anki 텍스트 파일이나 CSV로 내보낼 수 있고, 카드 앞뒷면 항목은 설정에서 고를 수 있습니다.

--  소리로 찾기  --
국처럼 한 글자만 드래그하면 그 소리로 읽는 모든 한자가 나옵니다.

--  모든 글자에 등급  --
중학과 고등은 교육부 기초 한자 1,800자 정도를 표시합니다. 고급과 희귀는 그 밖의 글자로, 한눈에 익힐 만한 글자인지 알 수 있습니다. 고급과 희귀는 옥편 자체 분류입니다.

--  고유어  --
고유어도 카드로 보여 주고, 검색에 전체 단어 범위가 생겨 한국어 전체 사전으로 쓸 수 있습니다. 활용된 형태는 기본형을 찾아 줍니다. 먹었어를 드래그하면 먹다가 나옵니다. 설정에서 끌 수 있습니다.

--  일본어와 중국어 읽기 (선택)  --
설정 둘로 글자 카드와 단어 카드에 음독과 병음이 한국어 음 옆에 붙습니다. 學은 한국어로 학, 일본어로 ガク, 중국어로 xué이고, 學校는 がっこう, xuéxiào입니다.

--  최근 찾아본 항목  --
검색창이 비어 있으면 사이드바에 최근에 찾아본 항목이 나옵니다. 페이지에서 찾은 것도 검색한 것도 이 컴퓨터에만 저장되며, 설정에서 끌 수 있습니다.

--  사이트별로 끄기  --
팝업 맨 아래 줄을 누르면 그 사이트에서는 팝업이 뜨지 않습니다. 끈 사이트는 설정에서 다시 켤 수 있습니다.

--  한국어 화면과 뜻풀이  --
설정 하나로 메뉴, 항목 이름, 뜻풀이가 모두 한국어로 바뀝니다. 뜻풀이는 국립국어원의 개방형 사전 우리말샘에서 가져오며, 카드마다 우리말샘 항목으로 가는 링크가 있습니다. 크롬이 한국어로 설정되어 있으면 처음부터 한국어로 시작합니다.

--  들어 있는 것  --
- 한자 9,415자의 음, 음훈, 뜻풀이, 등급, 단어
- 한자어 27,620개, 한자와 한글 양쪽으로 찾기
- 고유어 16,607개
- 한자어 25,508개, 고유어 13,115개, 한자 3,983자의 한국어 뜻풀이
- 일본어 읽기 한자 3,513자와 단어 16,969개, 중국어 읽기 한자 9,195자와 단어 14,755개
- 한자 짜임 9,130자, 그중 7,151자에 소리 부분 표시
- 간체와 일본 신자체를 포함한 이체자 대응 3,791개

--  개인 정보와 오프라인  --
사전 전체가 확장 프로그램 안에 들어 있습니다. 네트워크 요청을 하지 않고, 아무 정보도 수집하지 않으며, 저장한 단어와 최근 찾아본 항목은 기기 안에만 있습니다.

--  출처  --
뜻풀이와 단어: 영어 위키낱말사전 (kaikki.org 경유, CC BY-SA). 한국어 뜻풀이: 국립국어원 우리말샘 (CC BY-SA 2.0 KR), 한자는 한국어 위키낱말사전도 참고 (CC BY-SA). 이체자 대응, 중국어 읽기, 소리 부분: 위키낱말사전과 유니코드 Unihan. 일본어 읽기: 위키백과의 상용한자표 (CC BY-SA), 단어는 JMdict (EDRDG, CC BY-SA 4.0). 한자 짜임: BabelStone IDS (퍼블릭 도메인). 학교 등급: 한국어 위키백과 대한민국 중고등학교 기초한자 목록 (CC BY-SA 4.0). 고급과 희귀 등급은 옥편 자체 분류입니다.

프로젝트 후원: ko-fi.com/okpyeon

## Privacy tab (dashboard form)

Single purpose description:

Looks up the Korean reading and meaning of Chinese characters (hanja, hanzi, kanji) and Korean words that are written with hanja, when the user selects them on a webpage.

sidePanel justification:

Clicking the toolbar icon opens the extension's dictionary in the side panel: a search box over the same offline dictionary that selection lookups use, plus the user's saved words and settings. The panel shows only the extension's own dictionary content, nothing from the page, and makes no network requests.

storage justification:

Users can star dictionary entries to save them into folders for later study and export, see their recent lookups in the sidebar, turn the popup off on sites they choose, and adjust a few preferences such as the default folder and the Anki card layout. Saved entries, recent lookups and settings are kept in chrome.storage.local on the user's own device. Nothing is transmitted anywhere.

Host permission justification:

The content script needs to run on all pages so users can highlight hanja or Korean text on any website and see a definition popup. It does not read, modify, or transmit page content beyond the text the user selects, and makes no network requests.

Remote code: No. Data usage: no categories collected; all three certifications checked.

Privacy policy URL: https://jjm4000.github.io/okpyeon/privacy-policy.html
Homepage: https://github.com/jjm4000/okpyeon
