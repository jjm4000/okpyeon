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
    "水": C("물", "수", "water"),
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
      "學者", "學問", "學院", "學術", "留學", "入學", "大學生", "晩學"
    ],
    // Single-page rule: three entries, all rare, none curated inline.
    "又": ["又玄", "又況", "又日新"]
  };

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

  // The worker's join. The content script never sees hanja.json, so the click
  // target's eumhun and gloss are resolved here, and a target with no entry
  // degrades to an inert row.
  function decompParts(char) {
    var rows = (DECOMP[char] || []).map(function (row) {
      var clickable = row.length === 1 || typeof row[1] === "string";
      if (!clickable) {
        var inert = { g: row[0] };
        if (typeof row[2] === "string") inert.name = row[2];
        return inert;
      }
      var target = typeof row[1] === "string" ? row[1] : row[0];
      var d = CHARS[target];
      if (!d) return { g: row[0] };
      var pair = (d.eumhun || [])[0] || {};
      return {
        g: row[0], t: target,
        hun: pair.hun || "", eum: pair.eum || "",
        gloss: (d.glosses || [])[0] || ""
      };
    });
    // The flag lands on the joined row at the pinned index, and only when
    // that row came out clickable, mirroring the worker's attachDecomp.
    var pin = PHON[char];
    if (typeof pin === "number" && rows[pin] && typeof rows[pin].t === "string") {
      rows[pin].phon = true;
    }
    return rows;
  }

  // ADDENDUM recomposition: the reverse index, DERIVED from DECOMP here exactly
  // as the worker derives it from decomp.json. Nothing is hand-listed, so a
  // change to DECOMP moves the Found-in lists with it. Each CLICKABLE row
  // credits its target (an 亻 row credits 人), deduped per containing character,
  // and a character is never found in itself.
  var FOUND_IN = (function () {
    var index = {};
    Object.keys(DECOMP).forEach(function (char) {
      var credited = {};
      DECOMP[char].forEach(function (row) {
        var clickable = row.length === 1 || typeof row[1] === "string";
        if (!clickable) return;
        var target = typeof row[1] === "string" ? row[1] : row[0];
        if (target === char || credited[target]) return;
        credited[target] = true;
        (index[target] = index[target] || []).push(char);
      });
    });
    return index;
  })();

  // The worker's join and ranking: cw index size descending, ties by codepoint.
  // A containing character with no entry is dropped rather than rendered as a
  // row that would navigate nowhere.
  function buildFoundIn(char) {
    var canon = canonicalize(String(char || "").normalize("NFC"));
    return (FOUND_IN[canon] || [])
      .filter(function (c) { return !!CHARS[c]; })
      .sort(function (a, b) {
        return ((CW[b] || []).length - (CW[a] || []).length) ||
          (a.codePointAt(0) - b.codePointAt(0));
      })
      .map(function (c) {
        var d = CHARS[c];
        var pair = (d.eumhun || [])[0] || {};
        var row = {
          char: c, hun: pair.hun || "", eum: pair.eum || "",
          gloss: (d.glosses || [])[0] || ""
        };
        if (d.lvl) row.lvl = d.lvl;   // the level chip renders on these rows too
        return row;
      });
  }

  // ADDENDUM used-in: the words.json spellings that STRICTLY contain a word
  // (self excluded), ranked. The worker derives these from the first char's cw
  // index; the fixture pins an explicit ranked list for 學生 and falls back to
  // a scan over `words` for everything else, which is the same contract.
  var USED_IN = {
    "學生": ["大學生", "中學生", "女學生", "留學生", "小學生", "苦學生"]
  };

  function usedInSpellings(word) {
    if (typeof word !== "string" || word.length < 2) return [];
    if (USED_IN[word]) {
      return USED_IN[word].filter(function (sp) { return !!WORDS[sp]; });
    }
    return Object.keys(WORDS).filter(function (sp) {
      return sp !== word && sp.indexOf(word) >= 0;
    });
  }

  function buildUsedIn(word) {
    return usedInSpellings(canonicalize(String(word || "").normalize("NFC")))
      .map(function (spelling) {
        var sense = (WORDS[spelling] || [])[0] || {};
        var entry = {
          hanja: spelling,
          hangul: sense.hangul || "",
          gloss: (sense.glosses || [])[0] || ""
        };
        if (sense.rare === true) entry.rare = true;
        if (sense.lessCommon === true) entry.lessCommon = true;
        return entry;
      });
  }

  // The service worker's `buildFullCompounds`: join each cw spelling against
  // `words` (first sense: hangul, first gloss or "", rare and lessCommon
  // only when true), preserving cw order.
  function fullCompounds(char) {
    var canon = canonicalize(String(char || "").normalize("NFC"));
    return (CW[canon] || []).map(function (spelling) {
      var sense = (WORDS[spelling] || [])[0] || {};
      var entry = {
        hanja: spelling,
        hangul: sense.hangul || "",
        gloss: (sense.glosses || [])[0] || ""
      };
      if (sense.rare === true) entry.rare = true;
      if (sense.lessCommon === true) entry.lessCommon = true;
      return entry;
    });
  }

  // byHangul: hangul spelling → every hanja spelling, no cap.
  var BY_HANGUL = {};
  Object.keys(WORDS).forEach(function (hanja) {
    WORDS[hanja].forEach(function (sense) {
      (BY_HANGUL[sense.hangul] = BY_HANGUL[sense.hangul] || []).push(hanja);
    });
  });

  // eum → chars, derived at runtime from readings/eumhun, ranked by how many
  // compounds the entry has (descending), exactly as the SPEC addendum says.
  var BY_EUM = {};
  Object.keys(CHARS).forEach(function (ch) {
    var d = CHARS[ch];
    var eums = {};
    (d.readings || []).forEach(function (r) { if (r) eums[r] = true; });
    (d.eumhun || []).forEach(function (e) { if (e && e.eum) eums[e.eum] = true; });
    Object.keys(eums).forEach(function (eum) {
      (BY_EUM[eum] = BY_EUM[eum] || []).push(ch);
    });
  });
  Object.keys(BY_EUM).forEach(function (eum) {
    BY_EUM[eum].sort(function (a, b) {
      return (CHARS[b].compounds || []).length - (CHARS[a].compounds || []).length;
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

  // Whole-word precedence: the native whole-string check, as the worker
  // makes it (nativeWholeLength). The longest native headword anchored at
  // the run's first syllable claims the run when what it leaves is shorter
  // than a word (a josa at most) and no hanja word anchored there reaches
  // as far; equal length is the identity group and takes the ordinary flow.
  function nativeWholeLength(h) {
    if (h.length < 2) return 0;
    var claimed = 0, len;
    for (len = Math.min(5, h.length); len >= 2; len--) {
      if (NATIVE[h.substr(0, len)]) { claimed = len; break; }
    }
    if (!claimed || h.length - claimed >= 2) return 0;
    var sino = 0;
    for (len = Math.min(MAX_WORD, h.length); len >= 2; len--) {
      if (BY_HANGUL[h.substr(0, len)]) { sino = len; break; }
    }
    return claimed > sino ? claimed : 0;
  }

  // --- Deconjugation (SPEC ADDENDUM 2026-09-05) ---------------------------
  // The REAL generator, imported the way the romanizer is: the module loads
  // once, on the first flagged lookup that has a hangul run of two or more
  // syllables, and that lookup answers with a promise (sendMessage settles
  // both call styles either way, as it does for interpreted lookups). The
  // fixture tables are the gate; the generator only proposes.
  var deconjugateFn = null;
  var deconjugatePromise = null;
  function loadDeconjugate() {
    if (!deconjugatePromise) {
      deconjugatePromise = import("../extension/deconjugate.js")
        .then(function (mod) { deconjugateFn = mod.deconjugate; return deconjugateFn; });
    }
    return deconjugatePromise;
  }

  function conjugates(entry) {
    return entry.pos === "verb" || entry.pos === "adj";
  }

  // The lemmas a form resolves to: generator candidates that are fixture
  // headwords with a verb or adj entry, ordered by the entries' `f` (absent
  // last) and then by generator order. 사는 gives 사다 first from the
  // generator; the buckets put 살다 ahead.
  function lemmasFor(form) {
    var ranked = [];
    deconjugateFn(form).forEach(function (lemma, index) {
      var entries = (NATIVE[lemma] || []).filter(conjugates);
      if (!entries.length) return;
      var f = Infinity;
      entries.forEach(function (e) { if (typeof e.f === "number" && e.f < f) f = e.f; });
      ranked.push({ lemma: lemma, index: index, f: f });
    });
    ranked.sort(function (a, b) { return a.f === b.f ? a.index - b.index : a.f - b.f; });
    return ranked.map(function (r) { return r.lemma; });
  }

  // The gate in miniature (the worker's deconjugatedClaim), asked only when
  // nativeWholeLength declined: the whole run, then the run minus one
  // syllable (먹기가 finds 먹다 at 먹기 and the josa goes on). Blocked when
  // a native headword or a hanja word with a non-rare spelling, anchored at
  // the first syllable, reaches that length or further: 남자 is 男子, never
  // 남다. Returns the claimed length and the lemmas, or length 0.
  function deconjugatedClaim(h) {
    var none = { length: 0, lemmas: [] };
    if (h.length < 2) return none;
    var blocked = 0, len, key;
    for (len = Math.min(5, h.length); len >= 2; len--) {
      if (NATIVE[h.substr(0, len)]) { blocked = len; break; }
    }
    for (len = Math.min(MAX_WORD, h.length); len >= 2; len--) {
      key = h.substr(0, len);
      if (BY_HANGUL[key] && !BY_HANGUL[key].every(isRare)) {
        if (len > blocked) blocked = len;
        break;
      }
    }
    var lengths = [h.length];
    if (h.length - 1 >= 2) lengths.push(h.length - 1);
    for (var k = 0; k < lengths.length; k++) {
      if (lengths[k] <= blocked) return none;
      var lemmas = lemmasFor(h.substr(0, lengths[k]));
      if (lemmas.length) return { length: lengths[k], lemmas: lemmas };
    }
    return none;
  }

  function deconjugatedLength(h) {
    return deconjugatedClaim(h).length;
  }

  // Hybrid parts on the wire: {hanja?, hangul}, plus native:true on a hangul
  // part the table holds (the row that opens a native card). Row glosses
  // (SPEC ADDENDUM 2026-09-05): a hanja part carries the glosses of the
  // WORDS entry whose hangul is the part's own (加工 read 가공), else the
  // first entry's; a native part carries the first NATIVE entry's glosses
  // and its pos (the half of the "hangul|pos" key the Korean definition
  // hangs on). A part the tables lack (工夫, 하다) gets neither field.
  // Hybrid card depth (SPEC ADDENDUM 2026-09-05): `lookup`, the part's
  // sub-response. A hanja part carries the UNFLAGGED literal lookup of its
  // hanja (the word match and the character matches exactly as typing 加工
  // yields them; natives never join, so a sub-lookup never holds a hybrid),
  // hung as {matches} when it found anything (工夫 finds the 工 character,
  // 再 nothing at all). A hangul part the table holds carries its entries,
  // every POS in table order, shaped as native matches WITHOUT parts (a
  // native part that is itself a hybrid nests no further). The sino and
  // ko attaches walk into these after the join, as the worker's do.
  function nativePartsFor(entry) {
    if (!entry.parts) return null;
    return entry.parts.map(function (p) {
      var out = p.hanja ? { hanja: p.hanja, hangul: p.hangul } : { hangul: p.hangul };
      if (p.hanja) {
        var senses = WORDS[p.hanja] || [];
        var sense = senses.filter(function (s) { return s.hangul === p.hangul; })[0] || senses[0];
        if (sense) out.glosses = sense.glosses.slice();
        var sub = lookup(p.hanja, { interpret: false, native: false });
        if (sub && sub.ok === true && sub.matches.length) out.lookup = { matches: sub.matches };
      } else if (NATIVE[p.hangul]) {
        out.native = true;
        out.glosses = NATIVE[p.hangul][0].glosses.slice();
        out.pos = NATIVE[p.hangul][0].pos;
        out.lookup = {
          nativeMatches: NATIVE[p.hangul].map(function (e) {
            var m = { kind: "native", word: p.hangul, pos: e.pos, glosses: e.glosses.slice() };
            if (e.origin) m.origin = e.origin;
            return m;
          })
        };
      }
      return out;
    });
  }

  // The walk the attaches below share: every part sub-response of every
  // native match in a response (or in a sub-response, which holds none).
  function eachPartLookup(resp, fn) {
    (resp && resp.nativeMatches || []).forEach(function (m) {
      (m && m.parts || []).forEach(function (p) {
        if (p && p.lookup && typeof p.lookup === "object") fn(p.lookup);
      });
    });
  }

  // The worker's flagged-lookup join: native words in the text's hangul runs
  // (greedy longest match, 2-syllable floor) plus the entry sharing any word
  // match's hangul (how a Han-run selection carries its Same sound entry),
  // deduped by headword in first-appearance order.
  function nativeMatchesFor(text, matches) {
    nativeReads++;
    var found = [];
    function indexOfWord(word) {
      for (var f = 0; f < found.length; f++) if (found[f].word === word) return f;
      return -1;
    }
    // A direct claim: the whole entry list, no form. A lemma reached through
    // a form earlier keeps the direct match, as the worker's join does.
    function claim(word) {
      if (!NATIVE[word]) return;
      var at = indexOfWord(word);
      if (at < 0) found.push({ word: word, form: null });
      else found[at].form = null;
    }
    // Deconjugation ADDENDUM: the lemmas a form resolved to, in gate order,
    // each carrying the form; a lemma already reached directly stays direct.
    function claimForm(form, lemmas) {
      lemmas.forEach(function (lemma) {
        if (indexOfWord(lemma) < 0) found.push({ word: lemma, form: form });
      });
    }
    runs(String(text || "").normalize("NFC")).forEach(function (run) {
      if (run.kind !== "hangul") return;
      var h = run.s, i = nativeWholeLength(h);
      if (i > 0) {
        claim(h.substr(0, i));
      } else {
        // Failing a headword, a conjugated form claims the run for its
        // lemmas, the same claim the lookup's hangul branch makes.
        var formClaim = deconjugatedClaim(h);
        if (formClaim.length > 0) {
          claimForm(h.substr(0, formClaim.length), formClaim.lemmas);
          i = formClaim.length;
        }
      }
      while (i < h.length) {
        var hit = null;
        for (var len = Math.min(5, h.length - i); len >= 2; len--) {
          if (NATIVE[h.substr(i, len)]) { hit = h.substr(i, len); break; }
        }
        if (hit) { claim(hit); i += hit.length; } else { i += 1; }
      }
    });
    (matches || []).forEach(function (m) {
      if (m && m.kind === "word" && m.hangul) claim(m.hangul);
    });
    var out = [];
    found.forEach(function (hit) {
      var word = hit.word;
      // Only a verb or an adjective joins through a form (the worker's
      // conjugatingEntries); a direct hit brings every entry.
      var entries = hit.form ? NATIVE[word].filter(conjugates) : NATIVE[word];
      entries.forEach(function (entry) {
        var m = {
          kind: "native", word: word,
          pos: entry.pos, glosses: entry.glosses.slice()
        };
        // Origin markers ADDENDUM: the field rides through as written, and
        // an entry without one carries none.
        if (entry.origin) m.origin = entry.origin;
        var parts = nativePartsFor(entry);
        if (parts) m.parts = parts;
        // Deconjugation ADDENDUM: the claimed surface, on form hits only.
        if (hit.form) m.form = hit.form;
        out.push(m);
      });
    });
    return out;
  }

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

  // The worker's attach: the char's entry rides WHOLE onto every char match
  // the table knows about, after the lookup itself is done. Alignment and
  // display order are baked at build time, so nothing here sorts or joins.
  function attachSinoMatches(resp) {
    sinoReads++;
    if (!resp || resp.ok !== true) return resp;
    return attachSinoInto(resp);
  }
  // One read per request: the sub-responses inside hybrid parts are walked
  // under the same read, as the worker's attach walks them.
  function attachSinoInto(resp) {
    (Array.isArray(resp.matches) ? resp.matches : []).forEach(function (m) {
      if (!m) return;
      if (m.kind === "word") {
        var wordEntry = SINO_WORDS[m.canonical];
        if (wordEntry) m.sinoWord = wordEntry;
        return;
      }
      if (m.kind !== "char") return;
      var entry = SINO[m.canonical];
      if (entry) m.sino = entry;
    });
    eachPartLookup(resp, attachSinoInto);
    return resp;
  }

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

  function koFor(table, key) {
    return (typeof key === "string" && Object.prototype.hasOwnProperty.call(table, key))
      ? table[key] : null;
  }

  // The worker's attachKoRows: rows keyed by hanja spelling ("word") or by
  // char / decomposition target ("char"). A row the table lacks gets no field.
  function attachKoRows(rows, kind) {
    (rows || []).forEach(function (row) {
      if (!row || typeof row !== "object") return;
      var entry = kind === "char"
        ? koFor(KO.chars, typeof row.char === "string" ? row.char : row.t)
        : koFor(KO.words, row.hanja);
      if (entry) row.ko = entry;
    });
    return rows;
  }

  // The worker's attachKo: every match and every gloss-bearing row it
  // carries. The inline compound rows are the fixture table's own objects
  // and are copied, as the worker copies hanja.json's.
  function attachKoMatches(resp) {
    koReads++;
    if (!resp || resp.ok !== true) return resp;
    return attachKoInto(resp);
  }
  // One read per request, the hybrid parts' sub-responses walked under it
  // (word, char and native keys alike), as the worker's attachKo walks them.
  function attachKoInto(resp) {
    (resp.matches || []).forEach(function (m) {
      if (!m || typeof m !== "object") return;
      if (m.kind === "word") {
        var w = koFor(KO.words, m.canonical);
        if (w) m.ko = w;
        attachKoRows(m.parts, "word");
      } else if (m.kind === "char") {
        var c = koFor(KO.chars, m.canonical);
        if (c) m.ko = c;
        m.compounds = (m.compounds || []).map(function (row) {
          var e = row && typeof row === "object" ? koFor(KO.words, row.hanja) : null;
          if (!e) return row;
          var copy = {};
          Object.keys(row).forEach(function (k) { copy[k] = row[k]; });
          copy.ko = e;
          return copy;
        });
        attachKoRows(m.parts, "char");
      } else if (m.kind === "reading") {
        attachKoRows(m.candidates, "char");
      }
    });
    (resp.nativeMatches || []).forEach(function (m) {
      var n = m && m.kind === "native" ? koFor(KO.natives, m.word + "|" + m.pos) : null;
      if (n) m.ko = n;
      // Hybrid part rows: a hanja part keys into words by its hanja, a
      // native part into natives by "hangul|pos"; a part the tables lack
      // (工夫, 하다) stays bare, as the worker's attachKo leaves it.
      attachKoRows(m && m.parts, "word");
      (m && m.parts || []).forEach(function (p) {
        if (!p || p.native !== true || typeof p.pos !== "string") return;
        var e = koFor(KO.natives, p.hangul + "|" + p.pos);
        if (e) p.ko = e;
      });
    });
    eachPartLookup(resp, attachKoInto);
    return resp;
  }

  var HAN = /\p{Script=Han}/u;
  var HANGUL = /[가-힣]/;
  var MAX_WORD = 6;

  function runs(text) {
    var out = [], cur = null;
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      var kind = HAN.test(ch) ? "han" : (HANGUL.test(ch) ? "hangul" : null);
      if (!kind) { cur = null; continue; }
      if (!cur || cur.kind !== kind) { cur = { kind: kind, s: "" }; out.push(cur); }
      cur.s += ch;
    }
    return out;
  }

  function canonicalize(s) {
    var out = "";
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      out += VARIANTS[ch] || ch;
    }
    return out;
  }

  // Protocol addendum: word matches ≥3 chars carry `parts` — the interior
  // re-segmented against `words` (the full span excluded), covering it in order.
  function computeParts(hanja) {
    if (hanja.length < 3) return null;
    var out = [], i = 0, sawWord = false;
    while (i < hanja.length) {
      var hit = null, hitLen = 0;
      for (var len = Math.min(MAX_WORD, hanja.length - i); len >= 2; len--) {
        if (len === hanja.length) continue;          // exclude the whole span
        var cand = hanja.substr(i, len);
        if (WORDS[cand]) { hit = cand; hitLen = len; break; }
      }
      if (hit) {
        out.push({
          type: "word", hanja: hit, hangul: WORDS[hit][0].hangul,
          glosses: (WORDS[hit][0].glosses || []).slice(0, 2)
        });
        sawWord = true;
        i += hitLen;
      } else {
        out.push({ type: "char", char: hanja.charAt(i) });
        i += 1;
      }
    }
    return sawWord ? out : null;
  }

  function isRare(hanja) {
    return (WORDS[hanja] || [])[0] ? (WORDS[hanja][0].rare === true) : false;
  }
  function isLessCommon(hanja) {
    return (WORDS[hanja] || [])[0] ? (WORDS[hanja][0].lessCommon === true) : false;
  }
  function isPlain(hanja) {
    return !isRare(hanja) && !isLessCommon(hanja);
  }

  function wordMatch(surface, hanja, hangul) {
    var m = {
      kind: "word", surface: surface, canonical: hanja, hangul: hangul,
      glosses: (WORDS[hanja][0] || {}).glosses || [],
      chars: hanja.split("")
    };
    if (isRare(hanja)) m.rare = true;   // flags omitted when false
    if (isLessCommon(hanja)) m.lessCommon = true;
    // ADDENDUM used-in: how many larger words contain this spelling. Omitted
    // when 0, so the UI knows to render no disclosure row at all.
    var usedIn = usedInSpellings(hanja).length;
    if (usedIn > 0) m.usedInCount = usedIn;
    var parts = computeParts(hanja);
    if (parts) m.parts = parts;
    return m;
  }

  function charMatch(canon, surface) {
    var d = CHARS[canon];
    if (!d) return null;
    var m = {
      kind: "char", surface: surface, canonical: canon,
      eumhun: d.eumhun, readings: d.readings, glosses: d.glosses,
      compounds: d.compounds
    };
    // Total size of the char's cw index — the UI needs it to label
    // "Show 5 more (N)" before it has fetched anything. Omitted when 0.
    if (CW[canon] && CW[canon].length) m.cwCount = CW[canon].length;
    // Character level; omitted only for pre-migration entries (see LVL).
    if (d.lvl) m.lvl = d.lvl;
    // Decomposition rows, joined; omitted for characters with no entry.
    var parts = decompParts(canon);
    if (parts.length) m.parts = parts;
    // How many characters this one is a part of, from the derived index.
    // Omitted when 0, so the UI renders no Found-in row at all.
    var foundIn = (FOUND_IN[canon] || []).length;
    if (foundIn > 0) m.foundInCount = foundIn;
    return m;
  }

  function readingMatch(syllable) {
    var chars = BY_EUM[syllable] || [];
    if (!chars.length) return null;
    return {
      kind: "reading", surface: syllable, eum: syllable,
      candidates: chars.map(function (ch) {
        var d = CHARS[ch];
        var hun = (d.eumhun && d.eumhun[0] && d.eumhun[0].hun) || "";
        var cand = {
          char: ch, hun: hun, eum: syllable,
          gloss: (d.glosses && d.glosses[0]) || ""
        };
        if (d.lvl) cand.lvl = d.lvl;   // propagated onto reading candidates
        return cand;
      })
    };
  }

  // Interpreted lookups, v2 (SPEC "Romanized search v2"): the mini rr map is
  // gone. The keyboard side stays canned, because Node owns the Dubeolsik
  // automaton and the harness needs only the conversions its checks type.
  // Romanization is no longer canned at all: the REAL generator in
  // extension/deromanize.js (rr.js rides in through its import graph)
  // proposes hangul candidates, the fixture tables gate them, and the v2
  // coverage collapse below decides what the interpretation claims. The
  // module loads once, on the first interpreted lookup, so interpreted
  // responses are promises; sendMessage settles them for both call styles.
  var DUBEOLSIK = {
    gkrtod: "학생",
    su: "녀"
  };

  // Preference between two surviving interpretations is Node's business (the
  // merge matrix is node-tested). The fixture pins the worker's decision for
  // its one dual case; everything else takes the Dubeolsik tiebreak.
  var DUAL_RR_FIRST = { su: true };

  // The typed-channel gate, as the worker applies it: letters, with hyphens,
  // apostrophes and internal spaces tolerated.
  var LATIN_QUERY = /^[A-Za-z][A-Za-z' -]*$/;

  var deromanizePromise = null;
  function loadDeromanize() {
    if (!deromanizePromise) {
      deromanizePromise = import("../extension/deromanize.js")
        .then(function (mod) { return mod.deromanize; });
    }
    return deromanizePromise;
  }

  // How many syllables of one candidate the fixture explains: rule 3b spans
  // over BY_HANGUL first, then (flagged only) the native greedy walk over
  // the stretches the Sino pass left, mirroring the worker.
  function coveredSyllables(h, native) {
    var mark = [], i, j, len;
    var claimed = native ? nativeWholeLength(h) : 0;
    // Deconjugation ADDENDUM: a form's claim counts as covered too, so the
    // candidate is CLASS_WHOLE in the collapse.
    if (native && claimed === 0) claimed = deconjugatedLength(h);
    for (i = 0; i < claimed; i++) mark[i] = true;
    i = claimed;
    while (i < h.length) {
      var hit = 0;
      for (len = Math.min(MAX_WORD, h.length - i); len >= 2; len--) {
        if (BY_HANGUL[h.substr(i, len)]) { hit = len; break; }
      }
      if (hit) { for (j = 0; j < hit; j++) mark[i + j] = true; i += hit; }
      else { i += 1; }
    }
    if (native) {
      i = 0;
      while (i < h.length) {
        if (mark[i]) { i += 1; continue; }
        var end = i;
        while (end < h.length && !mark[end]) end += 1;
        var k = i;
        while (k < end) {
          var nhit = 0;
          for (len = Math.min(5, end - k); len >= 2; len--) {
            if (NATIVE[h.substr(k, len)]) { nhit = len; break; }
          }
          if (nhit) { for (j = 0; j < nhit; j++) mark[k + j] = true; k += nhit; }
          else { k += 1; }
        }
        i = end;
      }
    }
    var covered = 0;
    for (i = 0; i < h.length; i++) if (mark[i]) covered += 1;
    return covered;
  }

  // Dedupe key for merged candidate matches, per the worker's rules.
  function matchKey(m) {
    return m.kind + ":" + (m.canonical || m.surface || "");
  }

  // The keyboard interpretation: canned conversion, normal fixture lookup.
  function dubeolsikInterpretation(typed, native) {
    if (!Object.prototype.hasOwnProperty.call(DUBEOLSIK, typed)) return null;
    var to = DUBEOLSIK[typed];
    var matches = lookup(to, { native: native }).matches;
    var nativeMatches = native ? nativeMatchesFor(to, matches) : [];
    if (!matches.length && !nativeMatches.length) return null;
    return {
      kind: "dubeolsik", from: typed, to: to,
      matches: matches, nativeMatches: nativeMatches
    };
  }

  // Candidates the fake bothers to resolve. The worker's cap is larger; the
  // fixture's queries all land their words in the first dozen candidates.
  var RESOLVE_CAP = 64;

  // The romanization interpretation, v2: real candidates, fixture gate,
  // coverage collapse. Class A (one dictionary unit) beats class B (covered
  // end to end) beats class C (partial); class C keeps only the candidates
  // covering the most syllables, so a splinter can never add matches, and
  // it roots as the TYPED text because no one hangul spelling is canonical.
  function rrInterpretation(typed, native, deromanize) {
    var candidates = deromanize(typed);
    var survivors = [];
    for (var i = 0; i < candidates.length && i < RESOLVE_CAP; i++) {
      var hangul = candidates[i].hangul;
      var matches = lookup(hangul, { native: native }).matches;
      var nativeMatches = native ? nativeMatchesFor(hangul, matches) : [];
      if (!matches.length && !nativeMatches.length) continue;
      var whole = matches.some(function (m) {
        return (m.kind === "word" && m.surface === hangul) || m.kind === "reading";
      }) || nativeMatches.some(function (m) { return m.word === hangul || m.form === hangul; });
      var covered = whole ? hangul.length : coveredSyllables(hangul, native);
      survivors.push({
        hangul: hangul, tier: candidates[i].tier,
        matches: matches, nativeMatches: nativeMatches,
        cls: whole ? 0 : (covered === hangul.length ? 1 : 2),
        covered: covered
      });
    }
    if (!survivors.length) return null;
    var bestClass = Math.min.apply(null, survivors.map(function (s) {
      return s.cls;
    }));
    var pool = survivors.filter(function (s) { return s.cls === bestClass; });
    if (bestClass === 2) {
      var maxCovered = Math.max.apply(null, pool.map(function (s) {
        return s.covered;
      }));
      pool = pool.filter(function (s) { return s.covered === maxCovered; });
    }
    // Tier first; the fixture carries no `f` buckets, so the rest of the
    // ranking is the generator's own stable order.
    pool.sort(function (a, b) { return a.tier - b.tier; });
    var merged = [], nativeMerged = [], seen = {}, seenNative = {};
    pool.forEach(function (s) {
      s.matches.forEach(function (m) {
        var key = matchKey(m);
        if (seen[key]) return;
        seen[key] = true;
        merged.push(m);
      });
      s.nativeMatches.forEach(function (m) {
        var key = m.word + "|" + m.pos;
        if (seenNative[key]) return;
        seenNative[key] = true;
        nativeMerged.push(m);
      });
    });
    var to = bestClass === 2 ? typed : pool[0].hangul;
    return {
      kind: "rr", from: typed, to: to,
      matches: merged, nativeMatches: nativeMerged
    };
  }

  // Both interpreters, dropped when empty, flattened into the response with
  // `start` marking where each group's matches begin. Native hits collect at
  // the response level, deduped in preferred order, as the worker does it.
  function interpretedLookup(typed, native) {
    // Both modules first, so the per-candidate lookups inside stay
    // synchronous (the gate needs the generator in hand).
    return Promise.all([loadDeromanize(), loadDeconjugate()]).then(function (mods) {
      var deromanize = mods[0];
      var dub = dubeolsikInterpretation(typed, native);
      var rr = rrInterpretation(typed, native, deromanize);
      var interps = [dub, rr].filter(function (x) { return x !== null; });
      if (interps.length === 2 && DUAL_RR_FIRST[typed]) interps.reverse();
      if (!interps.length) return { ok: true, matches: [] };
      var matches = [], descriptors = [];
      var nativeOut = [], seenNative = {};
      interps.forEach(function (interp) {
        descriptors.push({
          kind: interp.kind, from: interp.from, to: interp.to,
          start: matches.length
        });
        matches = matches.concat(interp.matches);
        interp.nativeMatches.forEach(function (m) {
          var key = m.word + "|" + m.pos;
          if (seenNative[key]) return;
          seenNative[key] = true;
          nativeOut.push(m);
        });
      });
      var resp = { ok: true, matches: matches, interpretations: descriptors };
      if (native && nativeOut.length) resp.nativeMatches = nativeOut;
      return resp;
    });
  }

  function lookup(text, opts) {
    var typed = String(text === null || text === undefined ? "" : text).trim();
    var o = opts !== null && typeof opts === "object" ? opts : {};
    // Interpretation is gated on the flag, never on string shape alone: a
    // literal Latin lookup falls through and matches nothing, exactly as the
    // worker's does. The interpreted path answers with a promise.
    if (o.interpret === true && LATIN_QUERY.test(typed)) {
      return interpretedLookup(typed, o.native === true);
    }
    // Deconjugation ADDENDUM: a flagged lookup with a hangul run the gate
    // could ask about needs the generator loaded; the first such lookup
    // answers with a promise and every later one is synchronous again. The
    // unflagged path never loads it, so it stays exactly as it was.
    if (o.native === true && !deconjugateFn &&
        runs(typed.normalize("NFC")).some(function (r) {
          return r.kind === "hangul" && r.s.length >= 2;
        })) {
      return loadDeconjugate().then(function () { return lookup(text, opts); });
    }

    var words = [], chars = [], seenChar = {};
    function pushChar(canon, surface) {
      if (seenChar[canon]) return;
      var m = charMatch(canon, surface);
      if (!m) return;
      seenChar[canon] = true;
      chars.push(m);
    }

    var segments = runs(text.normalize("NFC"));

    // 3c: the whole extracted selection is exactly one hangul syllable.
    if (segments.length === 1 && segments[0].kind === "hangul" && segments[0].s.length === 1) {
      var rm = readingMatch(segments[0].s);
      return { ok: true, matches: rm ? [rm] : [] };
    }

    var hanTotal = 0;
    segments.forEach(function (r) { if (r.kind === "han") hanTotal += r.s.length; });

    segments.forEach(function (run) {
      if (run.kind === "han") {
        var canon = canonicalize(run.s);
        var i = 0;
        while (i < canon.length) {
          var hit = null, hitLen = 0;
          for (var len = Math.min(MAX_WORD, canon.length - i); len >= 2; len--) {
            var cand = canon.substr(i, len);
            if (WORDS[cand]) { hit = cand; hitLen = len; break; }
          }
          if (hit) {
            words.push(wordMatch(run.s.substr(i, hitLen), hit, WORDS[hit][0].hangul));
            // Han-char count only — hangul doesn't count toward the threshold.
            if (hanTotal <= 4) {
              for (var k = 0; k < hit.length; k++) pushChar(hit.charAt(k), run.s.charAt(i + k));
            }
            i += hitLen;
          } else {
            pushChar(canon.charAt(i), run.s.charAt(i));
            i += 1;
          }
        }
      } else {
        // Whole-word precedence, flagged only: the claimed syllables are the
        // native pass's; rule 3b starts after them. Deconjugation ADDENDUM:
        // failing a headword, a form's claim takes the syllables the same way.
        var h = run.s, j = o.native === true ? nativeWholeLength(h) : 0;
        if (o.native === true && j === 0) j = deconjugatedLength(h);
        while (j < h.length) {
          var found = null, foundLen = 0;
          for (var l = Math.min(MAX_WORD, h.length - j); l >= 2; l--) {
            var c = h.substr(j, l);
            if (BY_HANGUL[c]) { found = c; foundLen = l; break; }
          }
          if (!found) { j += 1; continue; }
          // ALL hanja spellings, no cap: the UI renders a selector. Unflagged
          // spellings order first, then lessCommon, then rare; the first of
          // them contributes the char cards.
          var spellings = BY_HANGUL[found].filter(isPlain)
            .concat(BY_HANGUL[found].filter(isLessCommon))
            .concat(BY_HANGUL[found].filter(isRare));
          spellings.forEach(function (hanja, idx) {
            words.push(wordMatch(found, hanja, found));
            // Hangul-sourced matches ALWAYS get component char cards (first only).
            if (idx === 0) {
              for (var k2 = 0; k2 < hanja.length; k2++) pushChar(hanja.charAt(k2), hanja.charAt(k2));
            }
          });
          j += foundLen;
        }
      }
    });

    return { ok: true, matches: words.concat(chars) };
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

  // Fixed stamp, so an export body is byte-stable across runs.
  var SAVED_ADDED_AT = Date.UTC(2026, 7, 17);

  var SAVED_TYPES = {
    savedGet: 1, savedToggle: 1, savedCheck: 1, savedRemove: 1, savedMove: 1,
    folderCreate: 1, folderRename: 1, folderDelete: 1,
    settingsGet: 1, settingsSet: 1, savedExport: 1
  };

  var SAVED_CSV_COLUMNS = [
    "kind", "key", "hangul", "eumhun", "readings", "definitions",
    "level", "japanese", "chinese", "folder", "added"
  ];

  var saved, settings, savedCheckCalls, savedLastCheckKeys, savedFail;
  var savedLastGetKo = null;   // whether the last savedGet carried ko:true

  function resetSaved() {
    saved = {
      v: 1, folders: [{ id: "f0", name: "Saved" }], items: [],
      nextFolder: 1, nextItem: 0
    };
    settings = {
      v: 1, defaultFolderId: "f0",
      anki: {
        wordFront: "hanja", wordBack: ["hangul", "defs"],
        charFront: "char", charBack: ["eumhun", "defs"]
      }
    };
    savedCheckCalls = 0;
    savedLastCheckKeys = null;
    savedFail = { all: false, check: false, toggle: false };
  }
  resetSaved();

  // SPEC's map key for one identity: "c:<glyph>" / "w:<spelling>".
  function savedKey(kind, key) { return (kind === "char" ? "c" : "w") + ":" + key; }

  function folderById(id) {
    for (var fi = 0; fi < saved.folders.length; fi++) {
      if (saved.folders[fi].id === id) return saved.folders[fi];
    }
    return null;
  }

  function foldersCopy() {
    return saved.folders.map(function (f) { return { id: f.id, name: f.name }; });
  }

  function itemCopy(item) {
    return {
      id: item.id, kind: item.kind, key: item.key,
      folderId: item.folderId, addedAt: item.addedAt
    };
  }

  function settingsCopy() {
    return {
      v: settings.v, defaultFolderId: settings.defaultFolderId,
      language: settings.language,
      anki: {
        wordFront: settings.anki.wordFront,
        wordBack: settings.anki.wordBack.slice(),
        charFront: settings.anki.charFront,
        charBack: settings.anki.charBack.slice()
      }
    };
  }

  // The read-time join. An item whose entry has left the dictionary becomes a
  // {missing:true} row rather than vanishing — the saved view says so and the
  // exporter skips and counts it.
  function joinSaved(items, withSino, withKo) {
    // The export's Korean join reads the table once per export, and ONLY
    // when the caller opened the gate (savedExport under 한국어 with a
    // definitions field in play).
    if (withKo) koReads++;
    return items.map(function (item) {
      var row = itemCopy(item);
      if (item.kind === "char") {
        var c = CHARS[item.key];
        if (!c) { row.missing = true; return row; }
        row.eumhun = c.eumhun || [];
        row.readings = c.readings || [];
        row.glosses = c.glosses || [];
        if (c.lvl) row.lvl = c.lvl;
        // The export's sino join: the entry rides whole, and ONLY when the
        // caller opened the gate (savedExport with a ja/zh charBack field).
        if (withSino && SINO[item.key]) row.sino = SINO[item.key];
        if (withKo && KO.chars[item.key]) row.ko = KO.chars[item.key];
        return row;
      }
      var senses = WORDS[item.key];
      if (!senses || !senses.length) { row.missing = true; return row; }
      row.hangul = senses[0].hangul || "";
      var glosses = [];
      senses.forEach(function (s) {
        (s.glosses || []).forEach(function (g) {
          if (g && glosses.indexOf(g) < 0) glosses.push(g);
        });
      });
      row.glosses = glosses;
      if (senses.every(function (s) { return s.rare === true; })) row.rare = true;
      if (senses.every(function (s) { return s.lessCommon === true; })) row.lessCommon = true;
      if (withKo && KO.words[item.key]) row.ko = KO.words[item.key];
      return row;
    });
  }

  function numberedDefs(glosses) {
    return (glosses || []).filter(Boolean).map(function (g, i) {
      return (i + 1) + ". " + g;
    }).join("; ");
  }

  // The definitions field is what the card shows: the Korean senses joined
  // with " / " when the row carries an entry, the English definitions
  // otherwise (saved.js's definitionsText).
  function definitionsText(row) {
    var senses = row.ko && row.ko.d ? row.ko.d.filter(Boolean) : [];
    return senses.length ? senses.join(" / ") : numberedDefs(row.glosses);
  }

  function savedField(row, token) {
    if (token === "hanja" || token === "char" || token === "key") return row.key || "";
    if (token === "hangul") return row.hangul || "";
    if (token === "eumhun") {
      return (row.eumhun || []).map(function (e) {
        return ((e.hun || "") + " " + (e.eum || "")).trim();
      }).filter(Boolean).join(", ");
    }
    if (token === "readings") return (row.readings || []).filter(Boolean).join(", ");
    if (token === "defs") return definitionsText(row);
    if (token === "lvl") return row.lvl || "";
    // Sino readings text: the pairs' readings in baked order, the katakana
    // middle dot for on'yomi and a spaced middle dot for pinyin, no markers,
    // no eum tags. Empty when the row carries no entry for the language.
    if (token === "ja" || token === "zh") {
      return ((row.sino && row.sino[token]) || []).map(function (p) {
        return p[0];
      }).join(token === "ja" ? "・" : " · ");
    }
    return "";
  }

  function quoteField(value, needsQuoting) {
    return needsQuoting.test(value) ? '"' + value.split('"').join('""') + '"' : value;
  }

  // The folder rides along as an Anki TAG in a third column, so folders
  // survive the trip into Anki. Anki separates tags with whitespace, so a
  // name's whitespace runs collapse to "_" — saved.js's ankiTag rule.
  function savedAnkiTag(row) {
    var folder = folderById(row.folderId);
    return String(folder ? folder.name : row.folderId).trim().replace(/\s+/g, "_");
  }

  function buildSavedAnki(rows) {
    var lines = ["#separator:tab", "#html:false", "#tags column:3"];
    rows.forEach(function (row) {
      if (row.missing === true) return;
      var isChar = row.kind === "char";
      var front = savedField(row, isChar ? settings.anki.charFront : settings.anki.wordFront);
      var back = (isChar ? settings.anki.charBack : settings.anki.wordBack)
        .map(function (t) { return savedField(row, t); })
        .filter(function (v) { return v !== ""; })
        .join(" · ");
      lines.push(quoteField(front, /[\t\n\r"]/) + "\t" +
                 quoteField(back, /[\t\n\r"]/) + "\t" +
                 quoteField(savedAnkiTag(row), /[\t\n\r"]/));
    });
    return lines.join("\n") + "\n";
  }

  function buildSavedCsv(rows) {
    var lines = [SAVED_CSV_COLUMNS.join(",")];
    rows.forEach(function (row) {
      if (row.missing === true) return;
      var folder = folderById(row.folderId);
      var cells = [
        row.kind === "char" ? "char" : "word",
        savedField(row, "key"), savedField(row, "hangul"),
        savedField(row, "eumhun"), savedField(row, "readings"),
        savedField(row, "defs"), savedField(row, "lvl"),
        savedField(row, "ja"), savedField(row, "zh"),
        folder ? folder.name : row.folderId,
        row.addedAt > 0 ? new Date(row.addedAt).toISOString().slice(0, 10) : ""
      ];
      lines.push(cells.map(function (c) {
        return quoteField(c, /[",\n\r]/);
      }).join(","));
    });
    return lines.join("\n") + "\n";
  }

  function exportSelection(msg) {
    if (Array.isArray(msg.ids) && msg.ids.length) {
      return saved.items.filter(function (it) { return msg.ids.indexOf(it.id) >= 0; });
    }
    if (Array.isArray(msg.folderIds) && msg.folderIds.length) {
      return saved.items.filter(function (it) {
        return msg.folderIds.indexOf(it.folderId) >= 0;
      });
    }
    return msg.all === true ? saved.items.slice() : [];
  }

  function savedMessage(msg) {
    if (msg.type === "savedCheck") {
      savedCheckCalls++;
      savedLastCheckKeys = (Array.isArray(msg.keys) ? msg.keys : []).map(function (k) {
        return savedKey(k && k.kind, k && k.key);
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

    if (msg.type === "savedGet") {
      // The same client-set flag as lookups: a flagged request's rows carry
      // their Korean entry (handleSavedGet's join).
      savedLastGetKo = msg.ko === true;
      return { ok: true, folders: foldersCopy(),
               items: joinSaved(saved.items, false, msg.ko === true) };
    }

    if (msg.type === "savedToggle") {
      var kind = msg.kind === "char" ? "char" : msg.kind === "word" ? "word" : null;
      var key = typeof msg.key === "string" ? msg.key.normalize("NFC") : "";
      if (!kind || !key) return { ok: false, error: "bad identity" };
      for (var ti = 0; ti < saved.items.length; ti++) {
        if (saved.items[ti].kind === kind && saved.items[ti].key === key) {
          saved.items.splice(ti, 1);            // identity toggles OFF
          return { ok: true, saved: false, folders: foldersCopy() };
        }
      }
      var target = folderById(settings.defaultFolderId) ? settings.defaultFolderId : "f0";
      var item = {
        id: "i" + saved.nextItem, kind: kind, key: key,
        folderId: target, addedAt: SAVED_ADDED_AT
      };
      saved.nextItem++;
      saved.items.push(item);
      return {
        ok: true, saved: true, item: itemCopy(item),
        folderId: target, folders: foldersCopy()
      };
    }

    if (msg.type === "savedCheck") {
      var map = {};
      (Array.isArray(msg.keys) ? msg.keys : []).forEach(function (entry) {
        if (!entry || typeof entry !== "object") return;
        var k = entry.kind === "char" ? "char" : "word";
        if (typeof entry.key !== "string" || entry.key === "") return;
        map[savedKey(k, entry.key)] = saved.items.some(function (it) {
          return it.kind === k && it.key === entry.key;
        });
      });
      return { ok: true, saved: map };
    }

    if (msg.type === "savedRemove") {
      var dropIds = Array.isArray(msg.ids) ? msg.ids : [];
      var before = saved.items.length;
      saved.items = saved.items.filter(function (it) {
        return dropIds.indexOf(it.id) < 0;
      });
      return { ok: true, removed: before - saved.items.length };
    }

    if (msg.type === "savedMove") {
      if (!folderById(msg.folderId)) return { ok: false, error: "no such folder" };
      var wanted = Array.isArray(msg.ids) ? msg.ids : [];
      var moved = 0;
      saved.items.forEach(function (it) {
        if (wanted.indexOf(it.id) < 0 || it.folderId === msg.folderId) return;
        it.folderId = msg.folderId;
        moved++;
      });
      return { ok: true, moved: moved };
    }

    if (msg.type === "folderCreate") {
      var name = typeof msg.name === "string" ? msg.name.trim() : "";
      if (!name) return { ok: false, error: "folder name required" };
      var folder = { id: "f" + saved.nextFolder, name: name };
      saved.nextFolder++;
      saved.folders.push(folder);
      return { ok: true, folder: { id: folder.id, name: folder.name } };
    }

    if (msg.type === "folderRename") {
      var renamed = folderById(msg.id);
      var newName = typeof msg.name === "string" ? msg.name.trim() : "";
      if (!renamed) return { ok: false, error: "no such folder" };
      if (!newName) return { ok: false, error: "folder name required" };
      renamed.name = newName;
      return { ok: true, folder: { id: renamed.id, name: renamed.name } };
    }

    if (msg.type === "folderDelete") {
      if (msg.id === "f0") {
        return { ok: false, error: "the default folder cannot be deleted" };
      }
      if (!folderById(msg.id)) return { ok: false, error: "no such folder" };
      var rehomed = 0;
      saved.items.forEach(function (it) {
        if (it.folderId !== msg.id) return;
        it.folderId = "f0";
        rehomed++;
      });
      saved.folders = saved.folders.filter(function (f) { return f.id !== msg.id; });
      // Deleting the "save new items to" folder resets the setting, so no
      // surface can observe a dangling default.
      if (settings.defaultFolderId === msg.id) settings.defaultFolderId = "f0";
      return { ok: true, moved: rehomed, settings: settingsCopy() };
    }

    if (msg.type === "settingsGet") return { ok: true, settings: settingsCopy() };

    if (msg.type === "settingsSet") {
      var patch = msg.patch && typeof msg.patch === "object" ? msg.patch : {};
      Object.keys(patch).forEach(function (field) {
        if (field === "anki" && patch.anki && typeof patch.anki === "object") {
          Object.keys(patch.anki).forEach(function (sub) {
            settings.anki[sub] = patch.anki[sub];
          });
          return;
        }
        settings[field] = patch[field];
      });
      if (!folderById(settings.defaultFolderId)) settings.defaultFolderId = "f0";
      return { ok: true, settings: settingsCopy() };
    }

    if (msg.type === "savedExport") {
      // The worker's sino fetch gate, mirrored: sino entries join the export
      // rows only when a charBack field asks for a reading language.
      var wantsSino = settings.anki.charBack.indexOf("ja") >= 0 ||
                      settings.anki.charBack.indexOf("zh") >= 0;
      var isCsv = msg.format === "csv";
      // The worker's Korean fetch gate, mirrored (exportWantsKo): the table
      // joins only under 한국어 with a definitions field in play, which is
      // every CSV and any Anki file whose fronts or backs carry defs.
      var wantsKo = settings.language === "ko" && (isCsv ||
        [settings.anki.wordFront, settings.anki.charFront]
          .concat(settings.anki.wordBack, settings.anki.charBack).indexOf("defs") >= 0);
      var rows = joinSaved(exportSelection(msg), wantsSino, wantsKo);
      var skipped = rows.filter(function (r) { return r.missing === true; }).length;
      return {
        ok: true,
        tsv: isCsv ? buildSavedCsv(rows) : buildSavedAnki(rows),
        count: rows.length - skipped,
        skipped: skipped,
        filename: isCsv ? "okpyeon-saved-20260817.csv" : "okpyeon-anki-20260817.txt"
      };
    }

    return { ok: false, error: "unknown message type" };
  }

  var savedStore = {
    reset: function () { resetSaved(); },
    state: function () {
      return {
        folders: foldersCopy(),
        items: saved.items.map(itemCopy),
        settings: settingsCopy()
      };
    },
    // savedCheck is batched one-per-render-pass, so its call count is a
    // meaningful assertion and not just bookkeeping.
    checkCalls: function () { return savedCheckCalls; },
    lastCheckKeys: function () {
      return savedLastCheckKeys ? savedLastCheckKeys.slice() : null;
    },
    lastGetKo: function () { return savedLastGetKo; },
    fail: function (which, on) { savedFail[which] = on !== false; }
  };

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
    word: "<div class=\"card\"><div class=\"hedge\"><\/div><div class=\"word-body\"><div class=\"head\"><div class=\"surface\">學生<\/div><div class=\"headmeta\"><div class=\"hangul\"><span class=\"rnav\" title=\"Look up 학생\" aria-label=\"Look up 학생\" role=\"button\" tabindex=\"0\">학생<\/span><\/div><\/div><button class=\"save save--unknown\" type=\"button\" aria-pressed=\"false\" aria-label=\"Save 學生\" title=\"Save\">☆<\/button><a class=\"wiki\" href=\"https://en.wiktionary.org/wiki/%ED%95%99%EC%83%9D#Korean\" target=\"_blank\" rel=\"noopener noreferrer\" aria-label=\"Wiktionary entry for 학생 (opens in a new tab)\">Wiktionary ↗<\/a><\/div><div class=\"glosses\"><div class=\"gloss\"><div class=\"clampwrap\"><span class=\"gloss-text clamp clamp-2\">Student; pupil<\/span><\/div><\/div><\/div><div class=\"chips\"><span class=\"chip nav\" aria-label=\"學 배울 학\" role=\"button\" tabindex=\"0\"><span class=\"chip-glyph\">學<\/span><span class=\"chip-text\">배울 학<\/span><\/span><span class=\"chip nav\" aria-label=\"生 날 생\" role=\"button\" tabindex=\"0\"><span class=\"chip-glyph\">生<\/span><span class=\"chip-text\">날 생<\/span><\/span><\/div><div class=\"entry-row usedin-row nav\" role=\"button\" tabindex=\"0\"><span class=\"usedin-text\">Used in <b>6<\/b> larger words<\/span><\/div><\/div><div class=\"parts\"><\/div><div class=\"components\"><div class=\"label\">Component hanja<\/div><div class=\"component-list\"><div class=\"card component\"><div class=\"head\"><div class=\"surface\">學<\/div><div class=\"headmeta\"><div class=\"eumhun\"><span class=\"hun\">배울 <\/span><span class=\"rnav\" title=\"Characters read 학\" aria-label=\"Characters read 학\" role=\"button\" tabindex=\"0\">학<\/span><span class=\"edu-badge edu-badge--lvlM\" title=\"MOE curriculum, middle school (중학교용)\" aria-label=\"MOE curriculum, middle school (중학교용)\">Middle school<\/span><\/div><\/div><button class=\"save save--unknown\" type=\"button\" aria-pressed=\"false\" aria-label=\"Save 學\" title=\"Save\">☆<\/button><a class=\"wiki\" href=\"https://en.wiktionary.org/wiki/%E5%AD%B8#Korean\" target=\"_blank\" rel=\"noopener noreferrer\" aria-label=\"Wiktionary entry for 學 (opens in a new tab)\">Wiktionary ↗<\/a><\/div><div class=\"glosses numbered\"><div class=\"gloss\"><span class=\"gloss-num\">1.<\/span><div class=\"clampwrap\"><span class=\"gloss-text clamp clamp-2\">To learn; study<\/span><\/div><\/div><div class=\"gloss\"><span class=\"gloss-num\">2.<\/span><div class=\"clampwrap\"><span class=\"gloss-text clamp clamp-2\">School; learning<\/span><\/div><\/div><\/div><div class=\"label\">Compounds<\/div><div class=\"compounds\"><div class=\"entry-row compound-row nav\" role=\"button\" tabindex=\"0\"><div class=\"clampwrap\"><span class=\"compound clamp clamp-1\"><span class=\"cpd-hangul\">학생<\/span><span class=\"cpd-hanja\"> (學生)<\/span><span class=\"cpd-gloss\">: student<\/span><\/span><\/div><\/div><div class=\"entry-row compound-row nav\" role=\"button\" tabindex=\"0\"><div class=\"clampwrap\"><span class=\"compound clamp clamp-1\"><span class=\"cpd-hangul\">대학<\/span><span class=\"cpd-hanja\"> (大學)<\/span><span class=\"cpd-gloss\">: university<\/span><\/span><\/div><\/div><div class=\"entry-row compound-row nav\" role=\"button\" tabindex=\"0\"><div class=\"clampwrap\"><span class=\"compound clamp clamp-1\"><span class=\"cpd-hangul\">학교<\/span><span class=\"cpd-hanja\"> (學校)<\/span><span class=\"cpd-gloss\">: school<\/span><\/span><\/div><\/div><div class=\"entry-row compound-row nav\" role=\"button\" tabindex=\"0\"><div class=\"clampwrap\"><span class=\"compound clamp clamp-1\"><span class=\"cpd-hangul\">과학<\/span><span class=\"cpd-hanja\"> (科學)<\/span><span class=\"cpd-gloss\">: science<\/span><\/span><\/div><\/div><div class=\"entry-row compound-row\"><div class=\"clampwrap\"><span class=\"compound clamp clamp-1\"><span class=\"cpd-hangul\">학벌<\/span><span class=\"cpd-gloss\">: academic clique<\/span><\/span><\/div><\/div><\/div><button class=\"cpd-more\" type=\"button\">Show 5 more (13)<\/button><button class=\"cpd-more cpd-all\" type=\"button\">Show all (17)<\/button><\/div><div class=\"card component\"><div class=\"head\"><div class=\"surface\">生<\/div><div class=\"headmeta\"><div class=\"eumhun\"><span class=\"hun\">날 <\/span><span class=\"rnav\" title=\"Characters read 생\" aria-label=\"Characters read 생\" role=\"button\" tabindex=\"0\">생<\/span><span class=\"edu-badge edu-badge--lvlM\" title=\"MOE curriculum, middle school (중학교용)\" aria-label=\"MOE curriculum, middle school (중학교용)\">Middle school<\/span><\/div><\/div><button class=\"save save--unknown\" type=\"button\" aria-pressed=\"false\" aria-label=\"Save 生\" title=\"Save\">☆<\/button><a class=\"wiki\" href=\"https://en.wiktionary.org/wiki/%E7%94%9F#Korean\" target=\"_blank\" rel=\"noopener noreferrer\" aria-label=\"Wiktionary entry for 生 (opens in a new tab)\">Wiktionary ↗<\/a><\/div><div class=\"glosses numbered\"><div class=\"gloss\"><span class=\"gloss-num\">1.<\/span><div class=\"clampwrap\"><span class=\"gloss-text clamp clamp-2\">To be born; to live<\/span><\/div><\/div><div class=\"gloss\"><span class=\"gloss-num\">2.<\/span><div class=\"clampwrap\"><span class=\"gloss-text clamp clamp-2\">Raw; fresh<\/span><\/div><\/div><\/div><div class=\"label\">Compounds<\/div><div class=\"compounds\"><div class=\"entry-row compound-row nav\" role=\"button\" tabindex=\"0\"><div class=\"clampwrap\"><span class=\"compound clamp clamp-1\"><span class=\"cpd-hangul\">학생<\/span><span class=\"cpd-hanja\"> (學生)<\/span><span class=\"cpd-gloss\">: student<\/span><\/span><\/div><\/div><div class=\"entry-row compound-row nav\" role=\"button\" tabindex=\"0\"><div class=\"clampwrap\"><span class=\"compound clamp clamp-1\"><span class=\"cpd-hangul\">생일<\/span><span class=\"cpd-hanja\"> (生日)<\/span><span class=\"cpd-gloss\">: birthday<\/span><\/span><\/div><\/div><\/div><\/div><\/div><\/div><\/div>",
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
          if (msg.native === true) this.__nativeCalls++;
          this.__lastSino = msg.sino === true;
          if (msg.sino === true) this.__sinoCalls++;
          resp = lookup(String(msg.text || ""),
            { interpret: msg.interpret === true, native: msg.native === true });
          // SPEC gate: only flagged requests may touch the native table. An
          // interpreted response is a promise and already carries its own
          // native hits, collected per candidate inside the interpreters.
          // Deconjugation ADDENDUM: a literal flagged lookup may answer with
          // a promise too (the generator loading), so the join lands after
          // it settles; a synchronous answer is joined synchronously as
          // before.
          if (msg.native === true && resp &&
              !(msg.interpret === true && LATIN_QUERY.test(String(msg.text || "").trim()))) {
            var joinNative = function (r) {
              if (r && r.ok === true) {
                var nm = nativeMatchesFor(String(msg.text || ""), r.matches);
                if (nm.length) r.nativeMatches = nm;
              }
              return r;
            };
            resp = typeof resp.then === "function" ? resp.then(joinNative) : joinNative(resp);
          }
          // Same gate for the sino table. The attach lands AFTER the lookup
          // settles, so interpreted (promise) responses carry their per-char
          // entries too, exactly like the worker's post-join attach.
          if (msg.sino === true) {
            resp = Promise.resolve(resp).then(attachSinoMatches);
          }
          // And for the ko table, last of all, like the worker's attach.
          this.__lastKo = msg.ko === true;
          if (msg.ko === true) {
            this.__koCalls++;
            resp = Promise.resolve(resp).then(attachKoMatches);
          }
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
    __lookup: lookup,
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
