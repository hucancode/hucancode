---
title: Find K Pairs with Smallest Sums
excerpt: The goal is to find the k pairs formed by choosing one element from each array. These pairs have the smallest sums among all possible combinations of elements from both arrays.
date: 2023-06-27
categories:
  - algorithm
  - greedy
  - leetcode
---

## Problem

You are given two integer arrays $nums1$ and $nums2$ sorted in non-decreasing order and an integer $k$.

Define a pair $u, v$ which consists of one element from the first array and one element from the second array.

Return the $k$ pairs $(u_1, v_1), (u_2, v_2), ..., (u_k, v_k)$ with the smallest sums.

### Example

```
Input: nums1 = [1,7,11], nums2 = [2,4,6], k = 3
Output: [[1,2],[1,4],[1,6]]
Explanation: The first 3 pairs are returned from the sequence: [1,2],[1,4],[1,6],[7,2],[7,4],[11,2],[7,6],[11,4],[11,6]
```

```
Input: nums1 = [1,1,2], nums2 = [1,2,3], k = 2
Output: [[1,1],[1,1]]
Explanation: The first 2 pairs are returned from the sequence: [1,1],[1,1],[1,2],[2,1],[1,2],[2,2],[1,3],[1,3],[2,3]
```

```
Input: nums1 = [1,2], nums2 = [3], k = 3
Output: [[1,3],[2,3]]
Explanation: All possible pairs are returned from the sequence: [1,3],[2,3]

```

### Constraints

- $1 \leq nums1.length, nums2.length \leq 10^5$
- $-10^9 \leq nums1_i, nums2_i \leq 10^9$
- $1 \leq k \leq 10^4$
- $nums1$ and $nums2$ both are sorted in non-decreasing order

Submit your solution at [here](https://leetcode.com/problems/find-k-pairs-with-smallest-sums/)

## Solution

### Intuition

At first I tried to use 2 pointers, but failed to do so. Then I thought about priority queue

### Approach

- Use a priority queue to manage a list of candidates
- Init the queue with element $(0,0)$
- Pop the queue to get the lowest element. Let that element is $(i,j)$ we will push element $(i+1, j)$ and element $(i, j+1)$ to the queue and continue to the next iteration

### Complexity

- Time complexity: $O(k\times log(k))$
- Space complexity: $O(k)$

### Code

```rust
use std::collections::BinaryHeap;
use std::collections::HashSet;
use std::cmp::Reverse;
impl Solution {
    pub fn k_smallest_pairs(nums1: Vec<i32>, nums2: Vec<i32>, k: i32) -> Vec<Vec<i32>> {
        let n = nums1.len();
        let m = nums2.len();
        let mut q = BinaryHeap::new();
        let mut vis = HashSet::new();
        let i = 0;
        let j = 0;
        let x = Reverse(nums1[i]+nums2[j]);
        q.push((x,i,j));
        while let Some((Reverse(x), i, j)) = q.pop() {
            if vis.contains(&(i,j)) {
                continue;
            }
            vis.insert((i,j));
            if vis.len() >= k as usize {
                break;
            }
            if i < n-1 {
                let x = Reverse(nums1[i+1]+nums2[j]);
                let next = (x, i+1, j);
                q.push(next)
            }
            if j < m-1 {
                let x = Reverse(nums1[i]+nums2[j+1]);
                let next = (x, i, j+1);
                q.push(next)
            }
        }
        vis.into_iter()
            .map(|(i,j)| vec![nums1[i], nums2[j]])
            .collect()
    }
}
```
