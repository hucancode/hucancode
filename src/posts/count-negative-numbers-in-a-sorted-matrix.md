---
title: Count Negative Numbers in a Sorted Matrix
excerpt: Simple traversing problem that can be solve in many ways
date: 2023-06-28
categories:
  - algorithm
  - leetcode
---

## Problem

Given a $m \times n$ matrix $grid$ which is sorted in non-increasing order both row-wise and column-wise, return the number of negative numbers in $grid$

### Example

```
Input: grid = [[4,3,2,-1],[3,2,1,-1],[1,1,-1,-2],[-1,-1,-2,-3]]
Output: 8
Explanation: There are 8 negatives number in the matrix.
```

```
Input: grid = [[3,2],[1,0]]
Output: 0
```

### Constraints

- $1 \leq n,m \leq 100$
- $-100 \leq grid_{i,j} \leq 100$

Submit your solution at [here](https://leetcode.com/problems/count-negative-numbers-in-a-sorted-matrix/)

## Solution

### Approach

Because $n,m \leq 100$ there are 3 ways to AC this

- Naive full search $O(n\times m)$
- Binary search $O(n\times log(m))$
- Diagonal scan $O(n+m)$

### Code

Diagonal scan

```rust
impl Solution {
    pub fn count_negatives(grid: Vec<Vec<i32>>) -> i32 {
        let n = grid.len() as i32;
        let m = grid[0].len() as i32;
        let mut ret = 0;
        let mut y = 0;
        let mut x = n-1;
        while x >= 0 && y < m {
            while y < m && grid[x as usize][y as usize] >= 0 {
                y += 1;
            }
            ret += m-y;
            x -= 1;
        }
        ret
    }
}
```

Binary search

```rust
impl Solution {
    pub fn count_negatives(grid: Vec<Vec<i32>>) -> i32 {
        grid.into_iter()
            .map(|arr| (arr.len() - arr.partition_point(|&x| x >= 0)) as i32)
            .sum::<i32>()
    }
}
```

Full search

```rust
impl Solution {
    pub fn count_negatives(grid: Vec<Vec<i32>>) -> i32 {
        grid.into_iter()
            .map(|arr| arr.into_iter().filter(|&x| x<0).count() as i32)
            .sum::<i32>()
    }
}
```

# Benchmark

I use this program to do the benchmark

```rust
use std::env;
use std::fs::File;
use std::io::Read;
use std::time::Instant;

fn count_on2(grid: &Vec<Vec<i32>>) -> i32 {
    grid.iter()
        .map(|arr| arr.iter().filter(|&x| x < &0).count() as i32)
        .sum::<i32>()
}
fn count_onlogn(grid: &Vec<Vec<i32>>) -> i32 {
    grid.iter()
        .map(|arr| (arr.len() - arr.partition_point(|&x| x >= 0)) as i32)
        .sum::<i32>()
}
fn count_on(grid: &Vec<Vec<i32>>) -> i32 {
    let n = grid.len() as i32;
    let m = grid[0].len() as i32;
    let mut ret = 0;
    let mut y = 0;
    let mut x = n-1;
    while x >= 0 && y < m {
        while y < m && grid[x as usize][y as usize] >= 0 {
            y += 1;
        }
        ret += m-y;
        x -= 1;
    }
    ret
}

fn main() -> std::io::Result<()>{
    let args: Vec<String> = env::args().collect();
    let filename = "input.txt".to_string();
    let filename = args.get(1).unwrap_or(&filename);
    let mut file = File::open(filename)?;
    let mut content = String::new();
    file.read_to_string(&mut content)?;
    let args: Vec<Vec<i32>> = content.lines()
        .map(|s| s.split_whitespace()
            .filter_map(|s| s.parse::<i32>().ok())
            .collect())
        .collect();
    let start = Instant::now();
    let result = count_on2(&args);
    let base = start.elapsed();
    println!("count on2 -> {result}, take {:?}", base);
    let start = Instant::now();
    let result = count_onlogn(&args);
    let t = start.elapsed();
    let improve = t.as_secs_f64()/base.as_secs_f64();
    println!("count onlogn -> {result}, take {:?} {improve:?}x better", t);
    let start = Instant::now();
    let result = count_on(&args);
    let t = start.elapsed();
    let improve = t.as_secs_f64()/base.as_secs_f64();
    println!("count on -> {result}, take {:?} {improve:?}x better", t);
    Ok(())
}
```

## Result

| n=m | O(n\*m)      | O(nlogm)   | Improvement | O(n+m)     | Improvement |
| --- | ------------ | ---------- | ----------- | ---------- | ----------- |
| 100 | 1.19µs       | 2.918µs    | worse       | 904ns      | 1x          |
| 1e3 | 246.593µs    | 69.351µs   | 3x          | 2.401µs    | 102x        |
| 1e4 | 23.898318ms  | 1.345325ms | 17x         | 427.868µs  | 55x         |
| 2e4 | 96.343281ms  | 3.197725ms | 30x         | 1.210404ms | 79x         |
| 5e4 | 618.478451ms | 9.468345ms | 65x         | 4.289963ms | 144x        |
