// Slovní zásoba: w = slovo rozdělené na slabiky pomlčkou (malými písmeny), e = emoji.
// Slabiky ručně, aby šly zobrazit jako pomůcka (MA-SO).
const WORDS = [
  // krátká (<= 4 písmena)
  { w: 'med', e: '🍯' }, { w: 'sýr', e: '🧀' }, { w: 'led', e: '🧊' },
  { w: 'sůl', e: '🧂' }, { w: 'čaj', e: '🍵' }, { w: 'krab', e: '🦀' },
  { w: 'ma-so', e: '🍖' }, { w: 'ki-wi', e: '🥝' }, { w: 'ká-va', e: '☕' },
  { w: 'dort', e: '🎂' }, { w: 'vo-da', e: '💧' }, { w: 'rý-že', e: '🍚' },
  { w: 'ry-ba', e: '🐟' }, { w: 'ku-ře', e: '🍗' }, { w: 'ta-co', e: '🌮' },
  { w: 'dý-ně', e: '🎃' }, { w: 'o-řech', e: '🥜' },
  { w: 'ze-lí', e: '🥬' }, { w: 'vej-ce', e: '🥚' }, 
  { w: 'sa-lát', e: '🥗' }, { w: 'man-go', e: '🥭' }, { w: 'pá-rek', e: '🌭' },
  { w: 'o-li-va', e: '🫒' }, { w: 'su-ši', e: '🍣' }, { w: 'lí-zát-ko', e: '🍭' },
  { w: 'ka-še', e: '🥣' }, { w: 'kost', e: '🦴' }, { w: 'bo-ta', e: '👢' }, { w: 'míč', e: '⚽' }, { w: 'au-to', e: '🚗' }, { w: 'zub', e: '🦷' },

  // delší (5–6 písmen)
  { w: 'ba-nán', e: '🍌' }, { w: 'chléb', e: '🍞' }, { w: 'mlé-ko', e: '🥛' },
  { w: 'piz-za', e: '🍕' }, { w: 'mr-kev', e: '🥕' }, { w: 'raj-če', e: '🍅' },
  { w: 'hou-ba', e: '🍄' }, { w: 'cit-ron', e: '🍋' }, { w: 'me-loun', e: '🍉' },
  { w: 'ja-ho-da', e: '🍓' }, { w: 'třeš-ně', e: '🍒' }, { w: 'ko-kos', e: '🥥' },
  { w: 'li-lek', e: '🍆' }, { w: 'o-kur-ka', e: '🥒' }, { w: 'ci-bu-le', e: '🧅' },
  { w: 'čes-nek', e: '🧄' }, { w: 'ko-láč', e: '🥧' }, { w: 'ja-bl-ko', e: '🍎' },
  { w: 'hruš-ka', e: '🍐' }, { w: 'más-lo', e: '🧈' }, { w: 'nud-le', e: '🍜' },
  { w: 'kre-ve-ta', e: '🦐' }, { w: 'kaš-tan', e: '🌰' }, { w: 'vaf-le', e: '🧇' },
  { w: 'sla-ni-na', e: '🥓' }, { w: 'muf-fin', e: '🧁' }, { w: 'ba-ge-ta', e: '🥖' },
  { w: 'bon-bon', e: '🍬' }, { w: 'hrá-šek', e: '🫛' }, { w: 'fa-zo-le', e: '🫘' },
  { w: 'send-vič', e: '🥪' }, { w: 'prec-lík', e: '🥨' }, { w: 'roh-lík', e: '🥐' },

  // dlouhá (7+ písmen)
  { w: 'zmrz-li-na', e: '🍦' }, { w: 'ku-ku-ři-ce', e: '🌽' }, { w: 'bros-kev', e: '🍑' },
  { w: 'a-na-nas', e: '🍍' }, { w: 'a-vo-ká-do', e: '🥑' }, { w: 'bram-bo-ra', e: '🥔' },
  { w: 'pap-ri-ka', e: '🫑' }, { w: 'bro-ko-li-ce', e: '🥦' }, { w: 'su-šen-ka', e: '🍪' },
  { w: 'čo-ko-lá-da', e: '🍫' }, { w: 'ham-bur-ger', e: '🍔' }, { w: 'hra-nol-ky', e: '🍟' },
  { w: 'po-lév-ka', e: '🍲' }, { w: 'pa-la-čin-ka', e: '🥞' }, { w: 'bo-rův-ky', e: '🫐' },
  { w: 'kob-li-ha', e: '🍩' }, { w: 'špa-ge-ty', e: '🍝' }, { w: 'hroz-ny', e: '🍇' },
  { w: 'pi-ro-žek', e: '🥟' },
];

// Šablony vět. {S} = slovo. Věty se skládají ze slov z krátkého a delšího tieru.
const SENTENCES = [
  'chci {S}', 'dej mi {S}', 'mám rád {S}', 'kde je {S}?', 'to je {S}',
  'mňam, {S}!', 'já chci {S}', 'dnes jím {S}', 'dej mi jen {S}',
];

// Slabiky pro jména příšerek
const NAME_SYLLABLES = ['bo', 'žu', 'mi', 'lu', 'ka', 'pi', 'tu', 'fí', 'ro', 'ně', 'ša', 'do', 'ku', 'ví', 'ha', 'če'];
