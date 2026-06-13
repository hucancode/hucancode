// "永" (yong) — classic Chinese calligraphy practice character.
// Used as default starting symbol when no localStorage state exists.

const YONG = {
  symbol: {
    strokes: [
      {
        id: 12,
        points: [
          { id: 9,  x: -0.3698758306326635,    y:  0.3170933176699934,  pressure: 0 },
          { id: 10, x: -0.24303649400319166,   y:  0.22524765351317033, pressure: 1 },
          { id: 14, x:  0.02980033829935999,   y:  0.33168504127496995, pressure: 1 },
          { id: 15, x:  0.0012759354779897925, y:  0.2122591408175861,  pressure: 0.26921714846062245 },
          { id: 16, x:  0.011754381709375969,  y: -0.418533726873775,   pressure: 0.8235966399941508 },
          { id: 17, x:  0.06448357128377274,   y: -0.46674326768668806, pressure: 0.43 },
          { id: 18, x: -0.009570482981455908,  y: -0.5181071836099005,  pressure: 1 },
          { id: 19, x: -0.16134134715938053,   y: -0.384179904478735,   pressure: 0 },
        ],
        paths: [
          { timeEase: "linear", pressureEase: "linear", duration: 1,
            ctrl: { x: -0.31980076241570443, y: 0.26649663030386256 } },
          { timeEase: "easeInOutQuad", pressureEase: "easeInOutQuad", duration: 1,
            ctrl: { x: -0.11028342397183147, y: 0.2885896490893999 } },
          { timeEase: "linear", pressureEase: "linear", duration: 1,
            ctrl: { x: -0.00008008832232850316, y: 0.26666959580535926 } },
          { timeEase: "linear", pressureEase: "linear", duration: 1, ctrl: null },
          { timeEase: "linear", pressureEase: "linear", duration: 1, ctrl: null },
          { timeEase: "linear", pressureEase: "linear", duration: 1,
            ctrl: { x: 0.018540774903211175, y: -0.47890682871389034 } },
          { timeEase: "linear", pressureEase: "linear", duration: 1,
            ctrl: { x: -0.08296415256967897, y: -0.4404988338342292 } },
        ],
      },
      {
        id: 46,
        points: [
          { id: 45, x: -0.008893510004764751, y: 0.5565055868179798,  pressure: 0 },
          { id: 47, x:  0.023340802286640268, y: 0.44173000072784047, pressure: 0.7481162133727197 },
          { id: 48, x: -0.10195880825878544,  y: 0.3883861951440081,  pressure: 0 },
        ],
        paths: [
          { timeEase: "linear", pressureEase: "linear", duration: 1,
            ctrl: { x: -0.003187687797098834, y: 0.49038047041607347 } },
          { timeEase: "linear", pressureEase: "linear", duration: 1,
            ctrl: { x: -0.0021466774553761166, y: 0.4275519649020569 } },
        ],
      },
      {
        id: 50,
        points: [
          { id: 49, x: -0.47622062350116995, y:  0.02932992340895093,  pressure: 0 },
          { id: 65, x: -0.33149720868947125, y: -0.012260580853063975, pressure: 1 },
          { id: 52, x: -0.08750915029075365, y:  0.12444214770821943,  pressure: 0.39 },
          { id: 53, x: -0.04485353560227244, y:  0.04992978426836281,  pressure: 1 },
          { id: 54, x: -0.6329466774199234,  y: -0.5195819080728056,   pressure: 0 },
        ],
        paths: [
          { timeEase: "linear", pressureEase: "linear", duration: 1, ctrl: null },
          { timeEase: "linear", pressureEase: "easeInOutQuad", duration: 1, ctrl: null },
          { timeEase: "linear", pressureEase: "linear", duration: 1,
            ctrl: { x: -0.08838347154830392, y: 0.07853833652872921 } },
          { timeEase: "linear", pressureEase: "linear", duration: 1,
            ctrl: { x: -0.2726393722220752, y: -0.23330261517153403 } },
        ],
      },
      {
        id: 56,
        points: [
          { id: 55, x: 0.2359005363061723,  y: 0.2582960526165184,  pressure: 0.08 },
          { id: 64, x: 0.26686900359694243, y: 0.1734392603671415,  pressure: 0.78 },
          { id: 57, x: 0.041614972050227204, y: 0.015434317663404015, pressure: 0 },
        ],
        paths: [
          { timeEase: "linear", pressureEase: "linear", duration: 1,
            ctrl: { x: 0.27122552379631604, y: 0.21511825187072459 } },
          { timeEase: "linear", pressureEase: "linear", duration: 1, ctrl: null },
        ],
      },
      {
        id: 59,
        points: [
          { id: 58, x: 0.032474381060719426, y:  0.050447447618082786, pressure: 0 },
          { id: 62, x: 0.10477693933625058,  y: -0.011671418953828824, pressure: 0.25 },
          { id: 60, x: 0.26874481681239315,  y: -0.24297856539937993,  pressure: 1 },
          { id: 61, x: 0.6064665792654471,   y: -0.3289767381333952,   pressure: 0 },
        ],
        paths: [
          { timeEase: "linear", pressureEase: "linear", duration: 1, ctrl: null },
          { timeEase: "linear", pressureEase: "linear", duration: 1, ctrl: null },
          { timeEase: "linear", pressureEase: "linear", duration: 1, ctrl: null },
        ],
      },
    ],
  },
};

export function yongSymbol() {
  return JSON.parse(JSON.stringify(YONG.symbol));
}

export function yongMaxId() {
  let m = 0;
  for (const s of YONG.symbol.strokes) {
    if (s.id > m) m = s.id;
    for (const p of s.points) if (p.id > m) m = p.id;
  }
  return m;
}
