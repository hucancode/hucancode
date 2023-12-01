---
title: Interleaving String
excerpt: The problem involves determining if a string can be formed by interleaving 2 smaller strings
date: 2023-08-25
categories:
  - algorithm
  - dynamic-programming
  - leetcode
---

## Problem

Given strings $s1$, $s2$, and $s3$, find whether $s3$ is formed by an interleaving of $s1$ and $s2$.

An interleaving of two strings $s$ and $t$ is a configuration where $s$ and $t$ are divided into $n$ and $m$ substrings respectively, such that:

- $s = s_1 + s_2 + ... + s_n$
- $t = t_1 + t_2 + ... + t_m$
- $|n - m| \leq 1$
- The interleaving is either
  - $s_1 + t_1 + s_2 + t_2 + s_3 + t_3 + ...$
  - $t_1 + s_1 + t_2 + s_2 + t_3 + s_3 + ...$

Note: $a + b$ is the concatenation of strings $a$ and $b$

### Example

![interleave example](https://assets.leetcode.com/uploads/2020/09/02/interleave.jpg)

```
Input: s1 = "aabcc", s2 = "dbbca", s3 = "aadbbcbcac"
Output: true
Explanation: One way to obtain s3 is:
Split s1 into s1 = "aa" + "bc" + "c", and s2 into s2 = "dbbc" + "a".
Interleaving the two splits, we get "aa" + "dbbc" + "bc" + "a" + "c" = "aadbbcbcac".
Since s3 can be obtained by interleaving s1 and s2, we return true.
```

```
Input: s1 = "aabcc", s2 = "dbbca", s3 = "aadbbbaccc"
Output: false
Explanation: Notice how it is impossible to interleave s2 with any other string to obtain s3.
```

```
Input: s1 = "", s2 = "", s3 = ""
Output: true
```

### Constraints

- $0 \leq s1.length,s2.length \leq 100$
- $0 \leq s3.length \leq 200$

Submit your solution at [here](https://leetcode.com/problems/interleaving-string/)

## Solution

### Approach

- We use an array $f$, where $f(i,j)$ denotes if we can use $s1[0,i]$ and $s2[0,j]$ to form a valid string
  - By that definition, we have, $f(0,0) = true$, use 0 char from s1, 0 char from s2, we can form an empty string
- Calculate $f(i,j)$, we have 2 posibility
  - If we use $s1[i]$ to form $s3$, $f(i,j) = f(i-1,j)$
  - If we use $s2[j]$ to form $s3$, $f(i,j) = f(i,j-1)$

### Complexity

- Time complexity: $O(n\times m)$
- Space complexity: $O(n\times m)$, with a little optimization, we can have $O(m)$

### Code

$O(mn)$ space

```rust
impl Solution {
    pub fn is_interleave(s1: String, s2: String, s3: String) -> bool {
        let s1 = s1.as_bytes();
        let s2 = s2.as_bytes();
        let s3 = s3.as_bytes();
        let n = s1.len();
        let m = s2.len();
        let nm = s3.len();
        if n+m != nm {
            return false;
        }
        let mut f = vec![vec![false;m+1];n+1];
        for i in 0..=n {
            for j in 0..=m {
                f[i][j] = (i == 0 && j == 0) ||
                    (i > 0 && f[i-1][j] && s1[i-1] == s3[i+j-1]) ||
                    (j > 0 && f[i][j-1] && s2[j-1] == s3[i+j-1]);
            }
        }
        return f[n][m];
    }
}
```

$O(m)$ space

```rust
impl Solution {
    pub fn is_interleave(s1: String, s2: String, s3: String) -> bool {
        let s1 = s1.as_bytes();
        let s2 = s2.as_bytes();
        let s3 = s3.as_bytes();
        let n = s1.len();
        let m = s2.len();
        let nm = s3.len();
        if n+m != nm {
            return false;
        }
        let mut f = vec![false;m+1];
        for i in 0..=n {
            for j in 0..=m {
                f[j] = (i == 0 && j == 0) ||
                    (i > 0 && f[j] && s1[i-1] == s3[i+j-1]) ||
                    (j > 0 && f[j-1] && s2[j-1] == s3[i+j-1]);
            }
        }
        return f[m];
    }
}
```
