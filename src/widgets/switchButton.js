import React, { useState } from "react";
import styled, {css} from 'styled-components';
import tw from 'twin.macro';

const Container = styled.div`
    ${tw`
        w-full
        flex
        items-center
        justify-center
    `}
`;

const Button = styled.input`
    ${tw`
        w-0
        h-0
        invisible
    `}
`;
const Label = styled.h3`
    ${tw`
        w-1/3
        cursor-pointer
        select-none
        text-xs
        md:text-base
        duration-300
    `}
    ${props => props.active ?  
        css`${tw`
            text-blue-500
        `}` :
        css`${tw`
            text-gray-400
            hover:text-blue-500
        `}`
    }
`;
const Graphic = styled.label`
    ${tw`
        bg-blue-300
        w-20
        h-8
        rounded-2xl
        cursor-pointer
        block
    `}
    position: relative;
    margin: 1rem;
        
    &:after {
        content: '';
        ${tw`
            absolute
            duration-300
            bg-white
            top-1
            left-1
            w-6
            h-6
            rounded-full
        `}
    }

    input:checked + & {
        ${tw`
            bg-green-300
        `}
    }
    input:checked + &:after {
        left: calc(100% - 0.2rem);
        transform: translateX(-100%);
    }
    &:active:after {
        width: 60%;
    }
`;

export default function SwitchButton(props) {
    var [value, setValue] = useState(false);
    return <Container>
            <Label active={!value} onClick={() => {setValue(false); props.onChange(false);}}>{props.labelA}</Label>
            <Button id={props.inputId} type="checkbox" checked={value} onChange={() => {setValue(!value); props.onChange(!value);}} />
            <Graphic htmlFor={props.inputId}/>
            <Label active={value} onClick={() => {setValue(true); props.onChange(true);}}>{props.labelB}</Label>
    </Container>
}