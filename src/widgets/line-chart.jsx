"use client";
import React, { useEffect, useRef } from "react";
import Chart from 'chart.js/auto';

export default function LineChart(props) {
	let canvas = useRef(null);
	useEffect(() => {
		let chart = new Chart(
			canvas.current,
			{
				type: 'line',
				data: {
					labels: props.data.map(e => {
						let format = { year: 'numeric', month: 'long' };
						let date = new Date(e.contest.startTime*1000);
						return date.toLocaleDateString('en-US', format);
					}),
					datasets: [
					{
						label: 'Leetcode Rating',
						data: props.data.map(e => e.rating)
					}
					]
				}
			}
		);
		return () => {
			chart.destroy();
		}
	},[canvas, props.data]);
	return <canvas className={props.className} ref={canvas} />
}