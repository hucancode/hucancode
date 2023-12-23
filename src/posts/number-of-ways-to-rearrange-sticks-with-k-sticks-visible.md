---
title: Number of Ways to Rearrange Sticks With K Sticks Visible
excerpt: The task is to find the number of ways to arrange a set of uniquely-sized sticks so that exactly k sticks are visible from the left
date: 2023-12-21
categories:
  - algorithm
  - dynamic-programming
  - leetcode
---

## Problem

There are $n$ uniquely-sized sticks whose lengths are integers from $1$ to $n$. You want to arrange the sticks such that exactly $k$ sticks are visible from the left. A stick is visible from the left if there are no longer sticks to the left of it.

    For example, if the sticks are arranged [1,3,2,5,4], then the sticks with lengths 1, 3, and 5 are visible from the left.

Given $n$ and $k$, return the number of such arrangements. Since the answer may be large, return it modulo $10^9 + 7$

### Example

```
Input: n = 3, k = 2
Output: 3
Explanation: [1,3,2], [2,3,1], and [2,1,3] are the only arrangements such that exactly 2 sticks are visible.
The visible sticks are underlined.
```

```
Input: n = 5, k = 5
Output: 1
Explanation: [1,2,3,4,5] is the only arrangement such that all 5 sticks are visible.
The visible sticks are underlined.
```

```
Input: n = 20, k = 11
Output: 647427950
Explanation: There are 647427950 (mod 109 + 7) ways to rearrange the sticks such that exactly 11 sticks are visible.
```

### Constraints

- $1 \leq n \leq 1000$
- $1 \leq k \leq 1000$

Submit your solution at [here](https://leetcode.com/problems/number-of-ways-to-rearrange-sticks-with-k-sticks-visible/)

## Solution

### Intuition

Let's say we have used up $n$ sticks labels $a-1,a-2,...,a-(n-1)$, and we have another stick length $a-n$ which is smaller than all previous sticks, how can we go from here:

- From $n-1,k-1$ configuration, there is only 1 way can make $n,k$ configuration. That is put the new stick on the front
- From $n-1,k$ configuration, there are $n-1$ ways to put the new stick behind and keep the number of visible sticks the same

### Approach

Let $f(n,k)$ denotes the number of ways to arrange $n$ sticks and only show $k$ sticks:

- By that definition, $f(0,0) = 1$, there is 1 way to use nothing and show nothing
- $f(n,k) = f(n-1,k-1) + (n-1) \times f(n-1,k)$

### Complexity

- Time complexity: $O(n\times k)$
- Space complexity: $O(n\times k)$, could be further optimized to $O(k)$ if necessary

### Code

```rust
impl Solution {
    pub fn rearrange_sticks(n: i32, k: i32) -> i32 {
        let n = n as usize;
        let k = k as usize;
        let INF = 1000_000_007;
        let mut f = vec![vec![0i64; k+1]; n+1];
        // f[i][j] = how many ways to use i stick, and need to make j stick visible
        f[0][0] = 1;
        for j in 1..=k {
            for i in j..=n {
                // put first
                f[i][j] += f[i-1][j-1];
                // put back
                f[i][j] += f[i-1][j]*(i as i64 - 1);
                f[i][j] %= INF;
            }
        }
        return f[n][k] as i32;
    }
}
```
