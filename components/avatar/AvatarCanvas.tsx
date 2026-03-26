import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Loader } from './Loader';

const AvatarCanvas = () => {
  return (
    <Canvas>
      <Suspense fallback={<Loader />}> {/* Show loading state */}
        {/* Add your 3D scene components here */}
        <OrbitControls /> {/* Add controls to the canvas */}
      </Suspense>
    </Canvas>
  );
};

export default AvatarCanvas;
