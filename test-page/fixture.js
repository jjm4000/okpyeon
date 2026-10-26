// Okpyeon test harness: the fake service worker and its fixture data,
// shared by test-page/index.html and test-page/embed.html (loaded with a
// plain <script src>, so it also works from file://). It installs
// globalThis.__hanjaHoverTestRuntime and must load BEFORE content.js.
// Until 2026-10-24 this block was inlined into both pages and kept
// byte-identical by hand.

(function () {
  "use strict";

  var VARIANTS = { "国": "國", "学": "學", "汉": "漢" };

  // Compact constructor for the long tail of fixture characters.
  function C(hun, eum, gloss, compounds) {
    return {
      eumhun: [{ hun: hun, eum: eum }],
      readings: [eum],
      glosses: gloss ? [gloss] : [],
      compounds: compounds || []
    };
  }

  var CHARS = {
    "國": { eumhun: [{ hun: "나라", eum: "국" }], readings: ["국"],
            glosses: ["country; state; nation"],
            compounds: [
              { hangul: "국민", hanja: "國民", gloss: "the people of a nation" },
              { hangul: "한국", hanja: "韓國", gloss: "Korea" },
              { hangul: "국가", hanja: "國家", gloss: "state; nation" },
              { hangul: "외국", hanja: "外國", gloss: "foreign country" },
              { hangul: "국어", hanja: "國語", gloss: "national language" },
              { hangul: "국제", hanja: "國際", gloss: "international (bound form)" }
            ] },
    "民": { eumhun: [{ hun: "백성", eum: "민" }], readings: ["민"],
            glosses: ["people; populace; subjects"],
            compounds: [
              { hangul: "국민", hanja: "國民", gloss: "the people of a nation" },
              { hangul: "민족", hanja: "民族", gloss: "ethnic group; people" },
              { hangul: "시민", hanja: "市民", gloss: "citizen" }
            ] },
    // Five inline compounds, the last of them deliberately HANGUL-ONLY (no
    // hanja spelling — those exist in the real data): that row must render
    // without a chevron and must not navigate.
    "學": { eumhun: [{ hun: "배울", eum: "학" }], readings: ["학"],
            glosses: ["to learn; study", "school; learning"],
            compounds: [
              { hangul: "학생", hanja: "學生", gloss: "student" },
              { hangul: "대학", hanja: "大學", gloss: "university" },
              { hangul: "학교", hanja: "學校", gloss: "school" },
              { hangul: "과학", hanja: "科學", gloss: "science" },
              { hangul: "학벌", gloss: "academic clique" }
            ] },
    "生": { eumhun: [{ hun: "날", eum: "생" }], readings: ["생"],
            glosses: ["to be born; to live", "raw; fresh"],
            compounds: [
              { hangul: "학생", hanja: "學生", gloss: "student" },
              { hangul: "생일", hanja: "生日", gloss: "birthday" }
            ] },
    "韓": { eumhun: [{ hun: "나라", eum: "한" }], readings: ["한"],
            glosses: ["Korea (bound form)"],
            compounds: [{ hangul: "한국", hanja: "韓國", gloss: "Korea" }] },
    "漢": { eumhun: [{ hun: "한수", eum: "한" }, { hun: "한나라", eum: "한" }],
            readings: ["한"],
            glosses: ["Han China; Chinese", "the Han river"],
            compounds: [{ hangul: "한자", hanja: "漢字", gloss: "Chinese character" }] },
    "字": { eumhun: [{ hun: "글자", eum: "자" }], readings: ["자"],
            glosses: ["letter; character; graph"],
            compounds: [
              { hangul: "한자", hanja: "漢字", gloss: "Chinese character" },
              { hangul: "문자", hanja: "文字", gloss: "writing system; character" }
            ] },
    "文": { eumhun: [{ hun: "글월", eum: "문" }], readings: ["문"],
            glosses: ["writing; text; literature"],
            compounds: [{ hangul: "문자", hanja: "文字", gloss: "writing system" }] },
    "大": { eumhun: [{ hun: "큰", eum: "대" }], readings: ["대"],
            glosses: ["big; great"],
            compounds: [{ hangul: "대한", hanja: "大韓", gloss: "Great Han (Korea)" }] },
    // Hybrid card depth (SPEC ADDENDUM 2026-09-05): the characters of 加工,
    // the hanja part of 가공되다, so its nested word card carries chips and
    // two nested character cards with compounds. 工 alone also stands in for
    // 工夫 (no fixture word): the 공부하다 card nests the 工 card and nothing
    // for 夫, the characters-only fallback.
    "加": { eumhun: [{ hun: "더할", eum: "가" }], readings: ["가"],
            glosses: ["to add; to increase"],
            compounds: [
              { hangul: "가공", hanja: "加工", gloss: "processing" },
              { hangul: "추가", hanja: "追加", gloss: "addition" },
              { hangul: "증가", hanja: "增加", gloss: "increase" }
            ] },
    "工": { eumhun: [{ hun: "장인", eum: "공" }], readings: ["공"],
            glosses: ["craft; work; craftsman"],
            compounds: [
              { hangul: "공부", hanja: "工夫", gloss: "study" },
              { hangul: "가공", hanja: "加工", gloss: "processing" },
              { hangul: "공장", hanja: "工場", gloss: "factory" }
            ] },
    // eumhun deliberately missing → exercises the readings fallback path
    "法": { eumhun: [], readings: ["법"], glosses: ["law; rule; method"], compounds: [] },

    // --- homophones of 국 (ranked by compound count in the reading list) ---
    "局": C("판", "국", "bureau; office; situation", [
      { hangul: "결국", hanja: "結局", gloss: "in the end" },
      { hangul: "약국", hanja: "藥局", gloss: "pharmacy" },
      { hangul: "방송국", hanja: "放送局", gloss: "broadcasting station" }
    ]),
    "菊": C("국화", "국", "chrysanthemum", [
      { hangul: "국화", hanja: "菊花", gloss: "chrysanthemum" }
    ]),
    "鞠": C("공", "국", "leather ball; to rear"),
    "麴": C("누룩", "국", "yeast; malt"),

    // --- homophones of 사 (long list → exercises list scrolling) ---
    "事": C("일", "사", "affair; matter; work", [
      { hangul: "사건", hanja: "事件", gloss: "incident; case" },
      { hangul: "사업", hanja: "事業", gloss: "business; enterprise" },
      { hangul: "식사", hanja: "食事", gloss: "a meal" }
    ]),
    "社": C("모일", "사", "society; company; shrine", [
      { hangul: "회사", hanja: "會社", gloss: "company" },
      { hangul: "사회", hanja: "社會", gloss: "society" }
    ]),
    "士": C("선비", "사", "scholar; gentleman; soldier", [
      { hangul: "사기", hanja: "士氣", gloss: "morale" },
      { hangul: "박사", hanja: "博士", gloss: "doctorate" }
    ]),
    "使": C("하여금", "사", "to use; envoy", [
      { hangul: "사용", hanja: "使用", gloss: "use" }
    ]),
    "史": C("사기", "사", "history", [
      { hangul: "역사", hanja: "歷史", gloss: "history" }
    ]),
    "死": C("죽을", "사", "to die; death", [
      { hangul: "사망", hanja: "死亡", gloss: "death" }
    ]),
    "四": C("넉", "사", "four"),
    "師": C("스승", "사", "teacher; master"),
    "詐": C("속일", "사", "to deceive; fraud", [
      { hangul: "사기", hanja: "詐欺", gloss: "fraud" }
    ]),
    "沙": C("모래", "사", "sand"),
    "寺": C("절", "사", "Buddhist temple"),

    // --- remaining components of the 사기 homographs ---
    "欺": C("속일", "기", "to deceive; cheat", [
      { hangul: "사기", hanja: "詐欺", gloss: "fraud" }
    ]),
    "氣": C("기운", "기", "energy; spirit; air", [
      { hangul: "기분", hanja: "氣分", gloss: "mood" },
      { hangul: "사기", hanja: "士氣", gloss: "morale" }
    ]),
    "器": C("그릇", "기", "vessel; instrument", [
      { hangul: "무기", hanja: "武器", gloss: "weapon" }
    ]),
    "武": C("호반", "무", "military; martial"),
    "資": C("재물", "자", "resources; capital", [
      { hangul: "자본", hanja: "資本", gloss: "capital" }
    ]),
    "本": C("근본", "본", "root; origin; book", [
      { hangul: "자본", hanja: "資本", gloss: "capital" },
      { hangul: "본질", hanja: "本質", gloss: "essence" }
    ]),
    "主": C("주인", "주", "master; main; lord", [
      { hangul: "주의", hanja: "主義", gloss: "-ism" },
      { hangul: "주인", hanja: "主人", gloss: "owner" }
    ]),
    "義": C("옳을", "의", "righteousness; meaning", [
      { hangul: "주의", hanja: "主義", gloss: "-ism" }
    ]),
    "衝": C("찌를", "충", "to rush; collide"),
    "會": C("모일", "회", "to meet; assembly", [
      { hangul: "사회", hanja: "社會", gloss: "society" }
    ]),
    "者": C("놈", "자", "person; one who"),
    "海": C("바다", "해", "sea; ocean", [
      { hangul: "해외", hanja: "海外", gloss: "overseas" }
    ]),
    "外": C("바깥", "외", "outside; external", [
      { hangul: "외국", hanja: "外國", gloss: "foreign country" }
    ]),
    "活": C("살", "활", "to live; lively", [
      { hangul: "생활", hanja: "生活", gloss: "life; living" }
    ]),
    "舍": C("집", "사", "house; lodging"),
    "廊": C("행랑", "랑", "corridor; veranda"),
    "天": C("하늘", "천", "sky; heaven", [
      { hangul: "천지", hanja: "天地", gloss: "heaven and earth" }
    ]),

    // --- decomposition ADDENDUM: 靴 and the characters its parts open -----
    // 靴 carries the real BabelStone rows, and is here because it covers all
    // four part-row shapes in one card. The three eums (화 혁 인) are new, so
    // no reading list the checks pin by count moves.
    "靴": C("신", "화", "shoe; boot", [
      { hangul: "군화", hanja: "軍靴", gloss: "military boots" }
    ]),
    "革": C("가죽", "혁", "leather; hide"),
    "人": C("사람", "인", "person; human being"),

    // Single-page compounds rule (SPEC): 又's curated inline list is empty
    // while its cw index holds three rare words, so its card must render the
    // whole index up front with no control. The eum 우 is new: nothing pinned
    // by count moves.
    "又": C("또", "우", "again; and, also"),

    // --- the romanized-search example, so "su" has two honest readings ----
    // RR reads "su" as 수 and the Dubeolsik keyboard mapping reads it 녀.
    // Both syllables need real entries here, or the canned dual response
    // below would be describing characters the fixture does not have.
    //
    // 수 carries SEVEN so the group-preview cap has something to cap: the real
    // 수 has 102 readings, which is what buried the 녀 group and prompted the
    // rule. Seven is enough to show five and offer the rest, and it keeps the
    // preview count and the drilled-into view honest with each other — both
    // come from this one list.
    // 水 carries one compound so the real worker ranks 수 above 녀 for "su"
    // (a syllable-only pair orders by its best compound count, as 水 does in
    // the real data); the fake used to pin that order by hand.
    "水": C("물", "수", "water", [{ hangul: "수도", hanja: "水道", gloss: "waterworks" }]),
    "手": C("손", "수", "hand"),
    "數": C("셈", "수", "number; to count"),
    "首": C("머리", "수", "head; chief"),
    "樹": C("나무", "수", "tree"),
    "修": C("닦을", "수", "to cultivate; repair"),
    "秀": C("빼어날", "수", "outstanding; excellent"),
    "女": C("계집", "녀", "woman; female"),

    // Reading-only character: hun is "" AND glosses is [] (Agent A reports
    // these exist in the real data). Must render as just the eum, no blanks.
    "朞": { eumhun: [{ hun: "", eum: "기" }], readings: ["기"], glosses: [], compounds: [] }
  };

  // Character level taxonomy (`lvl`, one of m/h/a/r) — replaces the old
  // edu/eduT pair. In the real corpus EVERY char has exactly one; the fixture
  // deliberately leaves ONE char (朞) without, to stand in for pre-migration
  // data and prove the UI renders no chip rather than guessing a zone.
  //
  // The 국 homophone list is arranged to cover all four zones in one view
  // (國 m, 局 h, 菊 a, 鞠/麴 r), and 廊 is `r` so the rare WORD 舍廊 puts the
  // word-level RARE marker and a char-level "Rare" chip in the same popup.
  var LVL = {
    "國": "m", "民": "m", "學": "m", "生": "m", "韓": "m", "漢": "m",
    "字": "m", "文": "m", "大": "m", "事": "m", "社": "m", "士": "m",
    "使": "m", "史": "m", "死": "m", "四": "m", "師": "m", "氣": "m",
    "器": "m", "武": "m", "本": "m", "主": "m", "天": "m", "外": "m",
    "活": "m", "會": "m", "者": "m", "海": "m", "水": "m", "手": "m",
    "女": "m", "數": "m", "首": "m", "樹": "h", "修": "h", "秀": "h",
    "法": "h", "局": "h", "詐": "h", "資": "h", "義": "h", "寺": "h",
    "沙": "h", "舍": "h", "加": "m", "工": "m",
    "菊": "a", "欺": "a", "衝": "a", "人": "a",
    "鞠": "r", "麴": "r", "廊": "r", "革": "r", "靴": "r"
    // 朞: intentionally absent — see above.
  };
  Object.keys(LVL).forEach(function (c) {
    if (CHARS[c]) CHARS[c].lvl = LVL[c];
  });

  var WORDS = {
    // Deliberately listed BEFORE 詐欺 so the non-rare-first ordering has to
    // actually reorder it (Agent B does this in the service worker).
    "沙器": [{ hangul: "사기", glosses: ["porcelain; chinaware"], rare: true }],
    // Highlighting the native word 사랑 ("love") turns up only this obscure
    // spelling — the canonical hedging case.
    "舍廊": [{ hangul: "사랑", glosses: ["a detached building; men's quarters"], rare: true }],
    // --- rare and lessCommon (SPEC ADDENDUM 2026-09-01) -------------------
    // 가장 in all three states, listed rare, lessCommon, unflagged so the
    // worker's ordering has to reorder every one of them. 가장 is also a
    // native word (the adverb), and 家長 is unflagged, so the hanja leads.
    "假葬": [{ hangul: "가장", glosses: ["a temporary burial"], rare: true }],
    "假裝": [{ hangul: "가장", glosses: ["disguise; pretense"], lessCommon: true }],
    "家長": [{ hangul: "가장", glosses: ["the head of a family"] }],
    // 간장 usually means soy sauce (native); 肝臟 is a real word that merely
    // loses that contest (lessCommon), 肝腸 an unattested one (rare). No
    // unflagged spelling, so the native word leads and the toggle-off
    // hedge takes the lessCommon copy.
    "肝腸": [{ hangul: "간장", glosses: ["liver and intestines"], rare: true }],
    "肝臟": [{ hangul: "간장", glosses: ["the liver"], lessCommon: true }],
    // The native word 무리 also has this COMMON spelling, so the hanja card
    // keeps the lead and the native entry rides in its Same sound section.
    "無理": [{ hangul: "무리", glosses: ["unreasonableness; overexertion"] }],
    // The loan word 사인 (signature) shares this hangul, so the hanja card
    // leads and the loan entry rides in its Same sound section marked LOAN.
    "死因": [{ hangul: "사인", glosses: ["cause of death"] }],
    // Whole-word precedence (SPEC ADDENDUM 2026-09-05): the prefix of the
    // hybrid 가공되다. Rule 3b would split the hybrid into this word plus the
    // native 되다; the native whole-string check must claim the run first.
    "加工": [{ hangul: "가공", glosses: ["processing; manufacturing"] }],
    // Hybrid card depth (SPEC ADDENDUM 2026-09-05): a larger word holding
    // 加工, so the nested 加工 card under 가공되다 carries a Used-in row.
    "再加工": [{ hangul: "재가공", glosses: ["reprocessing"] }],
    // Deconjugation (SPEC ADDENDUM 2026-09-05): a hangul that is also a
    // form (남자 would be 남 + 자 of the fixture verb 남다). A run this word
    // explains whole is this word and never deconjugates. 男 and 子 are
    // deliberately not fixture chars: the word card alone is the pin.
    "男子": [{ hangul: "남자", glosses: ["man; male"] }],
    "國民": [{ hangul: "국민", glosses: ["the people; citizens of a nation"] }],
    "學生": [{ hangul: "학생", glosses: ["student; pupil"] }],
    "韓國": [{ hangul: "한국", glosses: ["Korea; South Korea"] }],
    "漢字": [{ hangul: "한자", glosses: ["hanja; Chinese character"] }],
    "文字": [{ hangul: "문자", glosses: ["character; letter", "text message"] }],
    "大韓民國": [{ hangul: "대한민국", glosses: ["the Republic of Korea"] }],
    "詐欺": [{ hangul: "사기", glosses: ["fraud; swindle; confidence trick"] }],
    "士氣": [{ hangul: "사기", glosses: ["morale; fighting spirit"] }],
    // Reference-only word: ~9,600 of the real 27,759 words have no glosses.
    "武器": [{ hangul: "무기", glosses: [] }],
    // ≥3 chars → gets a `parts` field (see the protocol addendum).
    "資本": [{ hangul: "자본", glosses: ["capital; funds"] }],
    "主義": [{ hangul: "주의", glosses: ["-ism; doctrine; principle"] }],
    "資本主義": [{ hangul: "자본주의", glosses: ["capitalism"] }],
    "民主主義": [{ hangul: "민주주의", glosses: ["democracy"] }],
    "民主": [{ hangul: "민주", glosses: ["democracy; democratic"] }],
    "士氣衝天": [{ hangul: "사기충천", glosses: ["morale running high"] }],
    "社會": [{ hangul: "사회", glosses: ["society"] }],
    "社會民主主義": [{ hangul: "사회민주주의", glosses: ["social democracy"] }],
    // A nesting chain where each level is a greedy part of the one above, deep
    // enough to exercise breadcrumb truncation (4 views):
    // 해외대학생활 → 大學生活 → 大學生 → 大學
    "海外": [{ hangul: "해외", glosses: ["overseas; abroad"] }],
    "大學": [{ hangul: "대학", glosses: ["university; college"] }],
    // Word-level sibling readings (SPEC ADDENDUM 2026-10-24): 明日 has an
    // everyday Japanese reading beside its Sino one, 場所 only an everyday one.
    "明日": [{ hangul: "명일", glosses: ["tomorrow"] }],
    "場所": [{ hangul: "장소", glosses: ["place; location"] }],
    "大學生": [{ hangul: "대학생", glosses: ["a university student"] }],
    "大學生活": [{ hangul: "대학생활", glosses: ["university life"] }],
    "海外大學生活": [{ hangul: "해외대학생활", glosses: ["university life abroad"] }],
    // --- the long tail of 學 compounds, so the `cw` index below can be joined
    //     against `words` exactly as the service worker does it -------------
    "學校": [{ hangul: "학교", glosses: ["school"] }],
    "科學": [{ hangul: "과학", glosses: ["science"] }],
    "數學": [{ hangul: "수학", glosses: ["mathematics"] }],
    "文學": [{ hangul: "문학", glosses: ["literature"] }],
    "哲學": [{ hangul: "철학", glosses: ["philosophy"] }],
    "醫學": [{ hangul: "의학", glosses: ["medical science"] }],
    "化學": [{ hangul: "화학", glosses: ["chemistry"] }],
    "學者": [{ hangul: "학자", glosses: ["scholar"] }],
    "學問": [{ hangul: "학문", glosses: ["learning; scholarship"] }],
    "學院": [{ hangul: "학원", glosses: ["private academy"] }],
    "學術": [{ hangul: "학술", glosses: ["academic study"] }],
    "留學": [{ hangul: "유학", glosses: ["studying abroad"] }],
    "入學": [{ hangul: "입학", glosses: ["entering a school"] }],
    // The one rare entry in the index: revealed rows must render it muted.
    "晩學": [{ hangul: "만학", glosses: ["taking up study late in life"], rare: true }],
    // --- 又's index: all rare, so its curated inline list is empty --------
    "又玄": [{ hangul: "우현", glosses: ["mystery upon mystery"], rare: true }],
    "又況": [{ hangul: "우황", glosses: ["still more; much less"], rare: true }],
    "又日新": [{ hangul: "우일신", glosses: ["renewing day after day"], rare: true }],
    // --- larger words containing 學生, for the used-in disclosure ---------
    "水道": [{ hangul: "수도", glosses: ["waterworks"] }],
    "中學生": [{ hangul: "중학생", glosses: ["middle school student"] }],
    "女學生": [{ hangul: "여학생", glosses: ["female student"] }],
    "留學生": [{ hangul: "유학생", glosses: ["an exchange student"] }],
    "小學生": [{ hangul: "소학생", glosses: ["elementary school pupil"] }],
    "苦學生": [{ hangul: "고학생", glosses: ["a working student"], rare: true }]
  };

  // ADDENDUM `cw`: EVERY words.json spelling containing the char, ranked, as a
  // bare array. Superset of `compounds` (which is why revealing has to skip
  // spellings already on screen). 學 has 17 entries; 4 of the 5 inline rows
  // are in it (the fifth is hangul-only), so 13 remain.
  var CW = {
    "學": [
      "學生", "大學", "學校", "科學", "數學", "文學", "哲學", "醫學", "化學",
      "學者", "學問", "學院", "學術", "留學", "入學", "大學生", "晩學",
      "中學生", "女學生", "留學生", "小學生", "苦學生"
    ],
    // Single-page rule: three entries, all rare, none curated inline.
    "又": ["又玄", "又況", "又日新"],
    // 水's one compound: the real worker ranks a syllable-only "su" by the
    // best cw size, so 수 (水) leads 녀 (女) as it does in the real data.
    "水": ["水道"]
  };
  // The real worker reads each char's own cw, hanja.json's shape. 學's index
  // carries the five 學生 compounds a hand-pinned used-in list used to name,
  // since the worker derives used-in from the first char's cw.
  Object.keys(CW).forEach(function (c) { if (CHARS[c]) CHARS[c].cw = CW[c]; });

  // ADDENDUM decomposition: rows exactly as decomp.json emits them. [g] is a
  // self-target row, [g,t] an alias row, [g,null] an inert part and
  // [g,null,name] an inert part Unihan has a name for. 靴 covers all four row
  // kinds; 鞠 is here so 革 is a part of TWO characters and its Found-in list
  // has an order to prove. Every other fixture char is the ordinary "no Made
  // of row" case.
  var DECOMP = {
    "靴": [["革"], ["亻", "人"], ["乚", null, "hidden"], ["㇒", null]],
    "鞠": [["革"], ["匊", null, "handful"]]
  };

  // ADDENDUM phonetic components: the char's pinned row INDEX into DECOMP,
  // emitted only for pinned chars, exactly as decomp.json carries it. The
  // pin is mechanical, not etymological (the contract wants a CLICKABLE
  // pinned row, and 鞠's true phonetic 匊 is inert in this fixture), so 鞠
  // pins its 革 row and 靴 stays unpinned as the no-markup control.
  var PHON = { "鞠": 0 };

  // byHangul: hangul spelling → every hanja spelling, no cap.
  var BY_HANGUL = {};
  Object.keys(WORDS).forEach(function (hanja) {
    WORDS[hanja].forEach(function (sense) {
      (BY_HANGUL[sense.hangul] = BY_HANGUL[sense.hangul] || []).push(hanja);
    });
  });

  // --- Native Korean words (SPEC ADDENDUM 2026-08-31) --------------------
  // native.json in miniature: keyed by hangul, one entry per POS. Consulted
  // ONLY when a lookup carries native:true; the read counter lets checks
  // prove the unflagged path never touches it, and __swapNativeTable stands
  // in for the file being absent. 하늘 is native-only, 사랑 rides beside the
  // rare 舍廊, 무리 beside the common 無理, 간장 beside the lessCommon 肝臟,
  // 가장 beside the common 家長, and 처음 carries two POS entries.
  // Place names and origin markers (SPEC ADDENDUM 2026-09-05): every entry
  // above declares origin "native", the pre-feature fixture; 서울 and 런던
  // are places (pos "name"), 밥상 a hybrid (밥 + 床), 사인 a loan beside the
  // common 死因, and 담배 declares no origin at all (unknown: no marker).
  var NATIVE = {
    "하늘": [{ pos: "noun", glosses: ["sky", "heaven"], origin: "native" }],
    "사랑": [{ pos: "noun", glosses: ["love; affection"], origin: "native" }],
    "무리": [{ pos: "noun", glosses: ["group; crowd; flock"], origin: "native" }],
    "간장": [{ pos: "noun", glosses: ["soy sauce"], origin: "native" }],
    "가장": [{ pos: "adverb", glosses: ["most; extremely"], origin: "native" }],
    "처음": [
      { pos: "noun", glosses: ["beginning; first time"], origin: "native" },
      { pos: "adverb", glosses: ["for the first time"], origin: "native" }
    ],
    "서울": [{ pos: "name", glosses: ["Seoul"], origin: "native" }],
    "런던": [{ pos: "name", glosses: ["London"], origin: "loan" }],
    "밥상": [{ pos: "noun", glosses: ["dining table"], origin: "hybrid" }],
    "사인": [{ pos: "noun", glosses: ["signature; autograph"], origin: "loan" }],
    "담배": [{ pos: "noun", glosses: ["tobacco"] }],
    // Hybrid parts (SPEC ADDENDUM 2026-09-05): 가공되다 carries its segments
    // (加工 is a fixture word, 되다 a fixture native entry, so both chips
    // navigate); 공부하다 carries segments the tables lack (工夫 is no
    // fixture word, 하다 no fixture entry: the hanja chip still issues its
    // lookup, the hangul part renders its bare inert row). 밥상 above stays
    // a hybrid WITHOUT parts: the marker alone. Hybrid card depth (SPEC
    // ADDENDUM 2026-09-05): 가공되다 nests the full 加工 word card and the
    // 되다 native card; 공부하다 nests the 工 character card for 工夫 (the
    // fixture has 工 and not 夫) and the bare 하다 row.
    "가공되다": [{
      pos: "verb", glosses: ["to be processed"], origin: "hybrid",
      parts: [{ hanja: "加工", hangul: "가공" }, { hangul: "되다" }]
    }],
    "공부하다": [{
      pos: "verb", glosses: ["to study"], origin: "hybrid",
      parts: [{ hanja: "工夫", hangul: "공부" }, { hangul: "하다" }]
    }],
    "되다": [{ pos: "verb", glosses: ["to become"], origin: "native" }],
    // Hybrid card depth (SPEC ADDENDUM 2026-09-05): a hybrid whose native
    // part is itself the hybrid 가공되다, parts and all, pinning the depth
    // bound: the nested 가공되다 card nests nothing and, its parts omitted
    // on the wire, draws no mixed spelling. Its hanja part 再 has no fixture
    // data at all (no word, no character), so it keeps the bare navigating
    // row. The segments are the fixture's own choice, made to pin those two
    // branches.
    "재가공되다": [{
      pos: "verb", glosses: ["to be reprocessed"], origin: "hybrid",
      parts: [{ hanja: "再", hangul: "재" }, { hangul: "가공되다" }]
    }],
    // Deconjugation (SPEC ADDENDUM 2026-09-05): the lemmas the checks reach
    // through a form (먹었어 is 먹 + 었 + 어, 좋은 is 좋 + 은). 사는 resolves to
    // both 살다 (ㄹ-drop before 는) and 사다 (bare stem), and the `f` buckets
    // are distinct on purpose so the ordering is the fixture's decision:
    // 살다 (2) before 사다 (3). 남다 exists so the 男子 block, not a missing
    // lemma, is what keeps 남자 off the lemma path.
    "먹다": [{ pos: "verb", glosses: ["to eat"], origin: "native", f: 3 }],
    "좋다": [{ pos: "adj", glosses: ["to be good"], origin: "native", f: 1 }],
    "살다": [{ pos: "verb", glosses: ["to live"], origin: "native", f: 2 }],
    "사다": [{ pos: "verb", glosses: ["to buy"], origin: "native", f: 3 }],
    "남다": [{ pos: "verb", glosses: ["to remain"], origin: "native", f: 4 }]
  };
  var nativeReads = 0;

  // --- Sibling Sino readings (SPEC ADDENDUM 2026-08-31) ------------------
  // sino.json in miniature: per char, per language, [reading, eum] pairs in
  // baked display order, capped at two. Consulted ONLY when a lookup carries
  // sino:true; the read counter lets checks prove the unflagged path never
  // touches it, and __swapSinoTable stands in for the file being absent.
  // 學 carries both languages (the SPEC's own anchor pairing), 生 is
  // polyphonic in ja with an eum-less TRAILING pair (no tooltip there),
  // 民 is ja-only and 國 zh-only, so one 국민 lookup nests two half-width
  // lines, one per language. 工 (hybrid card depth ADDENDUM) is reached
  // only inside a hybrid part's sub-lookup, which pins that the attach
  // walks in.
  var SINO = {
    "學": { ja: [["ガク", "학"]], zh: [["xué", "학"]] },
    "生": { ja: [["セイ", "생"], ["ショウ", ""]], zh: [["shēng", "생"]] },
    "民": { ja: [["ミン", "민"]] },
    "國": { zh: [["guó", "국"]] },
    "工": { zh: [["gōng", "공"]] }
  };
  // Word-level sibling readings (SPEC ADDENDUM 2026-10-24): sino.json's words
  // table in miniature, keyed by canonical spelling. 大學 carries both
  // languages; 明日 the everyday Japanese reading with a Sino one (あした
  // (みょうにち)); 場所 only an everyday one; 詐欺 and 士氣 share the hangul
  // 사기, so a spelling swap swaps the line, and 沙器 has none; 加工 is
  // reached inside a hybrid part's sub-lookup. 國民 and 學生 stay absent on
  // purpose: the character-line checks count lines on those lookups.
  var SINO_WORDS = {
    "大學": { ja: "だいがく", zh: "dàxué" },
    "明日": { ja: "みょうにち", jn: "あした", zh: "míngrì" },
    "場所": { jn: "ばしょ", zh: "chǎngsuǒ" },
    "詐欺": { ja: "さぎ", zh: "zhàqī" },
    "士氣": { ja: "しき", zh: "shìqì" },
    "加工": { ja: "かこう", zh: "jiāgōng" }
  };
  var sinoReads = 0;

  // --- Korean definitions (SPEC ADDENDUM 2026-09-01) ---------------------
  // ko.json in miniature: {d: senses, s: target_code} per key, three tables.
  // Consulted ONLY when a request carries ko:true; the read counter lets
  // checks prove English-mode traffic never touches it, and __swapKoTable
  // stands in for the file being absent. 學生 carries two senses under the
  // SPEC's own anchor code; 大學, 學校 and 大學生 one each (compound and
  // used-in rows); 資本 one (a component-word row); 國民 has NONE (the
  // ko-less word card). Chars: 學 and 國 carry a gloss, 革 one for the Made
  // of row; 生 and 民 have only their hun, 法 neither hun nor gloss.
  // Natives: 하늘 has an entry, 무리 none; 서울 has its 지명 sense on the
  // "hangul|name" key (place names ADDENDUM). Hybrid part rows (2026-09-05):
  // 加工 (words) and 되다|verb (natives) are the two parts of 가공되다, so
  // both of its rows show a Korean definition under 한국어.
  var KO = {
    words: {
      "學生": { d: ["학예를 배우는 사람.", "학교에 다니면서 공부하는 사람."], s: 27143 },
      "大學": { d: ["고등 교육을 베푸는 교육 기관."], s: 20001 },
      "學校": { d: ["일정한 목적 아래 교사가 학생을 가르치는 기관."], s: 20002 },
      "大學生": { d: ["대학에 다니는 학생."], s: 20003 },
      "資本": { d: ["장사나 사업 따위의 기본이 되는 돈."], s: 20004 },
      "加工": { d: ["원자재나 반제품을 인공적으로 처리하여 새로운 제품을 만듦."], s: 20005 }
    },
    natives: {
      "하늘|noun": { d: ["지평선 위로 보이는 무한한 공간."], s: 30001 },
      "서울|name": { d: ["한반도의 중심부에 있는 도시. 대한민국의 수도이다."], s: 30002 },
      "되다|verb": { d: ["새로운 신분이나 지위를 가지다."], s: 30003 }
    },
    chars: {
      "學": { d: ["어떤 원리에 따라 조직된 지식의 체계.", "‘학문’의 뜻을 더하는 접미사."], s: 67890 },
      "國": { d: ["일정한 영토와 주권을 가진 집단."], s: 40001 },
      "革": { d: ["짐승의 가죽."], s: 40002 },
      // Hybrid card depth ADDENDUM: reached only inside 가공되다's 加工
      // sub-lookup, so the nested 加 card shows a definition; 工 has its
      // hun alone.
      "加": { d: ["더하여 보태다."], s: 40003 }
    }
  };
  var koReads = 0;

  /* ------------------------------------------------------------------ *
   * The real worker over these tables (test harness ADDENDUM 2026-10-24).
   *
   * Until 2026-10-24 this file re-implemented the worker's lookup and attach
   * rules by hand: whole-word precedence, the deconjugation gate, the
   * romanized coverage collapse, hybrid parts, the sino and ko attach, the
   * compounds, used-in and found-in joins. Every feature needed a second
   * copy. It now loads extension/lookup.js and extension/background.js and
   * answers through background.js's answerLookup and the real builders over
   * the tables above, so the harness exercises the shipped code. The tables
   * go into the file shapes on every request, so a check that swaps one out
   * (__swapSinoTable) takes effect at once. ES modules need http: serve the
   * repo (python -m http.server) rather than opening the page from disk.
   * ------------------------------------------------------------------ */
  var real = null;
  var ready = Promise.all([
    import("../extension/lookup.js"),
    import("../extension/background.js"),
    import("../extension/saved.js")
  ]).then(function (mods) { real = { L: mods[0], B: mods[1], S: mods[2] }; });

  function needReal() {
    if (!real) {
      throw new Error("fixture: the real lookup modules have not loaded yet " +
        "(await __hanjaHoverTestRuntime.ready)");
    }
    return real;
  }

  function dataBundle(native) {
    var r = needReal();
    var b = {
      hanja: { version: 1, chars: CHARS },
      words: { version: 1, words: WORDS, byHangul: BY_HANGUL },
      variants: { version: 1, map: VARIANTS },
      decomp: r.B.guardDecomp({ v: 1, parts: DECOMP, phon: PHON })
    };
    var readingIndex = null;
    b.getReadingIndex = function () {
      if (!readingIndex) readingIndex = r.L.buildReadingIndex(b.hanja);
      return readingIndex;
    };
    if (native) b.native = r.B.guardNative({ version: 1, words: NATIVE });
    return b;
  }

  function koTable() {
    return needReal().B.guardKo({ version: 1, words: KO.words, natives: KO.natives, chars: KO.chars });
  }

  // One lookup response, exactly as the worker builds it.
  function answerLookup(text, o) {
    var r = needReal();
    var b = dataBundle(o.native === true);
    return r.B.answerLookup(String(text === null || text === undefined ? "" : text),
      { interpret: o.interpret === true, native: o.native === true }, b, {
        sino: o.sino === true ? r.B.guardSino({ version: 1, chars: SINO, words: SINO_WORDS }) : null,
        ko: o.ko === true ? koTable() : null,
        getFoundInIndex: function () { return r.B.buildFoundInIndex(b.decomp.parts); }
      });
  }

  function fullCompounds(char) {
    return needReal().L.buildFullCompounds(String(char || ""), dataBundle(false));
  }
  function buildUsedIn(word) {
    return needReal().L.buildUsedIn(String(word || ""), dataBundle(false));
  }
  function buildFoundIn(char) {
    var r = needReal(), b = dataBundle(false);
    var n = String(char || "").normalize("NFC");
    var canon = Object.prototype.hasOwnProperty.call(VARIANTS, n) ? VARIANTS[n] : n;
    return r.B.buildFoundIn(canon, r.B.buildFoundInIndex(b.decomp.parts), b.hanja);
  }
  function attachKoRows(rows, kind) {
    return needReal().B.attachKoRows(rows, koTable(), kind);
  }

  /* ------------------------------------------------------------------ *
   * Saved words + settings: the worker's other half, in memory.
   *
   * Identity-only items (kind, key) joined against the fixture tables above at
   * read time, exactly like the real worker — so savedGet rows and the export
   * bodies are real content, not placeholders. Folder f0 always exists and
   * cannot be deleted; deleting any other folder rehomes its items to f0.
   * Reachable from the checks as __hanjaHoverTestRuntime.__savedStore.
   * ------------------------------------------------------------------ */

  // Fixed stamps, so an export body and its filename are byte-stable
  // across runs (the worker stamps Date.now() and dates the file today).
  var SAVED_ADDED_AT = Date.UTC(2026, 7, 17);
  var SAVED_EXPORT_DATE = new Date(2026, 7, 17);

  var SAVED_TYPES = {
    savedGet: 1, savedToggle: 1, savedCheck: 1, savedRemove: 1, savedMove: 1,
    folderCreate: 1, folderRename: 1, folderDelete: 1,
    settingsGet: 1, settingsSet: 1, savedExport: 1,
    // Popup off per site and recent lookups ADDENDUM (2026-10-26): storage
    // traffic too, never counted as lookups.
    siteSet: 1, recentAdd: 1, recentGet: 1, recentClear: 1
  };

  // Test harness ADDENDUM (2026-10-25): every answer below goes through
  // extension/saved.js, the module the worker's handlers are glue around:
  // normalize on read, the state change, the join, the export body. What
  // stays here is that glue, with two in-memory records standing in for
  // chrome.storage.local. Until 2026-10-25 this block re-implemented the
  // store, the join and both exporters by hand.
  var savedRecord, settingsRecord, recentRecord, savedCheckCalls, savedLastCheckKeys, savedFail;
  var siteSetCalls, recentAddCalls;
  var savedLastGetKo = null;   // whether the last savedGet carried ko:true

  function resetSaved() {
    savedRecord = {
      v: 1, folders: [{ id: "f0", name: "Saved" }], items: [],
      nextFolder: 1, nextItem: 0
    };
    // A v2 record with native words off: the starting state every check was
    // written against (the product default is on since settings v2).
    settingsRecord = {
      v: 2, defaultFolderId: "f0", nativeWords: false,
      anki: {
        wordFront: "hanja", wordBack: ["hangul", "defs"],
        charFront: "char", charBack: ["eumhun", "defs"]
      }
    };
    recentRecord = { v: 1, items: [] };
    savedCheckCalls = 0;
    savedLastCheckKeys = null;
    savedFail = { all: false, check: false, toggle: false };
    siteSetCalls = [];
    recentAddCalls = [];
  }
  resetSaved();
  // The entry stamps, fixed and increasing, so the order is the call order.
  var recentClock = SAVED_ADDED_AT;

  function savedLib() { return needReal().S; }

  // The worker's readSaved and readSettings: normalized on every read.
  function readSaved() { return savedLib().normalizeSavedState(savedRecord); }
  function readSettings(state) { return savedLib().normalizeSettings(settingsRecord, state); }

  // What the worker hands joinItems: its tables, plus sino.json and ko.json
  // only when the caller opened their gates. The Korean read is counted,
  // like every other ko.json read.
  function savedJoinData(withSino, withKo) {
    var r = needReal();
    var data = dataBundle(false);
    if (withSino) data.sino = r.B.guardSino({ version: 1, chars: SINO, words: SINO_WORDS });
    if (withKo) { koReads++; data.ko = koTable(); }
    return data;
  }

  function savedMessage(msg) {
    var S = savedLib();
    if (msg.type === "savedCheck") {
      savedCheckCalls++;
      savedLastCheckKeys = (Array.isArray(msg.keys) ? msg.keys : []).map(function (k) {
        return S.savedMapKey(k && k.kind, k && k.key);
      });
    }
    // A worker without chrome.storage answers {ok:false} to every one of these,
    // and every surface must read that as "feature absent". The flags drive
    // that path without tearing the store down.
    if (savedFail.all ||
        (savedFail.check && msg.type === "savedCheck") ||
        (savedFail.toggle && msg.type === "savedToggle")) {
      return { ok: false, error: "storage unavailable" };
    }

    var state = readSaved();

    if (msg.type === "savedGet") {
      // The same client-set flag as lookups: a flagged request's rows carry
      // their Korean entry (handleSavedGet's join).
      savedLastGetKo = msg.ko === true;
      return { ok: true, folders: state.folders,
               items: S.joinItems(state.items, savedJoinData(false, msg.ko === true)) };
    }

    if (msg.type === "savedToggle") {
      var toggled = S.toggleItem(state, msg.kind, msg.key,
        readSettings(state).defaultFolderId, SAVED_ADDED_AT);
      savedRecord = toggled.state;
      var response = { ok: true, saved: toggled.saved, folders: toggled.state.folders };
      if (toggled.item) {
        response.item = toggled.item;
        response.folderId = toggled.item.folderId;
      }
      return response;
    }

    if (msg.type === "savedCheck") return { ok: true, saved: S.checkKeys(state, msg.keys) };

    if (msg.type === "savedRemove") {
      var removed = S.removeItems(state, msg.ids);
      savedRecord = removed.state;
      return { ok: true, removed: removed.removed };
    }

    if (msg.type === "savedMove") {
      var moved = S.moveItems(state, msg.ids, msg.folderId);
      if (moved.error !== null) return { ok: false, error: moved.error };
      savedRecord = moved.state;
      return { ok: true, moved: moved.moved };
    }

    if (msg.type === "folderCreate" || msg.type === "folderRename") {
      var changed = msg.type === "folderCreate"
        ? S.createFolder(state, msg.name)
        : S.renameFolder(state, msg.id, msg.name);
      if (changed.error !== null) return { ok: false, error: changed.error };
      savedRecord = changed.state;
      return { ok: true, folder: changed.folder };
    }

    if (msg.type === "folderDelete") {
      var deleted = S.deleteFolder(state, msg.id);
      if (deleted.error !== null) return { ok: false, error: deleted.error };
      savedRecord = deleted.state;
      // Deleting the "save new items to" folder resets the setting in the
      // same step, so no surface can observe a dangling default.
      var previous = readSettings(state);
      var after = S.normalizeSettings(previous, deleted.state);
      if (after.defaultFolderId !== previous.defaultFolderId) settingsRecord = after;
      return { ok: true, moved: deleted.moved, settings: after };
    }

    if (msg.type === "settingsGet") return { ok: true, settings: readSettings(state) };

    if (msg.type === "settingsSet") {
      var before = readSettings(state);
      var merged = needReal().B.mergeSettings(before, msg.patch);
      settingsRecord = S.normalizeSettings(merged, state);
      // The worker's rule: turning recent lookups off clears the list.
      if (settingsRecord.recentLookups === false && before.recentLookups !== false) {
        recentRecord = S.normalizeRecent(null);
      }
      return { ok: true, settings: settingsRecord };
    }

    if (msg.type === "siteSet") {
      siteSetCalls.push({ site: msg.site, off: msg.off === true });
      var site = S.withSite(readSettings(state), msg.site, msg.off === true);
      if (site.settings === null) return { ok: false, error: "not a site" };
      settingsRecord = S.normalizeSettings(site.settings, state);
      return { ok: true, settings: settingsRecord, site: site.site };
    }

    if (msg.type === "recentAdd") {
      recentAddCalls.push(msg.entry);
      if (readSettings(state).recentLookups === false) return { ok: true, added: false };
      if (S.normalizeRecentEntry(msg.entry) === null) return { ok: true, added: false };
      recentClock += 1000;
      recentRecord = S.addRecent(recentRecord, msg.entry, recentClock);
      return { ok: true, added: true };
    }

    if (msg.type === "recentGet") {
      if (readSettings(state).recentLookups === false) return { ok: true, items: [] };
      return { ok: true, items: S.normalizeRecent(recentRecord).items };
    }

    if (msg.type === "recentClear") {
      recentRecord = S.normalizeRecent(null);
      return { ok: true };
    }

    if (msg.type === "savedExport") {
      var B = needReal().B;
      var current = readSettings(state);
      var csv = msg.format === "csv";
      // The worker's two fetch gates: sino.json only for a ja/zh charBack
      // field, ko.json only under 한국어 with a definitions field in play.
      var rows = S.joinItems(
        S.resolveExportSelection(state, { ids: msg.ids, folderIds: msg.folderIds, all: msg.all }),
        savedJoinData(B.exportWantsSino(current), B.exportWantsKo(current, csv ? "csv" : "anki")));
      var skipped = rows.filter(function (r) { return r.missing === true; }).length;
      return {
        ok: true,
        tsv: csv ? S.buildCsv(rows, state.folders) : S.buildAnkiTsv(rows, current, state.folders),
        count: rows.length - skipped,
        skipped: skipped,
        filename: B.exportFilename(csv ? "csv" : "anki", SAVED_EXPORT_DATE)
      };
    }

    return { ok: false, error: "unknown message type" };
  }

  var savedStore = {
    reset: function () { resetSaved(); },
    state: function () {
      var st = readSaved();
      return { folders: st.folders, items: st.items, settings: readSettings(st) };
    },
    // savedCheck is batched one-per-render-pass, so its call count is a
    // meaningful assertion and not just bookkeeping.
    checkCalls: function () { return savedCheckCalls; },
    lastCheckKeys: function () {
      return savedLastCheckKeys ? savedLastCheckKeys.slice() : null;
    },
    lastGetKo: function () { return savedLastGetKo; },
    fail: function (which, on) { savedFail[which] = on !== false; },
    // Popup off per site and recent lookups ADDENDUM: what the surfaces sent,
    // and the recent record as the worker would hold it.
    siteSetCalls: function () { return siteSetCalls.slice(); },
    recentAddCalls: function () { return recentAddCalls.slice(); },
    recent: function () { return S_recentItems(); },
    setRecent: function (items) { recentRecord = { v: 1, items: items || [] }; }
  };
  function S_recentItems() { return savedLib().normalizeRecent(recentRecord).items; }

  /* ---- Korean language mode ADDENDUM: the message tables ------------------ *
   * The worker's messagesGet, answered from the packaged files themselves so
   * the ko sweep runs against the real table. fetch() of a relative file
   * works over http:// only; under file:// the answer is {ok:false}, the
   * loader keeps its built-in English, and the language checks skip.
   * -------------------------------------------------------------------- */
  var messagesCache = Object.create(null);
  function messagesTable(lang) {
    var chosen = lang === "ko" ? "ko" : "en";
    if (!messagesCache[chosen]) {
      messagesCache[chosen] = fetch("../extension/_locales/" + chosen + "/messages.json")
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        })
        .then(function (messages) {
          return { ok: true, lang: chosen, messages: messages };
        })
        .catch(function (e) {
          delete messagesCache[chosen];
          return { ok: false, error: String(e) };
        });
    }
    return messagesCache[chosen];
  }

  // English byte-identity anchors (Korean language mode ADDENDUM): the
  // outerHTML of three fixture views as the renderer produced them BEFORE
  // its copy went through the message table (학생 word card, 靴 char card,
  // 국 reading list; `.more` expanders stripped, since those depend on font
  // metrics). Captured by rendering the pre-port content.js against this
  // very fixture in headless Chrome. Equality with a fresh render proves the
  // English surface is byte-for-byte what it was.
  var SNAPSHOTS = {
    word: "<div class=\"card\"><div class=\"hedge\"><\/div><div class=\"word-body\"><div class=\"head\"><div class=\"surface\">學生<\/div><div class=\"headmeta\"><div class=\"hangul\"><span class=\"rnav\" title=\"Look up 학생\" aria-label=\"Look up 학생\" role=\"button\" tabindex=\"0\">학생<\/span><\/div><\/div><button class=\"save save--unknown\" type=\"button\" aria-pressed=\"false\" aria-label=\"Save 學生\" title=\"Save\">☆<\/button><a class=\"wiki\" href=\"https://en.wiktionary.org/wiki/%ED%95%99%EC%83%9D#Korean\" target=\"_blank\" rel=\"noopener noreferrer\" aria-label=\"Wiktionary entry for 학생 (opens in a new tab)\">Wiktionary ↗<\/a><\/div><div class=\"glosses\"><div class=\"gloss\"><div class=\"clampwrap\"><span class=\"gloss-text clamp clamp-2\">Student; pupil<\/span><\/div><\/div><\/div><div class=\"chips\"><span class=\"chip nav\" aria-label=\"學 배울 학\" role=\"button\" tabindex=\"0\"><span class=\"chip-glyph\">學<\/span><span class=\"chip-text\">배울 학<\/span><\/span><span class=\"chip nav\" aria-label=\"生 날 생\" role=\"button\" tabindex=\"0\"><span class=\"chip-glyph\">生<\/span><span class=\"chip-text\">날 생<\/span><\/span><\/div><div class=\"entry-row usedin-row nav\" role=\"button\" tabindex=\"0\"><span class=\"usedin-text\">Used in <b>6<\/b> larger words<\/span><\/div><\/div><div class=\"parts\"><\/div><div class=\"components\"><div class=\"label\">Component hanja<\/div><div class=\"component-list\"><div class=\"card component\"><div class=\"head\"><div class=\"surface\">學<\/div><div class=\"headmeta\"><div class=\"eumhun\"><span class=\"hun\">배울 <\/span><span class=\"rnav\" title=\"Characters read 학\" aria-label=\"Characters read 학\" role=\"button\" tabindex=\"0\">학<\/span><span class=\"edu-badge edu-badge--lvlM\" title=\"MOE curriculum, middle school (중학교용)\" aria-label=\"MOE curriculum, middle school (중학교용)\">Middle school<\/span><\/div><\/div><button class=\"save save--unknown\" type=\"button\" aria-pressed=\"false\" aria-label=\"Save 學\" title=\"Save\">☆<\/button><a class=\"wiki\" href=\"https://en.wiktionary.org/wiki/%E5%AD%B8#Korean\" target=\"_blank\" rel=\"noopener noreferrer\" aria-label=\"Wiktionary entry for 學 (opens in a new tab)\">Wiktionary ↗<\/a><\/div><div class=\"glosses numbered\"><div class=\"gloss\"><span class=\"gloss-num\">1.<\/span><div class=\"clampwrap\"><span class=\"gloss-text clamp clamp-2\">To learn; study<\/span><\/div><\/div><div class=\"gloss\"><span class=\"gloss-num\">2.<\/span><div class=\"clampwrap\"><span class=\"gloss-text clamp clamp-2\">School; learning<\/span><\/div><\/div><\/div><div class=\"label\">Compounds<\/div><div class=\"compounds\"><div class=\"entry-row compound-row nav\" role=\"button\" tabindex=\"0\"><div class=\"clampwrap\"><span class=\"compound clamp clamp-1\"><span class=\"cpd-hangul\">학생<\/span><span class=\"cpd-hanja\"> (學生)<\/span><span class=\"cpd-gloss\">: student<\/span><\/span><\/div><\/div><div class=\"entry-row compound-row nav\" role=\"button\" tabindex=\"0\"><div class=\"clampwrap\"><span class=\"compound clamp clamp-1\"><span class=\"cpd-hangul\">대학<\/span><span class=\"cpd-hanja\"> (大學)<\/span><span class=\"cpd-gloss\">: university<\/span><\/span><\/div><\/div><div class=\"entry-row compound-row nav\" role=\"button\" tabindex=\"0\"><div class=\"clampwrap\"><span class=\"compound clamp clamp-1\"><span class=\"cpd-hangul\">학교<\/span><span class=\"cpd-hanja\"> (學校)<\/span><span class=\"cpd-gloss\">: school<\/span><\/span><\/div><\/div><div class=\"entry-row compound-row nav\" role=\"button\" tabindex=\"0\"><div class=\"clampwrap\"><span class=\"compound clamp clamp-1\"><span class=\"cpd-hangul\">과학<\/span><span class=\"cpd-hanja\"> (科學)<\/span><span class=\"cpd-gloss\">: science<\/span><\/span><\/div><\/div><div class=\"entry-row compound-row\"><div class=\"clampwrap\"><span class=\"compound clamp clamp-1\"><span class=\"cpd-hangul\">학벌<\/span><span class=\"cpd-gloss\">: academic clique<\/span><\/span><\/div><\/div><\/div><button class=\"cpd-more\" type=\"button\">Show 5 more (18)<\/button><button class=\"cpd-more cpd-all\" type=\"button\">Show all (22)<\/button><\/div><div class=\"card component\"><div class=\"head\"><div class=\"surface\">生<\/div><div class=\"headmeta\"><div class=\"eumhun\"><span class=\"hun\">날 <\/span><span class=\"rnav\" title=\"Characters read 생\" aria-label=\"Characters read 생\" role=\"button\" tabindex=\"0\">생<\/span><span class=\"edu-badge edu-badge--lvlM\" title=\"MOE curriculum, middle school (중학교용)\" aria-label=\"MOE curriculum, middle school (중학교용)\">Middle school<\/span><\/div><\/div><button class=\"save save--unknown\" type=\"button\" aria-pressed=\"false\" aria-label=\"Save 生\" title=\"Save\">☆<\/button><a class=\"wiki\" href=\"https://en.wiktionary.org/wiki/%E7%94%9F#Korean\" target=\"_blank\" rel=\"noopener noreferrer\" aria-label=\"Wiktionary entry for 生 (opens in a new tab)\">Wiktionary ↗<\/a><\/div><div class=\"glosses numbered\"><div class=\"gloss\"><span class=\"gloss-num\">1.<\/span><div class=\"clampwrap\"><span class=\"gloss-text clamp clamp-2\">To be born; to live<\/span><\/div><\/div><div class=\"gloss\"><span class=\"gloss-num\">2.<\/span><div class=\"clampwrap\"><span class=\"gloss-text clamp clamp-2\">Raw; fresh<\/span><\/div><\/div><\/div><div class=\"label\">Compounds<\/div><div class=\"compounds\"><div class=\"entry-row compound-row nav\" role=\"button\" tabindex=\"0\"><div class=\"clampwrap\"><span class=\"compound clamp clamp-1\"><span class=\"cpd-hangul\">학생<\/span><span class=\"cpd-hanja\"> (學生)<\/span><span class=\"cpd-gloss\">: student<\/span><\/span><\/div><\/div><div class=\"entry-row compound-row nav\" role=\"button\" tabindex=\"0\"><div class=\"clampwrap\"><span class=\"compound clamp clamp-1\"><span class=\"cpd-hangul\">생일<\/span><span class=\"cpd-hanja\"> (生日)<\/span><span class=\"cpd-gloss\">: birthday<\/span><\/span><\/div><\/div><\/div><\/div><\/div><\/div><\/div>",
    char: "<div class=\"card\"><div class=\"head\"><div class=\"surface\">靴<\/div><div class=\"headmeta\"><div class=\"eumhun\"><span class=\"hun\">신 <\/span><span class=\"rnav\" title=\"Characters read 화\" aria-label=\"Characters read 화\" role=\"button\" tabindex=\"0\">화<\/span><span class=\"edu-badge edu-badge--lvlR\" title=\"Archaic, specialist, or reading-only (Okpyeon's classification)\" aria-label=\"Archaic, specialist, or reading-only (Okpyeon's classification)\">Rare<\/span><\/div><\/div><button class=\"save save--unknown\" type=\"button\" aria-pressed=\"false\" aria-label=\"Save 靴\" title=\"Save\">☆<\/button><a class=\"wiki\" href=\"https://en.wiktionary.org/wiki/%E9%9D%B4#Korean\" target=\"_blank\" rel=\"noopener noreferrer\" aria-label=\"Wiktionary entry for 靴 (opens in a new tab)\">Wiktionary ↗<\/a><\/div><div class=\"glosses\"><div class=\"gloss\"><div class=\"clampwrap\"><span class=\"gloss-text clamp clamp-2\">Shoe; boot<\/span><\/div><\/div><\/div><div class=\"madeof\"><div class=\"entry-row madeof-row nav\" aria-expanded=\"false\" role=\"button\" tabindex=\"0\"><div class=\"clampwrap\"><span class=\"madeof-text clamp clamp-1\">Made of <span class=\"madeof-glyph\">革<\/span> + <span class=\"madeof-glyph\">亻<\/span> + <span class=\"madeof-glyph\">乚<\/span> + <span class=\"madeof-glyph\">㇒<\/span><\/span><\/div><\/div><div class=\"madeof-list\" hidden=\"\"><div class=\"entry-row madeof-part nav\" role=\"button\" tabindex=\"0\"><span class=\"r-glyph\">革<\/span><div class=\"clampwrap\"><span class=\"r-text clamp clamp-1\"><span class=\"r-eumhun\">가죽 혁<\/span><span class=\"r-gloss\">  leather; hide<\/span><\/span><\/div><\/div><div class=\"entry-row madeof-part nav\" role=\"button\" tabindex=\"0\"><span class=\"r-glyph\">亻<\/span><div class=\"clampwrap\"><span class=\"r-text clamp clamp-1\"><span class=\"r-eumhun\">사람 인<\/span><span class=\"r-gloss\">  person; human being<\/span><\/span><\/div><\/div><div class=\"entry-row madeof-part inert\"><span class=\"r-glyph\">乚<\/span><div class=\"clampwrap\"><span class=\"r-text clamp clamp-1\"><span class=\"madeof-name\">hidden<\/span><\/span><\/div><\/div><div class=\"entry-row madeof-part inert\"><span class=\"r-glyph\">㇒<\/span><div class=\"clampwrap\"><span class=\"r-text clamp clamp-1\"><\/span><\/div><\/div><\/div><\/div><div class=\"label\">Compounds<\/div><div class=\"compounds\"><div class=\"entry-row compound-row nav\" role=\"button\" tabindex=\"0\"><div class=\"clampwrap\"><span class=\"compound clamp clamp-1\"><span class=\"cpd-hangul\">군화<\/span><span class=\"cpd-hanja\"> (軍靴)<\/span><span class=\"cpd-gloss\">: military boots<\/span><\/span><\/div><\/div><\/div><\/div>",
    reading: "<div class=\"card reading\"><div class=\"reading-title\">5 hanja read <b>국<\/b><\/div><div class=\"reading-list\"><div class=\"reading-row\" role=\"button\" tabindex=\"0\"><span class=\"r-glyph\">國<\/span><span class=\"r-text\"><span class=\"r-eumhun\">나라 국<\/span><span class=\"edu-badge edu-badge--lvlM\" title=\"MOE curriculum, middle school (중학교용)\" aria-label=\"MOE curriculum, middle school (중학교용)\">Middle school<\/span><span class=\"r-gloss\">  country; state; nation<\/span><\/span><\/div><div class=\"reading-row\" role=\"button\" tabindex=\"0\"><span class=\"r-glyph\">局<\/span><span class=\"r-text\"><span class=\"r-eumhun\">판 국<\/span><span class=\"edu-badge edu-badge--lvlH\" title=\"MOE curriculum, high school (고등학교용)\" aria-label=\"MOE curriculum, high school (고등학교용)\">High school<\/span><span class=\"r-gloss\">  bureau; office; situation<\/span><\/span><\/div><div class=\"reading-row\" role=\"button\" tabindex=\"0\"><span class=\"r-glyph\">菊<\/span><span class=\"r-text\"><span class=\"r-eumhun\">국화 국<\/span><span class=\"edu-badge edu-badge--lvlA\" title=\"Beyond the school curriculum; attested in real vocabulary (Okpyeon's classification)\" aria-label=\"Beyond the school curriculum; attested in real vocabulary (Okpyeon's classification)\">Advanced<\/span><span class=\"r-gloss\">  chrysanthemum<\/span><\/span><\/div><div class=\"reading-row\" role=\"button\" tabindex=\"0\"><span class=\"r-glyph\">鞠<\/span><span class=\"r-text\"><span class=\"r-eumhun\">공 국<\/span><span class=\"edu-badge edu-badge--lvlR\" title=\"Archaic, specialist, or reading-only (Okpyeon's classification)\" aria-label=\"Archaic, specialist, or reading-only (Okpyeon's classification)\">Rare<\/span><span class=\"r-gloss\">  leather ball; to rear<\/span><\/span><\/div><div class=\"reading-row\" role=\"button\" tabindex=\"0\"><span class=\"r-glyph\">麴<\/span><span class=\"r-text\"><span class=\"r-eumhun\">누룩 국<\/span><span class=\"edu-badge edu-badge--lvlR\" title=\"Archaic, specialist, or reading-only (Okpyeon's classification)\" aria-label=\"Archaic, specialist, or reading-only (Okpyeon's classification)\">Rare<\/span><span class=\"r-gloss\">  yeast; malt<\/span><\/span><\/div><\/div><\/div>"
  };

  globalThis.__hanjaHoverTestRuntime = {
    __isStub: true,
    __calls: 0,          // dictionary sendMessage — proves "back" doesn't re-query
    __lastText: null,
    // Romanized-search input-channel rule: interpretation is for free-typed
    // input only, so a check can watch the flag NOT arrive on the lookups
    // internal navigation sends.
    __lastInterpret: null,
    __interpretCalls: 0,
    // Native words ADDENDUM: how many lookups carried native:true, and
    // whether the LAST one did. The toggle-off checks watch both stay put.
    __nativeCalls: 0,
    __lastNative: null,
    // Sibling Sino readings ADDENDUM: the same pair for sino:true.
    __sinoCalls: 0,
    __lastSino: null,
    // Korean language mode ADDENDUM: the same pair for ko:true on lookups,
    // and the row fetches' own pair (compounds, usedIn, foundIn).
    __koCalls: 0,
    __lastKo: null,
    __koRowCalls: 0,
    __lastRowKo: null,
    __compoundCalls: 0,  // {type:"compounds"} only
    __lastChar: null,
    __failCompounds: false,  // flip on to exercise the retry path
    __usedInCalls: 0,    // {type:"usedIn"} only
    __lastWord: null,
    __failUsedIn: false,
    __foundInCalls: 0,   // {type:"foundIn"} only
    __lastFoundInChar: null,
    __failFoundIn: false,
    // {type:"openTab"} — the in-page popup's route to a background tab, since
    // a content script cannot reach chrome.tabs itself. The real worker
    // validates the url against the Wiktionary base; flip __failOpenTab to
    // stand in for an old worker or a rejected url and exercise the fallback.
    __openTabCalls: 0,
    __lastOpenTabUrl: null,
    __failOpenTab: false,
    // {type:"messagesGet"} (Korean language mode ADDENDUM), answered from
    // the packaged files; see messagesTable.
    __messagesCalls: 0,
    sendMessage: function (msg, cb) {
      // Before the real modules load, every request but the messages table
      // waits for them (the saved store answers through saved.js too).
      if (!real && msg && msg.type !== "messagesGet") {
        var self = this;
        var later = ready.then(function () { return self.sendMessage(msg); });
        if (typeof cb === "function") { later.then(function (r) { cb(r); }); return undefined; }
        return later;
      }
      // Dictionary traffic only. The saved store keeps its own counters, so
      // every "this view was served from cache" proof stays a statement about
      // LOOKUPS and does not quietly start counting savedCheck round-trips.
      if (!(msg && (SAVED_TYPES[msg.type] === 1 || msg.type === "messagesGet"))) {
        this.__calls++;
      }
      var resp;
      try {
        if (msg && msg.type === "lookup") {
          this.__lastText = msg.text;
          this.__lastInterpret = msg.interpret === true;
          if (msg.interpret === true) this.__interpretCalls++;
          this.__lastNative = msg.native === true;
          if (msg.native === true) { this.__nativeCalls++; nativeReads++; }
          this.__lastSino = msg.sino === true;
          if (msg.sino === true) { this.__sinoCalls++; sinoReads++; }
          this.__lastKo = msg.ko === true;
          if (msg.ko === true) { this.__koCalls++; koReads++; }
          // The worker's answer, flags and all (SPEC gate: only a flagged
          // request touches the native, sino or ko table).
          resp = answerLookup(String(msg.text || ""), {
            interpret: msg.interpret === true, native: msg.native === true,
            sino: msg.sino === true, ko: msg.ko === true
          });
        } else if (msg && msg.type === "compounds") {
          this.__compoundCalls++;
          this.__lastChar = msg.char;
          this.__lastRowKo = msg.ko === true;
          resp = this.__failCompounds
            ? { ok: false, error: "simulated failure" }
            : { ok: true, compounds: fullCompounds(msg.char) };
          if (msg.ko === true) {
            this.__koRowCalls++;
            koReads++;
            if (resp.ok) attachKoRows(resp.compounds, "word");
          }
        } else if (msg && msg.type === "usedIn") {
          this.__usedInCalls++;
          this.__lastWord = msg.word;
          this.__lastRowKo = msg.ko === true;
          resp = this.__failUsedIn
            ? { ok: false, error: "simulated failure" }
            : { ok: true, words: buildUsedIn(msg.word) };
          if (msg.ko === true) {
            this.__koRowCalls++;
            koReads++;
            if (resp.ok) attachKoRows(resp.words, "word");
          }
        } else if (msg && msg.type === "foundIn") {
          this.__foundInCalls++;
          this.__lastFoundInChar = msg.char;
          this.__lastRowKo = msg.ko === true;
          resp = this.__failFoundIn
            ? { ok: false, error: "simulated failure" }
            : { ok: true, chars: buildFoundIn(msg.char) };
          if (msg.ko === true) {
            this.__koRowCalls++;
            koReads++;
            if (resp.ok) attachKoRows(resp.chars, "char");
          }
        } else if (msg && msg.type === "openTab") {
          this.__openTabCalls++;
          this.__lastOpenTabUrl = msg.url;
          resp = this.__failOpenTab
            ? { ok: false, error: "url rejected" }
            : { ok: true };
        } else if (msg && msg.type === "messagesGet") {
          this.__messagesCalls++;
          resp = messagesTable(msg.lang);
        } else if (msg && SAVED_TYPES[msg.type] === 1) {
          resp = savedMessage(msg);
        } else {
          resp = { ok: false, error: "unknown message type" };
        }
      } catch (e) {
        resp = { ok: false, error: String(e) };
      }
      // Interpreted responses are promises; everything else is settled
      // already. Both call styles stay asynchronous either way.
      var settled = Promise.resolve(resp).catch(function (e) {
        return { ok: false, error: String(e) };
      });
      if (typeof cb === "function") { settled.then(function (r) { cb(r); }); return undefined; }
      return settled;
    },
    // A literal lookup through the real worker, unflagged unless asked;
    // synchronous once `ready` has settled.
    __lookup: function (text, opts) {
      var o = opts !== null && typeof opts === "object" ? opts : {};
      return answerLookup(text, o);
    },
    // Settles once the real lookup modules have loaded; the check runners
    // await it before their first lookup.
    ready: ready,
    // How often the native table has been consulted, and a stand-in for
    // native.json being absent: checks swap the table out to prove renders
    // are byte-identical, then put it back.
    __nativeReads: function () { return nativeReads; },
    __swapNativeTable: function (table) {
      var prev = NATIVE;
      NATIVE = table || {};
      return prev;
    },
    // The sino twins: read count and the absent-file stand-in.
    __sinoReads: function () { return sinoReads; },
    __swapSinoTable: function (table) {
      var prev = SINO;
      SINO = table || {};
      return prev;
    },
    __swapSinoWords: function (table) {
      var prev = SINO_WORDS;
      SINO_WORDS = table || {};
      return prev;
    },
    // The ko twins.
    __koReads: function () { return koReads; },
    __swapKoTable: function (table) {
      var prev = KO;
      KO = table || { words: {}, natives: {}, chars: {} };
      return prev;
    },
    __fullCompounds: fullCompounds,
    __usedIn: buildUsedIn,
    __foundIn: buildFoundIn,
    __savedStore: savedStore,
    // The message tables and the English byte-identity anchors.
    __messages: messagesTable,
    __snapshots: SNAPSHOTS
  };
})();
