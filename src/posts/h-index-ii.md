---
title: H-Index (2)
excerpt: The task involves finding the researcher's h-index from a sorted array of citations. The h-index represents the maximum value 'h' where the researcher has published at least 'h' papers, each cited at least 'h' times.
date: 2023-06-16
categories:
  - algorithm
  - binary-search
  - leetcode
---

## Problem

Given an array of integers $citations$ where $citations_i$ is the number of citations a researcher received for their $i^{th}$ paper and $citations$ is sorted in ascending order, return the researcher's h-index.

According to the definition of [h-index](https://en.wikipedia.org/wiki/H-index) on Wikipedia: The h-index is defined as the maximum value of $h$ such that the given researcher has published at least $h$ papers that have each been cited at least $h$ times.

You must write an algorithm that runs in logarithmic time.

### Example

```
Input: citations = [0,1,3,5,6]
Output: 3
Explanation: [0,1,3,5,6] means the researcher has 5 papers in total and each of them had received 0, 1, 3, 5, 6 citations respectively.
Since the researcher has 3 papers with at least 3 citations each and the remaining two with no more than 3 citations each, their h-index is 3.
```

```
Input: citations = [1,2,100]
Output: 2
```

### Constraints

- $1 \leq n \leq 10^5$
- $0 \leq citations_i \leq 1000$
- $citations$ is sorted in ascending order

Submit your solution at [here](https://leetcode.com/problems/h-index-ii/)

## Solution

### Approach

Since $n = 10^5$, an $O(n)$ solution will also AC. But we can do better than that using the following approach. Binary search to find the best match:

- if we get good result, we cut off the right range
- if we get bad result, we cut off the left range

### Complexity

- Time complexity: $O(log(n))$
- Space complexity: $O(1)$

### Code

```rust
impl Solution {
    pub fn h_index(citations: Vec<i32>) -> i32 {
        let n = citations.len();
        let mut l = 0;
        let mut r = n;
        while l < r {
            let m = (l+r)/2;
            let good = citations[m] >= (n - m) as i32;
            if good {
                r = m;
            } else {
                l = m+1;
            }
        }
        (n-r) as i32
    }
}
```

### Benchmark vs full search O(n)

| n   | Full search  | Binary search | Improvement |
| --- | ------------ | ------------- | ----------- |
| 1e6 | 210.309µs    | 191ns         | 1011x       |
| 1e7 | 2.334838ms   | 291ns         | 8023x       |
| 1e8 | 22.172338ms  | 461ns         | 48096x      |
| 1e9 | 225.415796ms | 1.323µs       | 170382x     |

The code used

```rust
use rand::{thread_rng, Rng};
use std::time::Instant;

fn h_index_ologn(citations: &Vec<i32>) -> i32 {
    let n = citations.len();
    let mut l = 0;
    let mut r = n;
    while l < r {
        let m = (l+r)/2;
        let good = citations[m] >= (n - m) as i32;
        if good {
            r = m;
        } else {
            l = m+1;
        }
    }
    (n-r) as i32
}

fn h_index_on(citations: &Vec<i32>) -> i32 {
    let n = citations.len();
    let mut ret = 0;
    for i in 0..n {
        let k = citations[n-1-i];
        if k-1 < i as i32 {
            break;
        }
        ret = i+1;
    }
    ret as i32
}

fn main() {
    let n = 1_000_000;
    let mut input: Vec<i32> = (0..n)
        .map(|_| thread_rng().gen_range(0..n))
        .collect();
    input.sort();
    let start = Instant::now();
    let result = h_index_on(&input);
    let base = start.elapsed();
    println!("on -> {result}, take {:?}", base);
    let start = Instant::now();
    let result = h_index_ologn(&input);
    let t = start.elapsed();
    let improve = base.as_secs_f64()/t.as_secs_f64();
    println!("ologn -> {result}, take {:?} {improve:?}x better", t);
}
```
