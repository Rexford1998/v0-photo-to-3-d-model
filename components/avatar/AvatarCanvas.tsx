// Complete Three.js Avatar Canvas with loading states, error handling, and 3D rendering

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const AvatarCanvas = () => {
    const canvasRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current });
        renderer.setSize(window.innerWidth, window.innerHeight);

        // Load avatar model
        const loader = new THREE.GLTFLoader();
        loader.load('path/to/avatar.gltf', (gltf) => {
            scene.add(gltf.scene);
            setLoading(false);
        }, undefined, (err) => {
            setError('Error loading avatar');
            setLoading(false);
        });

        camera.position.z = 5;

        const animate = function () {
            requestAnimationFrame(animate);
            renderer.render(scene, camera);
        };
        animate();

        return () => {
            // Cleanup
            renderer.dispose();
        };
    }, []);

    return (
        <div>
            {loading && <p>Loading...</p>}
            {error && <p>{error}</p>}
            <canvas ref={canvasRef} />
        </div>
    );
};

export default AvatarCanvas;
