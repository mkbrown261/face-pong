# 🎮 FACE PONG — Multiplayer Webcam Battle

> A highly polished browser-based multiplayer game where you control paddles using your face!

## 🎯 Overview

**Face Pong** is a next-generation take on the classic Pong game. Two players stand side-by-side facing a webcam from the side — the game uses **MediaPipe FaceMesh** to track each player's face in real time. Move your head up and down to control your glowing neon paddle.

## ✨ Features

### Core Gameplay
- 🎭 **Real-time face tracking** via MediaPipe FaceMesh
- 👤 Left player = **glowing red paddle** | Right player = **glowing blue paddle**
- ⚡ **Progressive ball speed** — gets faster with every hit
- 🏆 **3 rounds × 60 seconds** structure
- 🎮 **Keyboard fallback** — W/S for P1, ↑↓ for P2

### Visual Effects
- 💥 **Particle explosions** on every paddle hit
- 🌈 **Dynamic color palette** changes (5 rotating color combinations)
- 🎯 **Ball motion blur streak** at high speeds
- 💫 **Neon glow trails** following the ball
- 📳 **Camera shake** on impacts
- 🔴 **Screen pulse** and chromatic aberration on big hits
- ⚡ **Final 10 seconds** dramatic red pulse mode
- 🌌 **Ambient floating particles** in the arena
- 🎨 **Animated grid background** with depth
- 💡 **Volumetric glow** on paddles and ball
- 🔵 **Hit rings** exploding outward on collision

### Audio
- 🎵 Synth collision sounds (pitch scales with combo)
- 🔊 Sub-bass impacts
- 📣 Score fanfares
- 🎶 Ambient drone
- 🎼 Final-seconds beat pulse
- 🔈 Reactive intensity based on gameplay speed

### UI/UX
- 📊 Live score display with glow animations
- ⏱️ Round timer with dramatic final seconds
- 🔥 Combo counter
- ⚡ Speed tier indicator
- 👁️ Face detection status indicators (green/red dots)
- 🏆 Cinematic game over screen with confetti
- 🔄 Round transition countdown
- 📹 Live webcam preview thumbnail

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | React 18 + TypeScript |
| **Rendering** | HTML5 Canvas 2D API (60 FPS) |
| **Face Tracking** | MediaPipe FaceMesh (CDN) |
| **State** | Zustand |
| **Audio** | Web Audio API (synthesized sounds) |
| **Build** | Vite |
| **Deploy** | Cloudflare Pages |

## 🎮 How to Play

1. **Grant camera permission** when prompted
2. **Two players** stand facing the webcam from the **side** (profile view)
3. Your face becomes your paddle — move **up and down** to control it
4. **Don't let the ball pass you!**
5. Ball speeds up every time it's hit — first to most points after 3 rounds wins

### Keyboard Fallback (no webcam needed)
- **Player 1**: `W` (up) / `S` (down)
- **Player 2**: `↑` (up) / `↓` (down)

## 🏃 Development

```bash
npm install
npm run dev       # Development server at :3000
npm run build     # Production build
npm run deploy    # Deploy to Cloudflare Pages
```

## 🌐 Deployment

- **Platform**: Cloudflare Pages
- **Status**: ✅ Live
- **Last Updated**: 2026-05-19

## 🎭 Ball Speed Tiers

| Hits | Speed Tier | Feel |
|------|-----------|------|
| 0-4 | Casual | Warm up |
| 5-9 | Warming Up | Getting interesting |
| 10-14 | Getting Hot | Real challenge |
| 15+ | INTENSE! | Pure chaos |

## 🎨 Color Palettes (rotate with hits)

1. Orange / Red
2. Purple / White  
3. Cyan / Yellow
4. Blue / Pink
5. Green / Gold
