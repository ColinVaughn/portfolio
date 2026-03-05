# Face Detection

Real-time face detection and tracking using your webcam, running entirely client-side in the browser. Skills demo recreating a face detection pipeline from past contracted work.

**Demo:** [colinvaughn.xyz/FaceDetection](https://colinvaughn.xyz/FaceDetection/)

## Features

- **Real-time face detection** - TinyFaceDetector model optimized for browser performance
- **Bounding box rendering** - styled boxes with corner accents and confidence score labels
- **Live stats overlay** - face count, FPS, and average confidence displayed in real-time
- **Webcam management** - clean start/stop lifecycle with error handling for permissions and missing devices

## Stack

| Technology    | Role                                    |
| ------------- | --------------------------------------- |
| face-api.js   | Face detection (TinyFaceDetector model) |
| TensorFlow.js | Neural network inference backend        |
| WebRTC        | Webcam access via getUserMedia          |
| Canvas API    | Bounding box and label rendering        |
| JavaScript    | Application logic and detection loop    |
| HTML / CSS    | UI and styling                          |

## Files

```
FaceDetection/
├── index.html    Page and UI
├── style.css     Project-specific styles
└── face.js       Detection model, webcam, rendering loop
```

## License

All Rights Reserved. This source code is provided for portfolio review purposes only. You may not copy, modify, distribute, or use any part of this code without explicit written permission.
