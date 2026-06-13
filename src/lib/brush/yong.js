// "永" (yong) — classic Chinese calligraphy practice character.
// Used as default starting symbol when no localStorage state exists.

const YONG = {
  symbol: {
    strokes: [
      {
        id: 12,
        points: [
          { id: 9,  x: -0.3698758306326635,   y:  0.3170933176699934,  pressure: 0 },
          { id: 10, x: -0.25616373958616306,  y:  0.2232025632708423,  pressure: 1 },
          { id: 13, x: -0.0037019338435043264, y:  0.2962287188466529, pressure: 0.6004907454224002 },
          { id: 14, x:  0.06932412622171609,  y:  0.32856884344118353, pressure: 0.93 },
          { id: 15, x:  0.011754243780641771, y:  0.20367120664754834, pressure: 0.26921714846062245 },
          { id: 16, x:  0.011754381709375969, y: -0.418533726873775,   pressure: 0.8235966399941508 },
          { id: 17, x:  0.06448357128377274,  y: -0.46674326768668806, pressure: 0.48056581202241094 },
          { id: 18, x: -0.009337404463370017, y: -0.5420707010685022,  pressure: 0.61 },
          { id: 19, x: -0.16134134715938053,  y: -0.384179904478735,   pressure: 0 },
        ],
        paths: [
          { timeEase: "linear", pressureEase: "linear", duration: 1,
            ctrl: { x: -0.31980076241570445, y: 0.26649663030386255 } },
          { timeEase: "linear", pressureEase: "linear", duration: 1, ctrl: null },
          { timeEase: "linear", pressureEase: "linear", duration: 1, ctrl: null },
          { timeEase: "linear", pressureEase: "linear", duration: 1, ctrl: null },
          { timeEase: "linear", pressureEase: "linear", duration: 1, ctrl: null },
          { timeEase: "linear", pressureEase: "linear", duration: 1, ctrl: null },
          { timeEase: "linear", pressureEase: "linear", duration: 1,
            ctrl: { x: 0.018540774903211174, y: -0.47890682871389035 } },
          { timeEase: "linear", pressureEase: "linear", duration: 1,
            ctrl: { x: -0.08296415256967897, y: -0.4404988338342292 } },
        ],
      },
      {
        id: 46,
        points: [
          { id: 45, x: -0.0264389855242099,  y: 0.5738018530800493,  pressure: 0 },
          { id: 47, x:  0.013253935167725212, y: 0.48417265274448096, pressure: 0.7481162133727197 },
          { id: 48, x: -0.10198363324065891,  y: 0.41118885941917105, pressure: 0 },
        ],
        paths: [
          { timeEase: "linear", pressureEase: "linear", duration: 1, ctrl: null },
          { timeEase: "linear", pressureEase: "linear", duration: 1, ctrl: null },
        ],
      },
      {
        id: 50,
        points: [
          { id: 49, x: -0.47622062350116995, y:  0.02932992340895093,  pressure: 0 },
          { id: 65, x: -0.33149720868947125, y: -0.012260580853063975, pressure: 1 },
          { id: 52, x: -0.09140032979649021, y:  0.1340483849567948,   pressure: 0.39 },
          { id: 63, x: -0.09119383408907777, y:  0.06275445953056162,  pressure: 0.66 },
          { id: 53, x: -0.07483037236882649, y:  0.02633888247132218,  pressure: 1 },
          { id: 54, x: -0.5726814967415564,  y: -0.4615084710202595,   pressure: 0 },
        ],
        paths: [
          { timeEase: "linear", pressureEase: "linear", duration: 1, ctrl: null },
          { timeEase: "linear", pressureEase: "linear", duration: 1, ctrl: null },
          { timeEase: "linear", pressureEase: "linear", duration: 1, ctrl: null },
          { timeEase: "linear", pressureEase: "linear", duration: 1, ctrl: null },
          { timeEase: "linear", pressureEase: "linear", duration: 1,
            ctrl: { x: -0.2726393722220752, y: -0.23330261517153403 } },
        ],
      },
      {
        id: 56,
        points: [
          { id: 55, x: 0.27437208472815694, y: 0.269102814935126,   pressure: 0.08 },
          { id: 64, x: 0.26686900359694243, y: 0.1734392603671415,  pressure: 0.78 },
          { id: 57, x: 0.07230949440549433, y: 0.04577206816851695, pressure: 0 },
        ],
        paths: [
          { timeEase: "linear", pressureEase: "linear", duration: 1, ctrl: null },
          { timeEase: "linear", pressureEase: "linear", duration: 1, ctrl: null },
        ],
      },
      {
        id: 59,
        points: [
          { id: 58, x: 0.05263660945452328, y:  0.08511796672119741, pressure: 0 },
          { id: 62, x: 0.09071101821882818, y:  0.05160583895371157, pressure: 0.25 },
          { id: 60, x: 0.26874481681239315, y: -0.24297856539937993, pressure: 1 },
          { id: 61, x: 0.6101323464585343,  y: -0.37428154067739805, pressure: 0 },
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
