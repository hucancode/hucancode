---
title: Ten days of statistics (8) - Correlationship
excerpt: Let's learn basic statistics in 10 days
cover: /blog/post/statistics-10/business-woman-hand-with-financial-charts-laptop-ta.jpg
date: 2023-02-16
categories:
  - combinatorics
  - statistics
  - math
---

## Covariance

This is a measure of how two random variables $X$ and $Y$ change together. Formally

$$
cov(X,Y) = \frac{1}{n}\sum_{i=1}^n (x_i - \bar{x}) \times (y_i - \bar{y})
$$

Where

- $\bar{x}$ is the mean of $x$
- $\bar{y}$ is the mean of $y$

## Pearson Correlation Coefficient

The Pearson correlation coefficient $\rho(X, Y)$ is given by:

$$
\rho(X,Y) = \frac{cov(X,Y)}{\sigma_X\sigma_Y}
$$

Where

- $\sigma_X$ is the standard deviation of $X$
- $\sigma_Y$ is the standard deviation of $Y$

## Spearman's Rank Correlation Coefficient

Given 2 random variables $X$ and $Y$ with the same sample size. Let $rank_X$ and $rank_Y$ denotes the ranks
of each data point on $X$ and $Y$ respectively.
Let $r_S$ is the Spearman's rank correlation coefficient of $X$ and $Y$,
which equal to the Pearson correlation coefficient of $rank_X$ and $rank_Y$

$$
\begin{align*}
r_S &= \frac{cov(rank_X, rank_Y)}{\sigma_{rank_X}\sigma_{rank_Y}}\\
r_S &= \frac{cov(rank_X, rank_Y)}{\sigma^2} \qquad \text{(if X and Y contains no duplicates)}
\end{align*}
$$

## Practice

Hackerrank has some exercises for you to test your knowledge:

- https://www.hackerrank.com/challenges/s10-pearson-correlation-coefficient/problem
- https://www.hackerrank.com/challenges/s10-spearman-rank-correlation-coefficient/problem
