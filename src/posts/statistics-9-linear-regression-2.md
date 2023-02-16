---
title: Ten days of statistics (10) - Multiple Regression
excerpt: Let's learn basic statistics in 10 days
cover: /blog/post/statistics-10/5031659.jpg
date: 2023-02-16
categories:
  - combinatorics
  - statistics
  - math
---

## Multiple Regression

If $Y$ depends on $X$, we have ordinary 2D regression line.
But if $Y$ depends on $m$ variables $X_1, X_2, ..., X_m$ then we need to find
$m$ values of $b$ to accompany all $X_i$. Formally speaking

$$
Y = a+b_1X_1+b_2X_2+b_3X_3+...+b_mX_m
$$

### Matrix form of the equation

We define 2 matrices

$$
\begin{align*}
X &=
\begin{bmatrix}
1 & x_1 & x_2 & ... & x_m
\end{bmatrix}\\
B &=
\begin{bmatrix}
a\\
b_1\\
b_2\\
...\\
b_m
\end{bmatrix}
\end{align*}
$$

Then we can rewrite $Y$ with $X$ and $B$ as:

$$
Y = X \cdot B
$$

### Find the matrix $B$

$$
\begin{align*}
&\qquad Y = X \cdot B \\
&\Rightarrow B \cdot X = Y \\
&\Rightarrow X^T \cdot X \cdot B = X^T \cdot Y \\
&\Rightarrow B = (X^T \cdot X)^{-1} \cdot X^T \cdot Y \\
\end{align*}
$$

Where

- $M^T$ is the transpose matrix of $M$
- $M^{-1}$ is the inverse matrix of $M$ ($M^{-1} \cdot M = I$)

## Practice

Hackerrank has an exercise for you to test your knowledge:

- https://www.hackerrank.com/challenges/s10-multiple-linear-regression/problem
