---
title: Ten days of statistics (1) - Mean, Median, Mode
excerpt: Let's learn basic statistics in 10 days
cover: /blog/post/statistics-10/5031659.jpg
date: 2023-02-09
categories:
  - combinatorics
  - statistics
  - math
---

## Mean

The average of all the integers in a set of $n$ values.
Formally:

$$
\mu = \frac{\sum_{i=1}^n x_i}{n}
$$

Where $x_i$ is the $i^{th}$ element of the set

### Weighted mean

Given a discrete set of numbers $X$, and a corresponding set of weights $W$, the weighted mean is calculated as follows:

$$
\mu_w = \frac{\sum_{i=1}^n (x_i \times w_i)}{\sum_{i=1}^n w_i}
$$

Where $x_i$, $w_i$ is the value and weight for element $i^{th}$ of the set

## Median

The midpoint value of a data set for which an equal number of samples are less than and greater than the value.

For an odd sample size, this is the middle element of the sorted sample

$$
m = x_{i \div 2}
$$

For an even sample size, this is the average of the 2 middle elements of the sorted sample

$$
m = \frac{x_{(i-1) \div 2} + x_{(i+1) \div 2}}{2}
$$

## Mode

The element(s) that occur most frequently in a data set. For the set
$\{1,1,1,1,1,1,2,3,3,4,9\}$, the mode is $1$. For the set $\{1,2,3\}$, every number in the set is a valid mode.

## Application of mean, median and mode

### Mean

Human Resource managers often calculate the mean salary of individuals in a certain rank so they can
know how much salary to offer to new employees.

### Median

Human Resource managers also often calculate the median salary
so that they can be informed of what the typical “middle” salary is for a particular rank.
Median is less influenced by outliers (few extraordinary talented individuals with super high salary) so it is sometimes
more accurate than mean value.

### Mode

Real estate agents often calculate the mode number of bedrooms per house, so they can inform
their clients on how many bedrooms they can expect to have in houses in a particular area.

## Practice

Hackerrank has some exercises for you to test your knowledge:

- https://www.hackerrank.com/challenges/s10-basic-statistics/problem
- https://www.hackerrank.com/challenges/s10-weighted-mean/problem

Next lesson: [Quatiles, Standard Deviation](/blog/post/statistics-1-quartile-standard-deviation)
