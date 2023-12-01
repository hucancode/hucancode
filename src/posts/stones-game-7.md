---
title: Stone Game (7)
excerpt: Alice and Bob take turns removing stones from either end of a row. Each player gains points equal to the sum of the remaining stones after their turn. Bob aims to minimize the score difference, while Alice aims to maximize it. The task is to determine the maximum difference between Alice and Bob
date: 2023-08-30
categories:
  - algorithm
  - dynamic-programming
  - game-theory
  - leetcode
---

## Problem

Alice and Bob take turns playing a game, with Alice starting first.

There are $n$ stones arranged in a row. On each player's turn, they can remove either the leftmost stone or the rightmost stone from the row and receive points equal to the sum of the remaining stones' values in the row. The winner is the one with the higher score when there are no stones left to remove.

Bob found that he will always lose this game (poor Bob, he always loses), so he decided to minimize the score's difference. Alice's goal is to maximize the difference in the score.

Given an array of integers $stones$ where $stones_i$ represents the value of the $i^{th}$ stone from the left, return the difference in Alice and Bob's score if they both play optimally.

### Example

```
Input: stones = [5,3,1,4,2]
Output: 6
Explanation:
- Alice removes 2 and gets 5 + 3 + 1 + 4 = 13 points. Alice = 13, Bob = 0, stones = [5,3,1,4].
- Bob removes 5 and gets 3 + 1 + 4 = 8 points. Alice = 13, Bob = 8, stones = [3,1,4].
- Alice removes 3 and gets 1 + 4 = 5 points. Alice = 18, Bob = 8, stones = [1,4].
- Bob removes 1 and gets 4 points. Alice = 18, Bob = 12, stones = [4].
- Alice removes 4 and gets 0 points. Alice = 18, Bob = 12, stones = [].
The score difference is 18 - 12 = 6.
```

```
Input: stones = [7,90,5,1,100,10,10,2]
Output: 122
```

### Constraints

- $2 \leq n \leq 1000$
- $1 \leq stones_i \leq 1000$

Submit your solution at [here](https://leetcode.com/problems/stone-game-vii/)

## Solution

### Observation

- Given nature of the game, Alice will always has bigger score than Bob
- Alice wants to maximize the difference, the optimal strategy would be maximize her score
- Thus Bob has to maximize his score to keep up. So both players would want to maximize their score, and we do not have to keep track of turn

### Approach

- Pre calculate a prefix sum, so we can query $sum(i,j)$ in $O(1)$
- Let $f(i,j)$ be the maximum difference could be archived if we play game with only $stones[i,j]$. $f(i,j) = max(x, y)$, where:
  - $x$ be the score if we discard $stone[i]$, $x = sum(i+1,j) - f(i+1,j)$
  - $y$ be the score if we discard $stone[j]$, $y = sum(i,j-1) - f(i,j-1)$

### Complexity

- Time complexity: $O(n^2)$
- Space complexity: $O(n^2)$

## Code

```rust
use std::cmp::max;
impl Solution {
    pub fn stone_game_vii(stones: Vec<i32>) -> i32 {
        let n = stones.len();
        let mut prefix = vec![0;n+1];
        for i in 1..=n {
            prefix[i] = prefix[i-1] + stones[i-1];
        }
        let mut f = vec![vec![0;n];n];
        for len in 2..=n {
            for i in 0..n-1 {
                let mut j = i+len-1;
                if j >= n {
                    continue;
                }
                let sum_i = prefix[j+1] - prefix[i+1];
                let sum_j = prefix[j] - prefix[i];
                let discard_i = sum_i - f[i+1][j];
                let discard_j = sum_j - f[i][j-1];
                f[i][j] = max(discard_i, discard_j);
                //println!("calculate state {i}~{j}");
                //println!("discard {i} -> {discard_i}, discard {j} -> {discard_j}");
                //println!("f[{i}][{j}] = {}", f[i][j]);
            }
        }
        //println!("{f:?}");
        return f[0][n-1];
    }
}
```
