---
title: Minimum One Bit Operations to Make Integers Zero
date: 2022-10-28 
categories:
  - algorithm
  - bitmask
  - dynamic-programming
  - leetcode
excerpt: A hard problem related to bit manipulation
---

## Problem

Given an integer `n`, you must transform it into `0` using the following operations any number of times:

- Change the rightmost (`0th`) bit in the binary representation of `n`.
- Change the `ith` bit in the binary representation of $n$ if the `(i-1)th` bit is set to $1$ and the `(i-2)th` through `0th` bits are set to `0`.
  Return the minimum number of operations to transform `n` into `0`.

### Example

```
Input: n = 3
Output: 2
Explanation: The binary representation of 3 is "11".
"11" -> "01" with the 2nd operation since the 0th bit is 1.
"01" -> "00" with the 1st operation.
```

```
Input: n = 6
Output: 4
Explanation: The binary representation of 6 is "110".
"110" -> "010" with the 2nd operation since the 1st bit is 1 and 0th through 0th bits are 0.
"010" -> "011" with the 1st operation.
"011" -> "001" with the 2nd operation since the 0th bit is 1.
"001" -> "000" with the 1st operation.
```

### Constraints

$0 <= n <= 10^9$

## Solution

### Observation

My solution is based on this observation:

- Let's say we have number `1xxxx`, in order to clear the highest 1, there is no other way but to make it `11000` first, and then clear the highest `1` to form `1000`. This is not proven but I can't find any other way to do it. So I just assume it. If you have a proof or a counter example on this I would gladly accept.
- From number `10000`, the only way to make it `00000` is by transform it to `11000`, clear the highest `1` and then recursively do it all over again. Let `n` is the decimal form of the number we need to clear, the number of steps needed is `n*2-1`, or you can use bit operator with `i` is the position of the `1` bit, `(1<<(i+1)) - 1`

### Time complexity

$O(k)$ where $k$ is maximum bit count of $n$

### Code

```cpp
class Solution {
public:
    int costToClear(int bit) {
        return (1<<(bit+1)) - 1;
    }
    int minimumOneBitOperations(int n) {
        vector<int> f(31);// f[i] = cost to make xxxx to be 0000
        vector<int> g(31);// g[i] = cost to make xxxx to be 1000
        f[0] = (n&1)?1:0;
        g[0] = (n&1)?0:1;
        for(int i = 1;i<31;i++) {
            bool isSet = (n&(1<<i)) != 0;
            if(isSet) {
                g[i] = f[i-1];
                f[i] = g[i-1];// cost to make 1xxxx -> 11000
				f[i] += 1;// cost to make 11000 -> 1000
                f[i] += costToClear(i-1);// cost to make 1000 to become 0000
            } else {
                f[i] = f[i-1];
                g[i] = g[i-1];// cost to make 0xxxx -> 01000
				g[i] += 1;// cost to make 01000 -> 11000
                g[i] += costToClear(i-1);// cost to make 1000 to become 0000
            }
        }
        return f[30];
    }
};
```
