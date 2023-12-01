---
title: Profitable Schemes
excerpt: The problem involves finding the count of profitable schemes within a group of members committing crimes. The goal is to determine the number of combinations of crimes that yield a maximum profit.
date: 2023-09-25
categories:
  - algorithm
  - dynamic-programming
  - leetcode
---

## Problem

There is a group of $n$ members, and a list of various crimes they could commit. The $i^{th}$ crime generates a $profit_i$ and requires $group_i$ members to participate in it. If a member participates in one crime, that member can't participate in another crime.

Let's call a profitable scheme any subset of these crimes that generates at least $p$ profit, and the total number of members participating in that subset of crimes is at most $n$.

Return the number of schemes that can be chosen. Since the answer may be very large, return it modulo $10^9 + 7$.

### Example

```
Input: n = 5, p = 3, group = [2,2], profit = [2,3]
Output: 2
Explanation: To make a profit of at least 3, the group could either commit crimes 0 and 1, or just crime 1.
In total, there are 2 schemes.
```

```
Input: n = 10, p = 5, group = [2,3,5], profit = [6,7,8]
Output: 7
Explanation: To make a profit of at least 5, the group could commit any crimes, as long as they commit one.
There are 7 possible schemes: (0), (1), (2), (0,1), (0,2), (1,2), and (0,1,2).
```

### Constraints

- $1 \leq n \leq 100$
- $0 \leq m \leq 100$
- $1 \leq group.length \leq 100$
- $1 \leq group_i \leq 100$
- $1 \leq profit_i \leq 100$
- $profit.length = group.length$

Submit your solution at [here](https://leetcode.com/problems/profitable-schemes/)

## Solution

### Approach

- Let $f(n,p,c)$ denotes number of ways to use exact $n$ men, to generate exact $p$ profit, with first $c$ crimes (we don't have to use all $c$ crimes)
- By definition $f(0,0,0) = 1$ There are $1$ way to do nothing and gain nothing
- If we commit crime $c$, we need to use $group(c)$ men and we gain $profit(c)$ money
- Recursively we have $f(n,p,c) = f(n,p,c-1) + f(n-group(c),p-profit(c),c-1)$

### Complexity

- Time complexity: $O(n \times m^2 \times k)$
- Space complexity: $O(n \times m^2 \times k)$
- Where $n$ is men count, $m$ is crimes count, and $k$ is average profit

## Code

```rust
impl Solution {
    pub fn profitable_schemes(n: i32, min_profit: i32, group: Vec<i32>, profit: Vec<i32>) -> i32 {
        let INF = 1000_000_007;
        let n = n as usize;
        let p0 = min_profit as usize;
        let p = profit.iter().sum::<i32>() as usize;
        let c = group.len();
        let mut f = vec![vec![vec![0;c+1];p+1];n+1];
        // f(n, p, c), how many ways to use team exact n men, to generate exact p profit, using first c crimes
        f[0][0][0] = 1;
        for i in 0..=n {
            for j in 0..=p {
                for k in 0..c {
                    if(f[i][j][k] == 0) {
                        continue;
                    }
                    f[i][j][k+1] += f[i][j][k];
                    f[i][j][k+1] %= INF;
                    let men = i+group[k] as usize;
                    if men > n {
                        continue;
                    }
                    let gain = j+profit[k] as usize;
                    f[men][gain][k+1] += f[i][j][k];
                    f[men][gain][k+1] %= INF;
                }
            }
        }
        let mut ret = 0;
        for i in 0..=n {
            for j in p0..=p {
                ret += f[i][j][c];
                ret %= INF;
            }
        }
        //println!("{f:?}");
        return ret;
    }
}
```
