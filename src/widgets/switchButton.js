import React, { useState } from "react";

function Container(props) {
    return <div className="switch-button">
        {props.children}
    </div>
}

export default function SwitchButton(props) {
    var [value, setValue] = useState(false);
    return <Container>
        <h3 active={(!value)?"true":undefined} onClick={() => { setValue(false); props.onChange(false); }}>{props.labelA}</h3>
        <input id={props.inputId} type="checkbox" checked={value} onChange={() => { setValue(!value); props.onChange(!value); }} />
        <label htmlFor={props.inputId} />
        <h3 active={value?"true":undefined} onClick={() => { setValue(true); props.onChange(true); }}>{props.labelB}</h3>
    </Container>
}