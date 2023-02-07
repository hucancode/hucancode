---
title: Collection of bit mask operation
excerpt: I have collected a few popular and useful bit operations
date: 2023-02-07
categories:
  - algorithm
  - bitmask
---

## Standard operations

Set the $i^{th}$ bit

```cpp
mask |= 1 << i
```

Unset the $i^{th}$ bit

```cpp
mask &= ~(1 << i)
```

Toggle the $i^{th}$ bit

```cpp
mask ^= 1 << i
```

Check if $i^{th}$ bit is set

```cpp
mask & (1 << i)
```

Get the lowest bit (least significant bit)

```cpp
x & -x
```

## C++ specific functions

Count bit 1s

```cpp
__builtin_popcount(n)
// pop means population
```

Count trailing zeros

```cpp
__builtin_ctz(n)
// ctz means count trailing zero
```

Count leading zeroes

```cpp
__builtin_clz(n)
// clz means count leading zero
```

Check if n is power of 2

```cpp
__builtin_popcount(n) == 1
```
