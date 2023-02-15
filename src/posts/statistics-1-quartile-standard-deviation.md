---
title: Ten days of statistics (2) - Quatiles, Standard Deviation
excerpt: Let's learn basic statistics in 10 days
cover: /blog/post/statistics-10/5031659.jpg
date: 2023-02-15
categories:
  - combinatorics
  - statistics
  - math
---

## Quartiles

The quartiles of an ordered data set are the
$3$ points that split the data set size $n$ into $4$ equal groups. $Q_2$ is the median of the set,
$Q_1$ is the median of upper half, $Q_3$ is the median of lower half. When $n$ odd, the median is not
included in the upper half and lower half set.

#### Example 1

Take a set $\{6, 7, 15, 36, 39, 40, 41, 42, 43, 47, 49\}$.

Then $Q_1 = 15; Q_2 = 40; Q_3 = 43$

#### Example 2

Take set $\{7, 15, 36, 39, 40, 41, 42, 43, 47, 49\}$.

Then $Q_1 = 36; Q_2 = \frac{40+41}{2} = 40.5; Q_3 = 43$

## Standard Deviation

Variance $\sigma^2$ of a set $X$ is the average magnitude of fluctuations of $X$ from its mean $\mu$.
Formally:

$$
\sigma^2 = \frac{\sum_{i=1}^n (x_i - \mu)^2}{n}
$$

The standard deviation $\sigma$ of a set $X$ is square root of it's variance. Formally:

$$
\sigma = \sqrt{\sigma} = \sqrt{\frac{\sum_{i=1}^n (x_i - \mu)^2}{n}}
$$

## Application of standard deviation

High standard deviation means the average data point is far away from the mean.
In plain English, we are not very sure about using the mean as an expected value.

Conversely, low standard deviation means the average data point is close to the mean.
Which means, we can use the mean as an expected value confidently.

For example, let's take 2 stock's historical performance over 10 years:

- Stock A: mean annual return = **7%**, standard deviation of annual returns = **7%**
- Stock B: mean annual return = **7%**, standard deviation of annual returns = **2%**

Both stocks have the same average rate of return, but the volatility is much higher with stock A.
If you are an adventurous man, you should pick stock A.

## Practice

Hackerrank has some exercises for you to test your knowledge:

- https://www.hackerrank.com/challenges/s10-quartiles/problem
- https://www.hackerrank.com/challenges/s10-interquartile-range/problem
- https://www.hackerrank.com/challenges/s10-standard-deviation/problem
