---
title: Burst Balloons
excerpt: The task involves bursting balloons marked with numbers represented by an array. Each burst earns coins based on the product of adjacent balloon numbers. The goal is to maximize number of coins obtainable by bursting the balloons strategically.
date: 2023-09-01
categories:
  - algorithm
  - dynamic-programming
  - leetcode
---

## Problem

You are given $n$ balloons, indexed from $0$ to $n - 1$. Each balloon is painted with a number on it represented by an array $nums$. You are asked to burst all the balloons.

If you burst the $i^{th}$ balloon, you will get $nums_{i - 1} \times nums_i \times nums_{i + 1}$ coins. If $i - 1$ or $i + 1$ goes out of bounds of the array, then treat it as if there is a balloon with a $1$ painted on it.

Return the maximum coins you can collect by bursting the balloons wisely.

### Example

```
Input: nums = [3,1,5,8]
Output: 167
Explanation:
nums = [3,1,5,8] --> [3,5,8] --> [3,8] --> [8] --> []
coins =  3*1*5    +   3*5*8   +  1*3*8  + 1*8*1 = 167
```

```
Input: nums = [1,5]
Output: 10
```

### Constraints

- $1 \leq n \leq 300$
- $0 \leq nums_i \leq 100$

Submit your solution at [here](https://leetcode.com/problems/burst-balloons/)

## Solution

### Approach

- Let $f(i,j)$ be the maximum score if we only play within the range $[i,j]$
- Let $g(i,j,x)$ be the maximum score if we only play within the range $[i,j]$ and we pop balloon $x$ last
- We will calculate $f$ and $g$ recursively :
  - $g(i,j,x) = (num_x \times nums_{i-1} \times nums_{j+1}) + f(i,x-1) + f(x+1,j)$
  - $f(i,j) = max(g(i,j,x))$
- The answer is $f(0,n-1)$

### Complexity

- Time complexity: $O(n^3)$
- Space complexity: $O(n^2)$

## Code

```rust
use std::cmp::max;
impl Solution {
    pub fn max_coins(nums: Vec<i32>) -> i32 {
        let n = nums.len();
        let mut f = vec![vec![0;n];n];
        // f(i,j) = if we only play in the range [i,j], what is the maximum score?
        for len in 0..n {
            for i in 0..n-len {
                let j = i+len;
                for x in i..=j {
                    // in the range [i,j], if we burst balloon x last, what is the maximum score?
                    let mut score = nums[x];
                    if i > 0 {
                        score *= nums[i-1];
                    }
                    if j < n-1 {
                        score *= nums[j+1];
                    }
                    if x > i {
                        score += f[i][x-1];
                    }
                    if x < j {
                        score += f[x+1][j];
                    }
                    f[i][j] = max(f[i][j], score);
                }
            }
        }
        return f[0][n-1];
    }
}
```
