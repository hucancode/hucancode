---
title: Ten days of statistics (4) - Combinatorics
excerpt: Let's learn basic statistics in 10 days
cover: /blog/post/statistics-10/5031659.jpg
date: 2023-02-15
categories:
  - combinatorics
  - statistics
  - math
---

## Permutations

A permutation is an **ordered** arrangement of $r$ objects from a set of $n$ items ($0< r \leq n$)

$$
_nP_r = \frac{n!}{(n-r)!}
$$

**Note**: We define $0! = 1$

## Combinations

A combination is an **unordered** arrangement of $r$ objects from a set of $n$ items ($0< r \leq n$)
Intuitively we can calculate combination from permutation

$$

_nC_r = \frac{_nP_r}{r!} = \frac{n!}{r! \times (n-r)!}
$$

## Example of permutation and combination

- A school need to pick 11 players to form a team out of 100 candidates.
  This is a combination, there are $C \binom{100}{11}$ ways to form the team
- A contest has 100 contestants and 3 medals (gold, silver, bronze) for 3 best performers.
  This is a permutation, there are $P \binom{100}{3}$ ways for the contest to end
