---
title: Modular Inverse
excerpt: In arithmetic, a modular multiplicative inverse of an integer a is an integer x such that the product a*x = 1 with respect to the modulus m
date: 2023-02-06
categories:
  - algorithm
  - math
  - modular-arithmetic
---

## Problem

Given a formular which result is normally very large, can't be stored in any primitive data type. Calculate the result in mod {% math %}10^9+7{% /math %}. The formular often involve _division_.
For example, let's calculate this

{% math type="block" %}
nCr \equiv \frac{n!}{(n-r)!r!} \pmod {10^9+7}
{% /math %}

## Naive approach

### Naive approach 1 (Heavy Implementation)

1. Calculate {% math %}n!{% /math %}, using big number class to store result
2. Calculate {% math %}(n-r)!r!{% /math %}, also using a custom implemented `BigNumber` class
   1. You can optimize this by calculate {% math %}n!/r!{% /math %} in one loop. This way you decimate alot of computation
3. Divide 2 numbers to get the result
4. Mod the result by {% math %}10^9+7{% /math %}

This requires **non-trivial** effort to implement `BigNumber` class.
`Python` folks are in luck but most programming language doesn't support big number by default.
Assume that you are an average programmer like me. You often fail to come up with a correct implementation of the `BigNumber` class.

### Naive approach 2 (Wrong Answer)

1. Calculate {% math %}n! \pmod {10^9+7}{% /math %}
2. Calculate {% math %}(n-r)!r! \pmod {10^9+7}{% /math %}
   1. Same as before. You can optimize this by calculate {% math %}n!/r!{% /math %} in one loop. This way you decimate alot of computation
3. Divide 2 numbers to get the result

This seems natural but unfortunately gives WA, because the algorithm is wrong mathematically.

## Solution

The problem with naive approach #2 is that, in step 3 where we normally divide 2 numbers, we get incorrect answer.
Because _division_ doesn’t work in modular arithmetic, only _multiplication_.
But luckily there is a formular to address this issue,
it converts division to multiplication by leveraging [Modular multiplicative inverse](https://en.wikipedia.org/wiki/Modular_multiplicative_inverse).

Formally, **if {% math %}k{% /math %} is a prime number**, we have

{% math type="block" %}
\begin{align}
a \div b &\equiv a \times b^{-1} \pmod k\\\\
b^{-1} &\equiv b^{k-2} \pmod k\\\\
a \div b &\equiv a \times b^{k-2} \pmod k
\end{align}
{% /math %}

Everytime you were to do _division_, you multiply it with the power {% math %}k-2{% /math %} of the divisor instead and it's guaranteed to be correct mathematically 😎

There is a new problem araise, calculation of {% math %}b^{k-2}{% /math %} could be expensive (for example {% math %}k=10^9+7{% /math %}). This could easily be solved by using a fast {% math %}O(\log(n)){% /math %} power calculation algorithm

```cpp
#define INF (1e9+7)
long long fastPow(int x, int p) {
	if(p == 0) return 1;
	if(p == 1) return x;
	auto k = fastPow(x,p/2);
	return k*k*fastPow(x,p%2)%INF;
}
```
