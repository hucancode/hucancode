---
title: Number of Pairs Satisfying Inequality
excerpt: he problem involves two arrays, and an integer diff. The task is to count the number of pairs (i, j) satisfying an inequality.
date: 2023-06-28
categories:
  - algorithm
  - merge-sort
  - leetcode
---

## Problem

You are given two 0-indexed integer arrays $nums1$ and $nums2$, each of size $n$, and an integer $diff$. Find the number of pairs $i, j$ such that:

- $0 \leq i < j \leq n - 1$
- $nums1_i - nums1_j \leq nums2_i - nums2_j + diff$

Return the number of pairs that satisfy the conditions.

### Example

```
Input: nums1 = [3,2,5], nums2 = [2,2,1], diff = 1
Output: 3
Explanation:
There are 3 pairs that satisfy the conditions:
1. i = 0, j = 1: 3 - 2 <= 2 - 2 + 1. Since i < j and 1 <= 1, this pair satisfies the conditions.
2. i = 0, j = 2: 3 - 5 <= 2 - 1 + 1. Since i < j and -2 <= 2, this pair satisfies the conditions.
3. i = 1, j = 2: 2 - 5 <= 2 - 1 + 1. Since i < j and -3 <= 2, this pair satisfies the conditions.
Therefore, we return 3.
```

```
Input: nums1 = [3,-1], nums2 = [-2,2], diff = -1
Output: 0
Explanation:
Since there does not exist any pair that satisfies the conditions, we return 0.``
```

```
Input: s1 = "", s2 = "", s3 = ""
Output: true
```

### Constraints

- $2 \leq n \leq 10^5$
- $-10^4 \leq nums1_i, nums2_i, diff \leq 10^4$

Submit your solution at [here](https://leetcode.com/problems/number-of-pairs-satisfying-inequality/)

## Solution

### Intuition

Let the two given array be $A,B$ the diff is $d$, let's take some observation:
$A_i - A_j \geq B_i - B_j + d \implies A_i - B_i \geq A_j - B_j + d$
Let $delta = A-B$, the problem becomes

> Count the pair $(i,j)$ where $delta_i \geq delta_j + d$ and $0 \leq i < j < n$

### Approach

- Calculate $delta = A-B$
- Merge sort $delta$
  - Each merge operation, we can loop through `left` array and query how many element in the `right` array that satisfy the condition
  - Since `right` array are sorted, we can use binary search and query in $O(log(n))$

### Complexity

- Time complexity: $O(n\times log(n))$
- Space complexity: $O(n)$

### Code

```rust
use std::cmp::Ordering;
const INF: i32 = 1000_000_000;
impl Solution {
    fn merge_sort(nums: &mut Vec<i32>, diff: i32) -> i64 {
        let n = nums.len();
        if n <= 1 {
            return 0;
        }
        let mut ret = 0;
        let mut left = nums.clone();
        let mut right = left.split_off(n/2);
        ret += Self::merge_sort(&mut left, diff);
        ret += Self::merge_sort(&mut right, diff);
        let n = left.len();
        let m = right.len();
        for x in left.iter() {
            let target = x - diff;
            let i = right.binary_search_by(|&y|
                if y >= target {
                    Ordering::Greater
                } else {
                    Ordering::Less
                }
            ).unwrap_err();
            ret += (m-i) as i64;
        }
        nums.clear();
        let mut i = 0;
        let mut j = 0;
        while i < n || j < m {
            let li = left.get(i).unwrap_or(&INF);
            let rj = right.get(j).unwrap_or(&INF);
            if li < rj {
                nums.push(*li);
                i += 1;
            } else {
                nums.push(*rj);
                j += 1;
            }
        }
        return ret;
    }
    pub fn number_of_pairs(nums1: Vec<i32>, nums2: Vec<i32>, diff: i32) -> i64 {
        let n = nums1.len();
        let mut delta: Vec<i32> = (0..n)
            .map(|i| nums1[i] - nums2[i])
            .collect();
        //println!("delta = {nums:?}");
        // now the problem becomes:
        // find all pairs (i,j), where i<j, delta[i] - delta[j] <= diff
        Self::merge_sort(&mut delta, diff)
    }
}
```
