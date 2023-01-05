---
title: Sam and substrings
excerpt: How to analyze mathematics formular to solve a programming puzzle
date: 2022-06-24
categories:
  - algorithm
  - hackerrank
---

## Problem

Samantha and Sam are playing a numbers game. Given a number as a string, no leading zeros, determine the sum of all integer values of substrings of the string.

Given an integer as a string, sum all of its substrings cast as integers. As the number may become large, return the value modulo $10^9+7$.

### Example

Let $n = 42$. Here $n$ is a string that has $3$ integer substrings: $4$ ,$2$, and $42$. Their sum is $48$, and $$48\mod(10^9+7) = 48$$.

### Constraints

$1 <= sizeof(n) <= 2*10^5$

## Solution

### Brute force (TLE)

```cpp
#include <string>
#include <numeric>
#define INF 1000000007

inline int read(string::iterator from, string::iterator to) {
  long res = 0;
  for (auto i = from; i != to; i++) {
    res = (res * 10 + (int)(*i) - '0') % INF;
  }
  return res;
}

int slow_substrings(string n) {
  long f[200000];
  for(int j=0;j<n.size();j++) {
    f[j] = read(n.begin(), n.begin()+j+1);
    for(int k=1;k<=j;k++) {
      f[j] += read(n.begin()+k, n.begin()+j+1);
    }
  }
  return accumulate(f,f+n.size(), (long)0) % INF;
}
```

### Observation

- Answer seems correct but TLE
- $O(n^3)$
- Alot of plus $+$ operator. Can we improve the formular?

### Code

```cpp

#include <string>
#define INF 1000000007
int substrings(string n) {
  long f[200000];
  long w[200001];
  w[0] = 0;
  for (int i = 1; i <= n.size(); i++) {
    w[i] = (w[i-1] * 10 + 1) % INF;
  }
  long ret = 0;
  for (auto i = n.begin(); i != n.end(); i++) {
    int digit = (int)(*i) - '0';
    int dr = distance(i,n.end());
    int dl = distance(n.begin(), i)+1;
    ret += (long)digit * dl * w[dr];
    ret %= INF;
  }
  return ret;
}
```
