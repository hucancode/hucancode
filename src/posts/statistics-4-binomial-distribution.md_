---
title: Ten days of statistics (5) - Binomial distribution
excerpt: Let's learn basic statistics in 10 days
cover: /blog/post/statistics-10/5024147.jpg
date: 2023-02-13
categories:
  - combinatorics
  - statistics
  - math
---

## Binomial experiment

A binomial experiment is an experiment that is:

- The experiment consists of $n$ repeated trials
- The trials are independent
- The outcome of each trial is either success or failure

The sample space of a binomial experiment only has 2 points, 1 (success) and 0 (failure).
Let $p(x)$ be the probability of an experiment ending with result $x$

$$
p(x) = \begin{cases}
  1-k & \text{ if x = 0 } \\
  k & \text{ if x = 1 } \\
  0 & \text{ otherwise }
\end{cases}
$$

## Binomial distribution

We define a binomial process to be a binomial experiment meeting the following conditions:

- The number of successes is $x$.
- The total number of trials is $n$.
- The probability of success of $1$ trial is $p$.

Let $b(x,n,p)$ is the probability of having exact $x$ successes out of $n$ trials. Then we have

$$
b(x, n, p) = C \binom{n}{x} \times p^x \times (1-p)^{n-x}
$$

_Note_: $C\binom{n}{r} = n! \div (r! \times (n-r)!)$

### Example

Toss a coin 10 times. Let's find the following probabilities:

- Getting 5 heads
- Getting at least 5 heads
- Getting at most 5 heads

Using binomial distribution formular, we have

$$
b(5, 10, 0.5) = 0.24609375
$$

We have $\approx 25\%$ chance of getting exact 5 heads.

$$
\sum_{x=5}^{10} b(x,10,0.5) = 0.623046875
$$

We have $\approx 62\%$ chance of getting at least 5 heads

$$
\sum_{x=0}^5 b(x, 10, 0.5) = 0.623046875
$$

We also have $\approx 62\%$ chance of getting at most 5 heads

## Negative binomial experiment

A negative binomial experiment is an experiment that is:

- The probability of success of $1$ trial is $p$
- The trials continue until $x$ successes are observed
- The total number of trials is **not** fixed

_Note_: the different between _negative binomial experiment_ and _binomial experiment_
is on the **interest**. _Negative_ version only interest in getting exact $x$ successes, normal version
interest in performing exact $n$ trials.

## Negative binomial distribution

Formally speaking, let $b^*(x, n, p)$ be the probability of having

- Exact $x-1$ successes after $n-1$ trials
- Exact $x$ successes after $n$ trials

$$
b^*(x, n, p) = C \binom{n-1}{x-1} \times p^x \times (1-p)^{n-x}
$$

## Geometric distribution

The geometric distribution is a special case of the negative binomial distribution
that deals with the number of trials required to get a success
(i.e. counting the number of failures before the first success).

$$
g(n,p) = p \times (1-p)^{n-1}
$$

### Example

Vova's family lives in Russia where the weather is cold.
The chance for Vova's wife to give birth to a boy is 30%. What is the probability that Vova
have his first son at his fifth child?

For this experiment, $n = 5, p = 0.3$, we have $g(5, 0.3) = 0.3 \times 0.7^4 = 0.07203$.
So Vova has $\approx 7\%$ of having his first son at his fifth child.

## Practice

Hackerrank has some exercises for you to test your knowledge:

- https://www.hackerrank.com/challenges/s10-binomial-distribution-1/problem
- https://www.hackerrank.com/challenges/s10-binomial-distribution-2/problem
- https://www.hackerrank.com/challenges/s10-geometric-distribution-1/problem
- https://www.hackerrank.com/challenges/s10-geometric-distribution-2/problem

Next lesson: [Poisson & normal distribution](/blog/post/statistics-5-poisson-normal-distribution)
