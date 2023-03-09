---
title: How did I optimize my poker simulator to evaluate 1000 hands/second
excerpt: A little bit of preprocessing, bit mask and observation helped me speed up a tricky computation
date: 2023-02-21
categories:
  - algorithm
  - bitmask
  - poker
  - combinatorics
---
## Motivation

## Initial strategy
### Hand evaluation

1. Check if the hand contains Straight Flush. Return if matched
2. Check if the hand contains Four of a Kind. Return if matched
3. Check if the hand contains Full House. Return if matched
4. Check if the hand contains Flush. Return if matched
5. Check if the hand contains Straight. Return if matched
6. Check if the hand contains Three of a Kind. Return if matched
7. Check if the hand contains Two Pairs. Return if matched
8. Check if the hand contains Pair. Return if matched
9. This is a High Card hand

### Hand comparision

`Compare High Card` algorithm

1. Iterate all cards from high rank to low rank.
Who has high rank card wins.
2. If both hand have the same ranks. The hands are tie.

`Compare 5` algorithm

1. If a hand matched higher pattern, that hand wins. 
For example Full House beats Flush, Three of a Kind beats Two Pair.
2. If both matched Straight Flush, or Four of a Kind, or Flush, or Straight. Do `Compare High Card`
3. If both matched Full House. 
Who has bigger triplet wins, if both triplets are equal, bigger pair wins.
If both triplets and pairs have the same rank. The hands are tie.
4. If both matched Three of a Kind, who has higher rank triplet wins.
If both triplets are equal. Do `Compare High Card`
5. If both matched Two Pairs, who has higher rank pair wins.
If both pairs have the same rank. Do `Compare High Card`
6. If both matched Pair, who has higher rank pair wins.
If both pairs have the same rank. Do `Compare High Card`
7. Do `Compare High Card`

`Compare 7` algorithm

1. Take 2 hero cards, 5 community cards, 2 opponent cards
2. Both Opponent and Hero has 7 cards, generate all combination 5 of 7 for both players.
We have 21 possibility in total for each.
4. Compare each of Hero's 5 cards combination using `Compare 5` algorithm.
Take the strongest hand.
Do the same with Opponent.
5. Compare Hero's strongest hand with Opponent's strongest hand

## Optimization - Precompute special hand patterns

## Optimization - Sort special hand patterns

## Optimization - Match 7 card sets with patterns directly

