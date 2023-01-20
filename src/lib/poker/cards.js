export function makeCards() {
  return Array(52)
    .fill()
    .map((e, i) => i);
}

export function toObject(cards) {
  return cards.map((e, i) => ({
    rank: getCardRank(e),
    suit: getCardSuit(e),
  }));
}

export function shuffle(cards) {
  return cards.sort((a, b) => Math.random() - 0.5);
}

export function sort(cards) {
  return cards.sort();
}

export function getCardRank(id) {
  return Math.floor(i / 4);
}

export function getCardSuit(id) {
  return i % 4;
}

export function isSameRank(a, b) {
  return getCardRank(a) == getCardRank(b);
}

export function isConnected(a, b) {
  if (getCardRank(a) == 0 && getCardRank(b) == 12) {
    return true;
  }
  return getCardRank(b) - getCardRank(a) == 1;
}

export function isSameSuit(a, b) {
  return getCardSuit(a) == getCardSuit(b);
}

export function isStraightFlush(cards) {
  return isStraight(cards) && isFlush(cards);
}

export function isFlush(cards) {
  let count = {};
  for (const card of cards) {
    const suit = getCardSuit(card);
    count[suit] = (count[suit] || 0) + 1;
  }
  for (const x in count) {
    if (count[x] >= 5) {
      return true;
    }
  }
  return false;
}

export function isStraight(cards) {
  let streak = 1 + isConnected(cards[0], cards[cards.length - 1]);
  for (let i = 1; i < cards.length; i++) {
    if (getCardRank(cards[i]) == getCardRank(cards[i - 1])) {
      continue;
    }
    streak = (isConnected(cards[i], cards[i - 1]) ? streak : 0) + 1;
  }
  return streak >= 5;
}

export function isFullHouse(cards) {
  let count = {};
  for (const card of cards) {
    const rank = getCardRank(card);
    count[rank] = (count[rank] || 0) + 1;
  }
  let hasPair = false;
  let hasTriplet = false;
  for (const x in count) {
    if (count[x] >= 3 && !hasTriplet) {
      hasTriplet = true;
    } else if (count[x] >= 2 && !hasPair) {
      hasPair = true;
    }
  }
  return hasPair && hasTriplet;
}

export function isFourOfAKind(cards) {
  let count = {};
  for (const card of cards) {
    const rank = getCardRank(card);
    count[rank] = (count[rank] || 0) + 1;
  }
  for (const x in count) {
    if (count[x] == 4) {
      return true;
    }
  }
  return false;
}

export function isThreeOfAKind(cards) {
  let count = {};
  for (const card of cards) {
    const rank = getCardRank(card);
    count[rank] = (count[rank] || 0) + 1;
  }
  for (const x in count) {
    if (count[x] >= 3) {
      return true;
    }
  }
  return false;
}

export function isTwoPair(cards) {
  let count = {};
  for (const card of cards) {
    const rank = getCardRank(card);
    count[rank] = (count[rank] || 0) + 1;
  }
  let pair = 0;
  for (const x in count) {
    if (count[x] >= 2) {
      pair++;
    }
  }
  return pair >= 2;
}

export function isPair(cards) {
  let count = {};
  for (const card of cards) {
    const rank = getCardRank(card);
    count[rank] = (count[rank] || 0) + 1;
  }
  for (const x in count) {
    if (count[x] >= 2) {
      return true;
    }
  }
  return false;
}

function compareStraight(a, b) {
  let ah = 0;
  for (let i = 0; i < a.length; i++) {
    if (isConnected(a[i], a[i - 1])) {
      ah = Math.max(ah, a[i]);
    }
  }
  let bh = 0;
  for (let i = 0; i < b.length; i++) {
    if (isConnected(b[i], b[i - 1])) {
      bh = Math.max(bh, b[i]);
    }
  }
  if (ah > bh) {
    return 1;
  }
  return -1;
}

function compareFlush(a, b) {}

function compareFullHouse(a, b) {}

function compareQuad(a, b) {}

function compareTriplet(a, b) {}

function compareTwoPair(a, b) {}

function comparePair(a, b) {}

function compareHighCard(a, b) {}

export function compareHand(a, b) {
  const af = isFlush(a);
  const bf = isFlush(b);
  const as = isStraight(a);
  const bs = isStraight(b);
  const asf = af && as;
  const bsf = bf && bs;
  if (asf && bsf) {
    return compareStraight(a, b);
  } else if (asf) {
    return 1; // a win
  } else if (bsf) {
    return -1;
  }
  const a4 = isFourOfAKind(a);
  const b4 = isFourOfAKind(b);
  if (a4 && b4) {
    return compareQuad(a, b);
  } else if (a4) {
    return 1;
  } else if (b4) {
    return -1;
  }
  const a32 = isFullHouse(a);
  const b32 = isFullHouse(b);
  if (a32 && b32) {
    return compareFullHouse(a, b);
  } else if (a32) {
    return 1;
  } else if (b32) {
    return -1;
  }
  if (af && bf) {
    return compareFlush(a, b);
  } else if (af) {
    return 1;
  } else if (bf) {
    return -1;
  }
  if (as && bs) {
    return compareStraight(a, b);
  } else if (as) {
    return 1; // a win
  } else if (bs) {
    return -1;
  }
  const a3 = isThreeOfAKind(a);
  const b3 = isThreeOfAKind(b);
  if (a3 && b3) {
    return compareTriplet(a, b);
  } else if (a3) {
    return 1;
  } else if (b3) {
    return -1;
  }
  const a22 = isTwoPair(a);
  const b22 = isTwoPair(b);
  if (a22 && b22) {
    return compareTwoPair(a, b);
  } else if (a22) {
    return 1;
  } else if (b22) {
    return -1;
  }
  const a2 = isPair(a);
  const b2 = isPair(b);
  if (a2 && b2) {
    return comparePair(a, b);
  } else if (a2) {
    return 1;
  } else if (b2) {
    return -1;
  }
  return compareHighCard(a, b);
}
