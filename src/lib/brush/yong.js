// "永" (yong) — classic Chinese calligraphy practice character.
// Used as default starting symbol when no localStorage state exists.

const YONG = {
  symbol: {
    strokes: [
      {
        id: 12,
        points: [
          { id: 9,  x: -0.3584093456197688,    y:  0.2842196766338418,  pressure: 0.12 },
          { id: 10, x: -0.2452586584151989,    y:  0.23983419044518905, pressure: 1 },
          { id: 14, x:  0.00382924108500083,   y:  0.34024428203636603, pressure: 0.82 },
          { id: 66, x:  0.045669570794906404,  y:  0.312654081550908,   pressure: 0.27121173711502555 },
          { id: 15, x:  0.0031633190316054383, y:  0.2771554483468107,  pressure: 0.36 },
          { id: 16, x:  0.013641765262991656,  y: -0.3536374193445505,  pressure: 0.8235966399941508 },
          { id: 17, x:  0.03821853078232163,   y: -0.4610307507173328,  pressure: 0.76 },
          { id: 18, x:  0.007907099481493637,  y: -0.5194690998217911,  pressure: 1 },
          { id: 19, x: -0.16436933016270447,   y: -0.375228718015124,   pressure: 0 },
        ],
        paths: [
          { timeEase: "linear", duration: 1,
            ctrl: { x: -0.3083062954884894, y: 0.2624012887394387 }, pctrl: null },
          { timeEase: "easeInOutQuad", duration: 1,
            ctrl: { x: -0.11134789223208413, y: 0.28386977610799435 }, pctrl: { x: 0.5, k: 0.19 } },
          { timeEase: "linear", duration: 1,
            ctrl: { x: 0.027551594801576103, y: 0.3374119865906974 }, pctrl: { k: 0.5 } },
          { timeEase: "linear", duration: 1.01,
            ctrl: { x: 0.008703612110704431, y: 0.2943430167547797 }, pctrl: { k: 0.25 } },
          { timeEase: "linear", duration: 1, ctrl: null, pctrl: null },
          { timeEase: "linear", duration: 1,
            ctrl: { x: 0.017000528871742054, y: -0.4155008904599511 }, pctrl: { k: 0.52 } },
          { timeEase: "linear", duration: 1,
            ctrl: { x: 0.018540774903211175, y: -0.47890682871389034 }, pctrl: { k: 1 } },
          { timeEase: "linear", duration: 1,
            ctrl: { x: -0.060993570957464834, y: -0.441729533803846 }, pctrl: null },
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
          { timeEase: "linear", duration: 1,
            ctrl: { x: -0.003187687797098834, y: 0.49038047041607347 }, pctrl: null },
          { timeEase: "linear", duration: 1,
            ctrl: { x: -0.0021466774553761166, y: 0.4275519649020569 }, pctrl: null },
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
          { timeEase: "linear", duration: 1, ctrl: null, pctrl: null },
          { timeEase: "linear", duration: 1, ctrl: null, pctrl: null },
          { timeEase: "linear", duration: 1,
            ctrl: { x: -0.08838347154830392, y: 0.07853833652872921 }, pctrl: null },
          { timeEase: "linear", duration: 1,
            ctrl: { x: -0.2726393722220752, y: -0.23330261517153403 }, pctrl: null },
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
          { timeEase: "linear", duration: 1,
            ctrl: { x: 0.27122552379631604, y: 0.21511825187072459 }, pctrl: null },
          { timeEase: "linear", duration: 1, ctrl: null, pctrl: null },
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
          { timeEase: "linear", duration: 1, ctrl: null, pctrl: null },
          { timeEase: "linear", duration: 1,
            ctrl: { x: 0.18351534306862866, y: -0.12710735658725342 }, pctrl: null },
          { timeEase: "linear", duration: 1, ctrl: null, pctrl: null },
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
