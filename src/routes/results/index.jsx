import React, { useRef, useState, useEffect } from "react";
import { getStroke } from "perfect-freehand";
import { ptsToSvgPath } from "../../utils"; // adjust if needed
import { io } from "socket.io-client";

import './index.scss';


const Results = () => {
  const isLocalhost = window.location.hostname !== 'daveseidman.github.io';
  const URL = isLocalhost
    ? `http://${location.hostname}:8000`
    : 'https://cocktail-generator-server.onrender.com/';

  const [submissions, setSubmissions] = useState([]);
  const socketRef = useRef();


  useEffect(() => {
    const socket = io(URL, {
      transports: ['websocket'],
      query: { role: 'results' }
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ Connected to socket server (results):', socket.id);
    });

    // TODO: change to "existing-submissions"?
    socket.on('approvedsubmissions', (data) => {
      console.log('📦 Approved submissions on boot:', data);
      setSubmissions(data.sort((a, b) => b.timestamp - a.timestamp));
    });

    socket.on('submission-updated', (submission) => {
      if (!submission.approved) {
        // Remove the denied submission from the list
        setSubmissions(prev =>
          prev.filter(s => s.timestamp !== submission.timestamp)
        );
        return;
      }

      setSubmissions(prev => {
        const alreadyExists = prev.some(s => s.timestamp === submission.timestamp);
        if (alreadyExists) {
          return prev.map(s => s.timestamp === submission.timestamp ? submission : s);
        }
        console.log('animate this submission', submission)
        return [submission, ...prev];
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <div className="results">
      <div className="submission-list">
        {submissions.map((submission) => (
          <CanvasPreview
            key={submission.timestamp}
            strokes={submission.data}
          // animated={false}
          />
        ))}
      </div>
    </div>
  );
};

const CanvasPreview = ({ strokes }) => {
  const canvasRef = useRef();
  const width = 800;
  const height = 400;

  const drawPoints = (strokesArray, clear = true) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    if (clear) ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = 'brown';

    strokesArray.forEach(stroke => {
      const input = stroke.map(p => [p.x, p.y, p.pressure]);
      const outline = getStroke(input);
      const path = new Path2D(ptsToSvgPath(outline));
      ctx.fill(path);
    });
  };

  const replay = () => {
    if (!strokes.length) return;

    const flatPoints = strokes.flat();
    let i = 1;

    const animationStart = performance.now(); // <-- FIXED: animation timeline starts now
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, width, height);

    const animate = () => {
      const now = performance.now();
      const elapsed = now - animationStart; // <-- FIXED: relative to wall-clock now

      let tempStrokes = strokes.map(() => []);
      for (let s = 0; s < strokes.length; s++) {
        for (let j = 0; j < strokes[s].length; j++) {
          const pt = strokes[s][j];
          if (pt.t <= elapsed) { // <-- FIXED: use pt.t directly
            tempStrokes[s].push(pt);
          }
        }
      }

      drawPoints(tempStrokes);

      if (flatPoints[i] && flatPoints[i].t <= elapsed) {
        i++;
      }
      if (i < flatPoints.length) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  };


  useEffect(() => {
    replay();
  }, [])

  return <canvas ref={canvasRef} width={800} height={400} className="preview-canvas" />;
};


export default Results;
