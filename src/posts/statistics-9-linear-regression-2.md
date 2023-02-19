---
title: Ten days of statistics (10) - Multiple Regression
excerpt: Let's learn basic statistics in 10 days
cover: /blog/post/statistics-10/economical-research.jpg
date: 2023-02-18
categories:
  - combinatorics
  - statistics
  - math
---

## Multiple regression

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

### Generalized matrix form

Now we want to generalize the experiment, instead of 1 observation, we want to do $n$ observations.
We would have $n$ variables $y_1, y_2, y_3, ..., y_n$
First, we have equation form

$$
\begin{align*}
y_1 &= a + b_1x_{1,1} + b_1x_{2,1} + b_1x_{3,1} + ... + b_1x_{m,1}\\
y_2 &= a + b_1x_{1,2} + b_1x_{2,2} + b_1x_{3,2} + ... + b_1x_{m,2}\\
y_3 &= a + b_1x_{1,3} + b_1x_{2,3} + b_1x_{3,3} + ... + b_1x_{m,3}\\
... \\
y_n &= a + b_1x_{1,n} + b_1x_{2,n} + b_1x_{3,n} + ... + b_1x_{m,n}\\
\end{align*}
$$

Then, the matrix form

$$
\begin{align*}
X &= \begin{bmatrix}
1 & x_{1,1} & x_{2,1} & ... & x_{m,1} \\
1 & x_{1,2} & x_{2,2} & ... & x_{m,2} \\
1 & x_{1,3} & x_{2,3} & ... & x_{m,3} \\
... \\
1 & x_{1,n} & x_{2,n} & ... & x_{m,n}
\end{bmatrix} \\
Y &= \begin{bmatrix}
y_1 \\
y_2 \\
y_3 \\
... \\
y_n \\
\end{bmatrix} \\
Y &= X \cdot B
\end{align*}


$$

## Find the matrix $B$

$$
\begin{align*}
&\qquad Y = X \cdot B \\
&\Rightarrow X \cdot B = Y \\
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

## Congratulations

You have finished `10 days of statistics` challenge. I have learned a lot and so did you.
I hope it benefits you as much as it does to me.
Thanks [Hackerrank](https://www.hackerrank.com/) for the challenges and inspirations.
