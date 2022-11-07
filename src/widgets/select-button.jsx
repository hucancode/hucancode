import React, { useState } from "react";
import styles from "./select-button.module.css";
function Container(props) {
  return <div className={styles["select-button"]}>{props.children}</div>;
}

function ButtonGraphic(props) {
  return (
    <label
      htmlFor={props.htmlFor}
      className="absolute flex justify-between
        bg-white/10
		duration-100
		peer-checked:-translate-x-1/3"
    >
      <div className="h-full w-1/3 bg-black"></div>
      <div className="h-full w-1/3 bg-black"></div>
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

export default function SelectButton(props) {
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
