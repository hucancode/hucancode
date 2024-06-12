---
title: Minimum Time to Remove All Cars Containing Illegal Goods
excerpt: In this problem, cars are arranged in a sequence, with some containing legal goods and others containing illegal goods. The goal is to find the minimum time required to remove all cars containing illegal goods
date: 2024-04-03
categories:
  - algorithm
  - dynamic-programming
  - leetcode
---

## Problem

You are given a 0-indexed binary string $s$ which represents a sequence of train cars. $s_i = 0$ denotes that the $i^{th}$ car does not contain illegal goods and $s_i = 1$ denotes that the $i^{th}$ car does contain illegal goods.

As the train conductor, you would like to get rid of all the cars containing illegal goods. You can do any of the following three operations any number of times:

1. Remove a train car from the left end (i.e., remove $s_0$) which takes $1$ unit of time.
2. Remove a train car from the right end (i.e., remove $s_{n-1}$) which takes $1$ unit of time.
3. Remove a train car from anywhere in the sequence which takes $2$ units of time.

Return the **minimum** time to remove all the cars containing illegal goods.

_Note that an empty sequence of cars is considered to have no cars containing illegal goods._

### Example

```
Input: s = "1100101"
Output: 5
Explanation:
One way to remove all the cars containing illegal goods from the sequence is to
- remove a car from the left end 2 times. Time taken is 2 * 1 = 2.
- remove a car from the right end. Time taken is 1.
- remove the car containing illegal goods found in the middle. Time taken is 2.
This obtains a total time of 2 + 1 + 2 = 5.

An alternative way is to
- remove a car from the left end 2 times. Time taken is 2 * 1 = 2.
- remove a car from the right end 3 times. Time taken is 3 * 1 = 3.
This also obtains a total time of 2 + 3 = 5.

5 is the minimum time taken to remove all the cars containing illegal goods.
There are no other ways to remove them with less time.
```

```
Input: s = "0010"
Output: 2
Explanation:
One way to remove all the cars containing illegal goods from the sequence is to
- remove a car from the left end 3 times. Time taken is 3 * 1 = 3.
This obtains a total time of 3.

Another way to remove all the cars containing illegal goods from the sequence is to
- remove the car containing illegal goods found in the middle. Time taken is 2.
This obtains a total time of 2.

Another way to remove all the cars containing illegal goods from the sequence is to
- remove a car from the right end 2 times. Time taken is 2 * 1 = 2.
This obtains a total time of 2.

2 is the minimum time taken to remove all the cars containing illegal goods.
There are no other ways to remove them with less time.
```

### Constraints

- $1 \leq n \leq 2 \times 10^5$
- $s_i$ is either $0$ or $1$

Submit your solution at [here](https://leetcode.com/problems/minimum-time-to-remove-all-cars-containing-illegal-goods/)

## Solution

### Intuition

- We split the train into 3 parts. Left & Mid & Right
- We apply operation 1 on Left, operation 3 on Mid, and operation 2 on Right
- That naive split will have us ended up with $O(n^2)$ solution, which is unfeasible with $n = 10^5$
- We will optimize further by split the train into 2 parts. Left and Right. We apply operation 1 or 3 on Left, operation 2 on Right

### Approach

- Let $f(1,i)$ is the cost to use operation 1 at position i to clear all car in the range $[0,i]$. By that definition $f(1,i) = i+1$ since we have to eleminate everything came before i to be able to use operation 1.
- Let $f(2,i)$ is the cost to use operation 2 at position i to clear all car in the range $(i, n)$. By that definition $f(2,i) = n-i-1$
- Let $f(3,i)$ is the cost to use operation 3 at position i to clear all _illegal_ car in the range $[0,i]$.
- Let's say we are at car $i$ and up until car $i-1$ we know the cost to clear all _illegal_ car using method 1 is $f(1,i-1)$ and using method 3 is $f(3, i-1)$ then $f(3,i) = min(f(1,i-1), f(3,i-1))$
- Loop through all middle position $i$ and calculate the cost if we were to split the train at $i$. We use operation 1 and 3 on the left part and operation 2 on the right part.

### Complexity

- Time complexity: $O(n)$
- Space complexity: $O(n)$, but can be optimized to $O(1)$

### Code

```rust
impl Solution {
    pub fn minimum_time(s: String) -> i32 {
        use std::cmp::min;
        let n = s.len();
        let mut f = vec![vec![0;n+1];4];
        // f(1,i) = cost to use operation 1 at i~n
        // f(2,i) = cost to use operation 2 at 0~i
        // f(3,i) = min cost to use operation 3 at 0~i
        let mut ret = n;
        for (i,c) in s.chars().enumerate() {
            f[2][i+1] = n-i-1;
            if c == '1' {
                f[3][i+1] = min(f[1][i], f[3][i]) + 2;
                f[1][i+1] = i+1;
            } else {
                f[3][i+1] = f[3][i];
                f[1][i+1] = f[1][i];
            }
            ret = min(ret, min(f[1][i+1], f[3][i+1]) + f[2][i+1]);
        }
        ret as i32
    }
}
```

$O(1)$ space solution

```rust
impl Solution {
    pub fn minimum_time(s: String) -> i32 {
        use std::cmp::min;
        let n = s.len();
        let mut pick_mid = 0;
        let mut clear_left = 0;
        let mut ret = n;
        for (i,c) in s.chars().enumerate() {
            let clear_right = n-i-1;
            if c == '1' {
                pick_mid = min(clear_left, pick_mid) + 2;
                clear_left = i+1;
            }
            ret = min(ret, min(pick_mid, clear_left) + clear_right);
        }
        ret as i32
    }
}
```

Bonus, Go implementation

```go
func minimumTime(s string) int {
    n := len(s)
    pick_mid := 0
    clear_left := 0
    ret := n
    for i,c := range s {
        clear_right := n-i-1
        if c == '1' {
            pick_mid = min(clear_left, pick_mid) + 2
            clear_left = i+1
        }
        ret = min(ret, min(pick_mid, clear_left) + clear_right)
    }
    return ret
}
```
