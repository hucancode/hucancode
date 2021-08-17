import React from "react";
import './App.css';
import Navbar from "./components/navBar";
import SaborScene from "./components/saborScene";

export default function App() {
  return (
    <div className="App">
      <header className="App-header">
        <Navbar />
        <SaborScene />
      </header>
    </div>
  )
}