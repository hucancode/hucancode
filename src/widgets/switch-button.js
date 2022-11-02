import React, { useState } from "react";
import styles from "./switch-button.module.css";
function Container(props) {
  return <div className={styles["switch-button"]}>{props.children}</div>;
}

function ButtonGraphic(props) {
  return (
    <label
      htmlFor={props.htmlFor}
      className="bg-blue-300 peer-checked:bg-green-500 peer-checked:dark:bg-green-300
        duration-500
        peer-checked:after:-translate-x-full
        peer-checked:after:left-[calc(100%-0.2rem)]"
    />
  );
}

function ButtonLabelA(props) {
  return (
    <h3
      onClick={props.onClick}
      className="text-blue-700 peer-checked:text-gray-700 dark:text-blue-500 dark:peer-checked:text-gray-400"
    >
      {props.children}
    </h3>
  );
}

function ButtonLabelB(props) {
  return (
    <h3
      onClick={props.onClick}
      className="text-gray-700 peer-checked:text-blue-700 dark:text-gray-400 dark:peer-checked:text-blue-500"
    >
      {props.children}
    </h3>
  );
}

export default function SwitchButton(props) {
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
      <ButtonLabelA
        onClick={() => {
          setValue(false);
          props.onChange(false);
        }}
      >
        {props.labelA}
      </ButtonLabelA>
      <ButtonGraphic htmlFor={props.inputId} />
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
