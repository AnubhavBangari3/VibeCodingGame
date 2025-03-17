import * as React from 'react';
import { ExpoWebGLRenderingContext, GLView } from 'expo-gl';
import { Scene, PerspectiveCamera, BoxGeometry, MeshStandardMaterial, Mesh, AmbientLight, DirectionalLight, WebGLRenderer } from 'three';

export default function App() {
  let timeout: number;

  return (
    <GLView
      style={{ flex: 1 }}
      onContextCreate={async (gl: ExpoWebGLRenderingContext) => {
        // Create a WebGLRenderer without a DOM element
        const renderer = new WebGLRenderer({
          canvas: gl.canvas,
          context: gl,
          antialias: true,
        });
        renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);

        // Create a new Scene
        const scene = new Scene();

        // Create a camera
        const camera = new PerspectiveCamera(
          75,
          gl.drawingBufferWidth / gl.drawingBufferHeight,
          0.1,
          1000
        );
        camera.position.z = 5;

        // Create a cube
        const geometry = new BoxGeometry(1, 1, 1);
        const material = new MeshStandardMaterial({
          color: 0x00ff00
        });
        const cube = new Mesh(geometry, material);
        scene.add(cube);

        // Add lights
        const ambientLight = new AmbientLight(0x404040);
        scene.add(ambientLight);

        const directionalLight = new DirectionalLight(0xffffff, 1);
        directionalLight.position.set(1, 1, 1);
        scene.add(directionalLight);

        // Animation loop
        const render = () => {
          timeout = requestAnimationFrame(render);
          cube.rotation.x += 0.01;
          cube.rotation.y += 0.01;
          renderer.render(scene, camera);
          gl.endFrameEXP();
        };
        render();
      }}
    />
  );
}