"use client";
import React, { useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import { useI18n } from "locales/i18n";
import DualTag from "./dual-tag";

export default function LineChart(props) {
  let canvas = useRef(null);
  let i18n = useI18n();
  useEffect(() => {
    let labels = props.data.map((e) => {
      let format = { year: "numeric", month: "short" };
      let date = new Date(e.contest.startTime * 1000);
      return date.toLocaleDateString("en", format);
    });
    if (props.data.length != 0) {
      let lastLabel = labels[0];
      for (let i = 1; i < labels.length; i++) {
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
            label: i18n.t("home.stats.lcRating"),
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
      <div className="mb-4 flex justify-center gap-2">
        <DualTag
          title={i18n.t("home.stats.lcRating")}
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
