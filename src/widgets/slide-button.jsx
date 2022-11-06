import React, { useState } from "react";
import styles from "./slide-button.module.css";
function Container(props) {
  return <div className={styles["slide-button"]}>{props.children}</div>;
}

function ButtonGraphic(props) {
  return (
    <label
      htmlFor={props.htmlFor}
      className="absolute flex justify-between
        duration-500
        translate-x-[1.5%]
        peer-checked:translate-x-[-35%]"
    >
      <div className="-skew-x-12 bg-cyan-400 w-1/3 h-full"></div>
      <div className="-skew-x-12 bg-cyan-400 w-1/3 h-full"></div>
    </label>
  );
}

function ButtonLabelA(props) {
  return (
    <h3
      onClick={props.onClick}
      className="text-red-600 peer-checked:text-gray-700 dark:peer-checked:text-gray-400"
    >
      {props.children}
    </h3>
  );
}

function ButtonLabelB(props) {
  return (
    <h3
      onClick={props.onClick}
      className="text-gray-700 peer-checked:text-red-600 dark:text-gray-400"
    >
      {props.children}
    </h3>
  );
}

export default function SlideButton(props) {
  var [value, setValue] = useState(false);
  return (
    <Container>
      <input
        id={props.inputId}
        type="checkbox"
        className="peer"
        checked={value}
        onChange={() => {
          setValue(!value);
          props.onChange(!value);
        }}
      />
      <ButtonGraphic htmlFor={props.inputId} />
      <ButtonLabelA
        onClick={() => {
          setValue(false);
          props.onChange(false);
        }}
      >
        {props.labelA}
      </ButtonLabelA>
      <ButtonLabelB
        onClick={() => {
          setValue(true);
          props.onChange(true);
        }}
      >
        {props.labelB}
      </ButtonLabelB>
    </Container>
  );
}