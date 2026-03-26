// Import necessary libraries
import React, { useEffect, useRef } from 'react';
import { createAvatar } from './avatarUtils'; // Assuming createAvatar is imported from somewhere

interface AvatarCanvasProps {
  headUrl: string;
}

const AvatarCanvas: React.FC<AvatarCanvasProps> = ({ headUrl }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('webgl') || canvas.getContext('2d');
      if (ctx) {
        // Check if headUrl is of image type or GLB
        if (headUrl.endsWith('.glb')) {
          // Load the GLB model
          createAvatar(ctx, headUrl, true);
        } else {
          // Load image
          const img = new Image();
          img.src = headUrl;
          img.onload = () => {
            createAvatar(ctx, img, false);
          };
        }
      }
    }
  }, [headUrl]);

  return <canvas ref={canvasRef} width={500} height={500} />;
};

export default AvatarCanvas;