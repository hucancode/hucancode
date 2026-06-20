const YONG = {
  symbol: {
    strokes: [
      {
        id: 46,
        points: [
          { id: 45, x: -0.09391049996116055, y: 0.5375881894983036, pressure: 0.23 },
          { id: 47, x: -0.014691262561216438, y: 0.47515608920149555, pressure: 0.71 },
          { id: 98, x: -0.1035699622162235, y: 0.4376297276762161, pressure: 0.08 }
        ],
        paths: [
          { delay: 0, duration: 0.21, ctrl: { x: -0.030844336637881657, y: 0.5138570202810265 }, pctrl: null },
          { delay: 0, duration: 1, ctrl: null, pctrl: { k: 0.07 } }
        ],
      },
      {
        id: 95,
        points: [
          { id: 69, x: -0.3138170326264643, y: 0.3234787440086355, pressure: 0.1 },
          { id: 70, x: -0.2435206648288569, y: 0.28150722663110006, pressure: 0.8 },
          { id: 71, x: -0.08800952076192955, y: 0.3700883801207101, pressure: 0.6 },
          { id: 72, x: 0.062490621196462585, y: 0.323400866271358, pressure: 0.9 },
          { id: 73, x: -0.003372813946465665, y: 0.2829567588656172, pressure: 1 },
          { id: 74, x: -0.020550067455024627, y: -0.3412502859089874, pressure: 0.75 },
          { id: 75, x: -0.009838854987032457, y: -0.46957165361803876, pressure: 0.85 },
          { id: 97, x: -0.15677535372543053, y: -0.37692131205851964, pressure: 0.15 }
        ],
        paths: [
          { delay: 0, duration: 1, ctrl: { x: -0.3212001837621773, y: 0.22009620837586358 }, pctrl: null },
          { delay: 0, duration: 1, ctrl: { x: -0.17006250831733274, y: 0.32466089000052156 }, pctrl: { k: 0.29 } },
          { delay: 0, duration: 1, ctrl: { x: 0.027852167531549114, y: 0.3786843036272135 }, pctrl: null },
          { delay: 0, duration: 1, ctrl: null, pctrl: null },
          { delay: 0, duration: 1, ctrl: null, pctrl: { k: 0.42 } },
          { delay: 0, duration: 1, ctrl: { x: -0.0050740718885794005, y: -0.3953471464131918 }, pctrl: null },
          { delay: 0, duration: 1, ctrl: null, pctrl: null }
        ],
      },
      {
        id: 96,
        points: [
          { id: 77, x: -0.4318195454609951, y: 0.030031762556217895, pressure: 0.07 },
          { id: 80, x: -0.39333347034963173, y: -0.042336168116182106, pressure: 0.79 },
          { id: 82, x: -0.07630260836913921, y: 0.09105703219638145, pressure: 0.52 },
          { id: 83, x: -0.06205141905592404, y: 0.04325971432565548, pressure: 1 },
          { id: 84, x: -0.41644693030330804, y: -0.38201231165771143, pressure: 0.32 },
          { id: 93, x: -0.4935300653564657, y: -0.38167219601166846, pressure: 0.06 }
        ],
        paths: [
          { delay: 0, duration: 1, ctrl: { x: -0.43345880312157403, y: -0.02105050767702996 }, pctrl: null },
          { delay: 0, duration: 1, ctrl: { x: -0.2106468098124545, y: 0.06767376598657412 }, pctrl: { k: 0 } },
          { delay: 0, duration: 1, ctrl: null, pctrl: null },
          { delay: 0, duration: 1, ctrl: { x: -0.19483920440760485, y: -0.184171064285382 }, pctrl: null },
          { delay: 0, duration: 1, ctrl: { x: -0.5514548337762397, y: -0.47559340416894114 }, pctrl: null }
        ],
      },
      {
        id: 100,
        points: [
          { id: 94, x: 0.3628272659189945, y: 0.38734958529514507, pressure: 0.22 },
          { id: 86, x: 0.3990103714793176, y: 0.29050127289985106, pressure: 1 },
          { id: 87, x: 0.00878357211789365, y: 0.05381298612220123, pressure: 0.2 },
          { id: 88, x: -0.0011456581265234037, y: 0.09226443564227205, pressure: 0.12 },
          { id: 89, x: 0.0809603955831591, y: 0.029492316352015685, pressure: 0.28 },
          { id: 90, x: 0.24960355790022862, y: -0.2413100702045824, pressure: 1 },
          { id: 91, x: 0.6867196479466993, y: -0.5020523454173829, pressure: 0.06 }
        ],
        paths: [
          { delay: 0, duration: 1, ctrl: { x: 0.38846866790424606, y: 0.3503049355337017 }, pctrl: null },
          { delay: 0, duration: 1, ctrl: { x: 0.29042428657883745, y: 0.19204599368397962 }, pctrl: null },
          { delay: 0, duration: 1, ctrl: null, pctrl: null },
          { delay: 0, duration: 1, ctrl: null, pctrl: null },
          { delay: 0, duration: 1, ctrl: null, pctrl: { k: 0.75 } },
          { delay: 0, duration: 1, ctrl: { x: 0.4336490474646991, y: -0.3624401587978253 }, pctrl: { k: 0.5 } }
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
