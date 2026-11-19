import * as THREE from 'three';
import { LOCAL_IMAGES } from '../assets/iconImages';

export interface ArenaTextures {
  groundColor: THREE.Texture;
  groundBump: THREE.CanvasTexture;
  containerBump: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  dispose: () => void;
}

export function createArenaTextures(renderer: THREE.WebGLRenderer): ArenaTextures {
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const loader = new THREE.TextureLoader();

  const groundColor = loader.load(LOCAL_IMAGES.arenaGroundTile);
  groundColor.colorSpace = THREE.SRGBColorSpace;
  groundColor.wrapS = THREE.RepeatWrapping;
  groundColor.wrapT = THREE.RepeatWrapping;
  groundColor.repeat.set(16, 16);
  groundColor.anisotropy = maxAniso;

  // Procedural concrete micro-relief bump map
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 256;
  bumpCanvas.height = 256;
  const bCtx = bumpCanvas.getContext('2d')!;
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3200; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const v = Math.floor(95 + Math.random() * 70);
    bCtx.fillStyle = `rgb(${v},${v},${v})`;
    bCtx.fillRect(x, y, 2, 2);
  }
  bCtx.strokeStyle = '#383838';
  bCtx.lineWidth = 3;
  bCtx.strokeRect(1.5, 1.5, 253, 253);
  const groundBump = new THREE.CanvasTexture(bumpCanvas);
  groundBump.wrapS = THREE.RepeatWrapping;
  groundBump.wrapT = THREE.RepeatWrapping;
  groundBump.repeat.set(16, 16);
  groundBump.anisotropy = maxAniso;

  // Corrugated steel bump map for shipping containers
  const corrCanvas = document.createElement('canvas');
  corrCanvas.width = 256;
  corrCanvas.height = 64;
  const cCtx = corrCanvas.getContext('2d')!;
  for (let x = 0; x < 256; x++) {
    const wave = Math.sin((x / 256) * Math.PI * 16) * 0.5 + 0.5;
    const v = Math.floor(60 + wave * 160);
    cCtx.fillStyle = `rgb(${v},${v},${v})`;
    cCtx.fillRect(x, 0, 1, 64);
  }
  const containerBump = new THREE.CanvasTexture(corrCanvas);
  containerBump.wrapS = THREE.RepeatWrapping;
  containerBump.wrapT = THREE.RepeatWrapping;
  containerBump.repeat.set(3, 1);

  // Soft radial contact shadow disc
  const shadCanvas = document.createElement('canvas');
  shadCanvas.width = 128;
  shadCanvas.height = 128;
  const sCtx = shadCanvas.getContext('2d')!;
  const grad = sCtx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0,0,0,0.65)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.28)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  sCtx.fillStyle = grad;
  sCtx.fillRect(0, 0, 128, 128);
  const contactShadow = new THREE.CanvasTexture(shadCanvas);

  return {
    groundColor,
    groundBump,
    containerBump,
    contactShadow,
    dispose: () => {
      groundColor.dispose();
      groundBump.dispose();
      containerBump.dispose();
      contactShadow.dispose();
    },
  };
}
