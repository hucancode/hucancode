---
title: Stone Game (9)
excerpt: Alice and Bob take turns removing stones from a row, aiming to avoid making the sum of the removed stones divisible by 3. If a player removes a stone that results in a sum divisible by 3, they lose. The task is to determine whether Alice wins or Bob wins.
date: 2023-08-28
categories:
  - algorithm
  - greedy
  - game-theory
  - leetcode
---

## Problem

Alice and Bob continue their games with stones. There is a row of $n$ stones, and each stone has an associated value. You are given an integer array $stones$, where $stones_i$ is the value of the $i^{th}$ stone.

Alice and Bob take turns, with Alice starting first. On each turn, the player may remove any stone from $stones$. The player who removes a stone loses if the sum of the values of all removed stones is divisible by $3$. Bob will win automatically if there are no remaining stones (even if it is Alice's turn).

Assuming both players play optimally, return `true` if Alice wins and `false` if Bob wins.

### Example

```
Input: stones = [2,1]
Output: true
Explanation: The game will be played as follows:
- Turn 1: Alice can remove either stone.
- Turn 2: Bob removes the remaining stone.
The sum of the removed stones is 1 + 2 = 3 and is divisible by 3. Therefore, Bob loses and Alice wins the game.
```

```
Input: stones = [2]
Output: false
Explanation: Alice will remove the only stone, and the sum of the values on the removed stones is 2.
Since all the stones are removed and the sum of values is not divisible by 3, Bob wins the game.
```

```
Input: stones = [5,1,2,4,3]
Output: false
Explanation: Bob will always win. One possible way for Bob to win is shown below:
- Turn 1: Alice can remove the second stone with value 1. Sum of removed stones = 1.
- Turn 2: Bob removes the fifth stone with value 3. Sum of removed stones = 1 + 3 = 4.
- Turn 3: Alices removes the fourth stone with value 4. Sum of removed stones = 1 + 3 + 4 = 8.
- Turn 4: Bob removes the third stone with value 2. Sum of removed stones = 1 + 3 + 4 + 2 = 10.
- Turn 5: Alice removes the first stone with value 5. Sum of removed stones = 1 + 3 + 4 + 2 + 5 = 15.
Alice loses the game because the sum of the removed stones (15) is divisible by 3. Bob wins the game.
```

### Constraints

- $1 \leq n \leq 10^5$
- $1 \leq stones_i \leq 10^4$

Submit your solution at [here](https://leetcode.com/problems/stone-game-ix/)

## Solution

### Approach

This take me very long trial and error to arrive at this conclusion:

- We can easily see that the actual value of the stones does not matter much, only it's value in modulo 3 is important. Let $group(i)$ be the number of stones that has value $i$ in modulo 3
- The game entirely depends on the first pick from Alice
  - Alice pick 1, the game would be 1,1,2,1,2,1,2 ...
  - Alice pick 2, the game would be 2,2,1,2,1,2,1,2 ...
  - The game end when 1 person fail to match the pick
  - Pick 0 will result in reverse play (making other person to match his own previous pick)
- If $group(0)$ is even, and $group(1) > 0, group(2) > 0$, Alice can always force a win by picking the group with less number. If $group(1) = 0$ or $group(2) = 0$, Alice will always end up running out of good number to pick and thus losing
- If $group(0)$ is odd, Alice need to pick a group has more than at least 2 number than the other group, otherwise she will always lose

### Complexity

- Time complexity: $O(n)$
- Space complexity: $O(1)$

## Code

```rust
use std::collections::HashMap;
impl Solution {
    pub fn stone_game_ix(stones: Vec<i32>) -> bool {
        let n = stones.len();
        let mut group = vec![0i32;3];
        for x in stones {
            group[(x%3) as usize] += 1;
        }
        if group[0]%2 == 0  {
            group[1] > 0 && group[2] > 0
        } else {
            (group[1] - group[2]).abs() > 2
        }
    }
}
```
