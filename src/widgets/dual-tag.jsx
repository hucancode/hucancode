import React from "react";

export default function DualTag(props) {
  let title = props.title;
  let value = props.value;
  return (
    <div>
      <span className="bg-sky-200 px-2 py-1 pr-4 text-gray-700 dark:bg-gray-700 dark:text-gray-100">
        {title}
      </span>
      <span className="bg-gray-800 px-2 py-1 text-gray-400 dark:bg-white dark:text-gray-700">
        {value}
      </span>
    </div>
  );
}
