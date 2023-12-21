---
title: Detonate The Maximum Bombs
excerpt: The task involves determining the maximum number of bombs that can be detonated by choosing to detonate only one bomb. Bomb triggers a chain reaction when detonated, potentially setting off more bombs within its range.
date: 2023-06-02
categories:
  - algorithm
  - breadth-first-search
  - depth-first-search
  - leetcode
---

## Problem

You are given a list of bombs. The range of a bomb is defined as the area where its effect can be felt. This area is in the shape of a circle with the center as the location of the bomb.

The bombs are represented by a 0-indexed 2D integer array bombs where $bombs_i = [x_i, y_i, r_i]$. $x_i$ and $y_i$ denote the X-coordinate and Y-coordinate of the location of the $i^{th}$ bomb, whereas $r_i$ denotes the radius of its range.

You may choose to detonate a single bomb. When a bomb is detonated, it will detonate all bombs that lie in its range. These bombs will further detonate the bombs that lie in their ranges.

Given the list of bombs, _return the maximum number of bombs that can be detonated if you are allowed to detonate only one bomb_

### Example

![example 1](https://assets.leetcode.com/uploads/2021/11/06/desmos-eg-3.png)

```
Input: bombs = [[2,1,3],[6,1,4]]
Output: 2
Explanation:
The above figure shows the positions and ranges of the 2 bombs.
If we detonate the left bomb, the right bomb will not be affected.
But if we detonate the right bomb, both bombs will be detonated.
So the maximum bombs that can be detonated is max(1, 2) = 2.
```

![example 2](https://assets.leetcode.com/uploads/2021/11/06/desmos-eg-2.png)

```
Input: bombs = [[1,1,5],[10,10,5]]
Output: 1
Explanation:
Detonating either bomb will not detonate the other bomb, so the maximum number of bombs that can be detonated is 1.
```

![example 3](https://assets.leetcode.com/uploads/2021/11/07/desmos-eg1.png)

```
Input: bombs = [[1,2,3],[2,3,1],[3,4,2],[4,5,3],[5,6,4]]
Output: 5
Explanation:
The best bomb to detonate is bomb 0 because:
- Bomb 0 detonates bombs 1 and 2. The red circle denotes the range of bomb 0.
- Bomb 2 detonates bomb 3. The blue circle denotes the range of bomb 2.
- Bomb 3 detonates bomb 4. The green circle denotes the range of bomb 3.
Thus all 5 bombs are detonated.
```

### Constraints

- `bombs[i].length = 3`
- $1 \leq bombs.length \leq 100$
- $1 \leq x_i, y_i, r_i \leq 10^5$

Submit your solution at [here](https://leetcode.com/problems/detonate-the-maximum-bombs/)

## Solution

### Approach

Start at each bomb, BFS/DFS to see how many bomb it can detonate

### Complexity

- Time complexity: $O(n^2)$
- Space complexity: $O(n)$

### Code

BFS

```rust
use std::cmp::max;
use std::collections::VecDeque;
impl Solution {
    pub fn maximum_detonation(bombs: Vec<Vec<i32>>) -> i32 {
        let n = bombs.len();
        let mut ret = 1;
        for i in 0..n {
            let mut vis = vec![false;n];
            let mut q = VecDeque::new();
            q.push_back(i);
            while let Some(i) = q.pop_front() {
                if vis[i] {
                    continue;
                }
                vis[i] = true;
                let xa = bombs[i][0] as f64;
                let ya = bombs[i][1] as f64;
                let ra = bombs[i][2] as f64;
                let candidates = (0..n)
                    .filter(|&j| !vis[j])
                    .filter(|&j| {
                        let xb = bombs[j][0] as f64;
                        let yb = bombs[j][1] as f64;
                        let dx = xa-xb;
                        let dy = ya-yb;
                        dx*dx+dy*dy <= ra*ra
                    });
                q.extend(candidates);
            }
            ret = max(ret, vis.into_iter()
                .filter(|&v| v)
                .count() as i32);
        }
        ret
    }
}
```

Replace queue with stack, we have DFS

```rust
use std::cmp::max;
impl Solution {
    pub fn maximum_detonation(bombs: Vec<Vec<i32>>) -> i32 {
        let n = bombs.len();
        let mut ret = 1;
        for i in 0..n {
            let mut vis = vec![false;n];
            let mut q = Vec::new();
            q.push(i);
            while let Some(i) = q.pop() {
                if vis[i] {
                    continue;
                }
                vis[i] = true;
                let xa = bombs[i][0] as f64;
                let ya = bombs[i][1] as f64;
                let ra = bombs[i][2] as f64;
                let candidates = (0..n)
                    .filter(|&j| !vis[j])
                    .filter(|&j| {
                        let xb = bombs[j][0] as f64;
                        let yb = bombs[j][1] as f64;
                        let dx = xa-xb;
                        let dy = ya-yb;
                        dx*dx+dy*dy <= ra*ra
                    });
                q.extend(candidates);
            }
            ret = max(ret, vis.into_iter()
                .filter(|&v| v)
                .count() as i32);
        }
        ret
    }
}
```
