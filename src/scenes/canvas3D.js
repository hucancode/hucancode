import React from "react";

export default class Canvas3D extends React.Component {
    constructor(props) {
        super(props);
        this.state = { isInCamera: false };
        this.canvasRef = React.createRef();
        this.frameID = 0;
    }
    componentDidMount() {
        this.init();
        this.observer = new IntersectionObserver(
            ([entry]) => {
                this.setState({ isInCamera: entry.isIntersecting });
            }
        )
        if (this.canvasRef.current) {
            this.observer.observe(this.canvasRef.current);
        }
    }
    componentWillUnmount() {
        this.observer.disconnect();
    }
    componentDidUpdate() {
        if (this.state.isInCamera) {
            const scope = this;
            const renderLoop = function () {
                scope.frameID = requestAnimationFrame(renderLoop);
                scope.animate();
            };
            renderLoop();
        } else {
            cancelAnimationFrame(this.frameID);
        }
    }
    render() {
        return <canvas className="w-full" id={this.canvasID} ref={this.canvasRef} />
    }
}
