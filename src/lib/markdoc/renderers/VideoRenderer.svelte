<script>
  /** @type {{ src: string, poster?: string, controls?: boolean, autoplay?: boolean, loop?: boolean, muted?: boolean, width?: string, height?: string }} */
  let { 
    src, 
    poster, 
    controls = true, 
    autoplay = false, 
    loop = false, 
    muted = false,
    width = '100%',
    height = 'auto'
  } = $props();
</script>

<div class="video-container">
  <video 
    {src}
    {poster}
    {controls}
    {autoplay}
    {loop}
    {muted}
    {width}
    {height}
    playsinline
  >
    Your browser does not support the video tag.
  </video>
</div>

<style>
  .video-container {
    width: 100%;
    margin: 2rem 0;
  }
  
  video {
    max-width: 100%;
    height: auto;
    border-radius: 0.5rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }
</style>