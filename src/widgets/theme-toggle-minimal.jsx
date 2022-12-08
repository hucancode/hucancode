import React, { useEffect, useState } from "react";
import styles from "./theme-toggle-minimal.module.css";

function Container(props) {
  return <div className={styles["switch-button"]}>{props.children}</div>;
}

function ButtonGraphic(props) {
  return (
    <label
      htmlFor={props.htmlFor}
      className="bg-blue-300 duration-500 peer-checked:bg-gray-700
        peer-checked:after:left-[calc(100%-0.2rem)]
        peer-checked:after:-translate-x-full
        peer-checked:dark:bg-gray-500"
    />
  );
}

export default function ThemeToggleMinimal(props) {
  var [isDarkMode, setIsDarkMode] = useState(false);
  useEffect(() => {
    let pickedDarkModeBefore = localStorage.theme === "dark";
    let neverPickedAnything = "theme" in localStorage;
    let preferDarkMode = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    if (pickedDarkModeBefore || (neverPickedAnything && preferDarkMode)) {
      setIsDarkMode(true);
    }
  }, []);
  useEffect(() => {
    if (isDarkMode) {
      localStorage.theme = "dark";
      document.documentElement.classList.add("dark");
    } else {
      localStorage.theme = "light";
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);
  return (
    <Container>
      <input
        id={props.inputId}
        type="checkbox"
        className="peer"
        checked={isDarkMode}
        onChange={() => {
          setIsDarkMode(!isDarkMode);
        }}
      />
      <ButtonGraphic htmlFor={props.inputId} />
    </Container>
  );
}
