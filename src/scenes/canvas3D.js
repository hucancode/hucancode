
import React from "react";
export default class Canvas3D extends React.Component {
    constructor(props) {
        super(props);
        this.state = {isInCamera: false};
        this.canvasRef = React.createRef();
        this.frameID = 0;
        this.observer = new IntersectionObserver(
            ([entry]) => {
                this.setState({isInCamera: entry.isIntersecting});
            }
        )
      }
    componentDidMount() {
        this.init();
        if(this.canvasRef.current) {
            this.observer.observe(this.canvasRef.current);
        }
    }
    componentWillUnmount() {
        this.observer.disconnect();
    }
    componentDidUpdate() {
        if (this.state.isInCamera) {
            const scope = this;
            const renderLoop = function() {
                scope.frameID = requestAnimationFrame(renderLoop);
                scope.animate();
            };
            renderLoop();
        } else {
            cancelAnimationFrame(this.frameID);
        }
    }
    render() {
        return <canvas style={{width:"100%"}} id={this.canvasID} ref={this.canvasRef} />
    }
}
