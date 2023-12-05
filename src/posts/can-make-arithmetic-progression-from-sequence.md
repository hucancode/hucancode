---
title: Can Make Arithmetic Progression From Sequence
excerpt: The task is to determine if the input array can make a arithmetic progression or not.
date: 2023-06-06
categories:
  - algorithm
  - greedy
  - leetcode
---

## Problem

A sequence of numbers is called an arithmetic progression if the difference between any two consecutive elements is the same.

Given an array of numbers $arr$, return true if the array can be rearranged to form an arithmetic progression. Otherwise, return false.

### Example

```
Input: arr = [3,5,1]
Output: true
Explanation: We can reorder the elements as [1,3,5] or [5,3,1] with differences 2 and -2 respectively, between each consecutive elements.
```

```
Input: arr = [1,2,4]
Output: false
Explanation: There is no way to reorder the elements to obtain an arithmetic progression
```

### Constraints

- $1 \leq n \leq 1000$
- $-10^6 \leq arr_i \leq 10^6$

Submit your solution at [here](https://leetcode.com/problems/can-make-arithmetic-progression-from-sequence/)

## Solution

### Approach

- Sort and compare adjacent element
- Get min/max, build expected series and check if that series is fulfilled

### Complexity

- Time complexity: $O(n)$ vs $O(n \times log(n))$
- Space complexity: $O(n)$ vs $O(1)$

### Code

$O(n)$ solution

```
impl Solution {
    pub fn can_make_arithmetic_progression(arr: Vec<i32>) -> bool {
        let n = arr.len() as i32;
        let min = *arr.iter().min().unwrap_or(&0);
        let max = *arr.iter().max().unwrap_or(&0);
        if (max-min)%(n-1) != 0 {
            return false;
        }
        let d = (max-min)/(n-1);
        if d == 0 {
            return true;
        }
        let mut vis = vec![false;n as usize];
        arr.iter()
            .map(|x| x-min)
            .filter(|x| x%d == 0)
            .map(|x| (x/d) as usize)
            .for_each(|x| vis[x] = true);
        vis.iter().all(|&x| x)
    }
}
```

$O(n\times log(n))$ solution

```
impl Solution {
    pub fn can_make_arithmetic_progression(mut arr: Vec<i32>) -> bool {
        arr.sort();
        let arr: Vec<i32> = arr.windows(2)
            .map(|a| a[1] - a[0])
            .collect();
        if let Some(x) = arr.first() {
            arr.iter().all(|y| x == y)
        } else {
            false
        }
    }
}
```

### Benchmark

So out of curious, I made a benchmark to see the performance difference, following are the test program

```
use std::env;
use std::fs::File;
use std::io::Read;
use std::time::Instant;

fn check_progression_ologn(arr: &mut Vec<i32>) -> bool {
    arr.sort();
    let arr: Vec<i32> = arr.windows(2)
        .map(|a| a[1] - a[0])
        .collect();
    if let Some(x) = arr.first() {
        arr.iter().all(|y| x == y)
    } else {
        false
    }
}
fn check_progression_on(arr: &Vec<i32>) -> bool {
    let n = arr.len() as i32;
    let min = *arr.iter().min().unwrap_or(&0);
    let max = *arr.iter().max().unwrap_or(&0);
    if (max-min)%(n-1) != 0 {
        return false;
    }
    let d = (max-min)/(n-1);
    if d == 0 {
        return true;
    }
    let mut vis = vec![false;n as usize];
    arr.iter()
        .map(|x| ((x-min)/d) as usize)
        .for_each(|x| vis[x] = true);
    vis.iter().all(|&x| x)
}

fn main() -> std::io::Result<()>{
    let args: Vec<String> = env::args().collect();
    let filename = "input.txt".to_string();
    let filename = args.get(1).unwrap_or(&filename);
    let mut file = File::open(filename)?;
    let mut content = String::new();
    file.read_to_string(&mut content)?;
    let mut args: Vec<i32> = content.lines()
        .filter_map(|s| s.parse::<i32>().ok())
        .collect();
    let start = Instant::now();
    let result = check_progression_on(&args);
    println!("check_progression_on -> {result}, take {:?}", start.elapsed());
    let start = Instant::now();
    let result = check_progression_ologn(&mut args);
    println!("check_progression_ologn -> {result}, take {:?}", start.elapsed());
    Ok(())
}
```

### Test result

| n   | O(n)         | O(nlogn)      | Improvement |
| --- | ------------ | ------------- | ----------- |
| 1e4 | 29.899µs     | 442.69µs      | 14x         |
| 1e5 | 317.912µs    | 6.157911ms    | 19x         |
| 1e6 | 3.523541ms   | 68.129272ms   | 19x         |
| 1e7 | 43.674532ms  | 785.296765ms  | 18x         |
| 1e8 | 1.334567741s | 13.893901021s | 10x         |
