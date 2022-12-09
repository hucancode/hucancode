"use client";
import React, { useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import { useI18n } from "locales/i18n";
import DualTag from "./dual-tag";
import { SiLeetcode } from "react-icons/si";

export default function LineChart(props) {
  let canvas = useRef(null);
  let i18n = useI18n();
  useEffect(() => {
	let language = i18n.locale();
	let format = { year: "numeric", month: "short" };
    let labels = props.data.map((e) => {
      let date = new Date(e.contest.startTime * 1000);
      return date.toLocaleDateString(language, format);
    });
    if (props.data.length != 0) {
      let lastLabel = labels[0];
      for (let i = 1; i < labels.length-1; i++) {
        if (labels[i] == lastLabel) {
          labels[i] = "";
        } else {
          lastLabel = labels[i];
        }
      }
    }
    let data = props.data.map((e) => e.rating);
    let chart = new Chart(canvas.current, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: i18n.t("home.stats.rating"),
            data: data,
          },
        ],
      },
      options: {
        plugins: {
          legend: {
            display: false,
          },
        },
      },
    });
    return () => {
      chart.destroy();
    };
  }, [canvas, props.data, i18n]);
  return (
    <div className="h-full w-full">
      <div
        data-tooltip={i18n.t("home.stats.lcRating")}
        className="mb-4 flex items-center justify-center gap-2"
      >
        <div className="flex flex-col items-center justify-center gap-2 md:flex-row">
          <SiLeetcode size="1.5em" />
          <span className="">Leetcode</span>
        </div>
        <DualTag
          title={i18n.t("home.stats.rating")}
          value={Math.round(props.rating)}
        />
        <DualTag
          title={i18n.t("home.stats.topPercentage")}
          value={props.topPercentage + "%"}
        />
      </div>
      <canvas className={props.className} ref={canvas} />
    </div>
  );
}
