import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";

const App = () => {
  const [songInfo, setSongInfo] = useState<{ videoId: string; songTitle: string; artist: string; } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const emotions = [
    { emoji: '😊', mood: 'Happy' },
    { emoji: '😢', mood: 'Sad' },
    { emoji: '🕺', mood: 'Energetic' },
    { emoji: '❤️', mood: 'Romantic' },
    { emoji: '🧘', mood: 'Calm' },
    { emoji: '🔥', mood: 'Motivational' },
    { emoji: '😴', mood: 'Sleepy' },
    { emoji: '🤔', mood: 'Thoughtful' },
    { emoji: '😂', mood: 'Funny' },
    { emoji: '🥳', mood: 'Celebratory' },
    { emoji: '😎', mood: 'Cool' },
    { emoji: '😇', mood: 'Nostalgic' },
    { emoji: '👊', mood: 'Powerful' },
    { emoji: '✈️', mood: 'Travel' },
    { emoji: '🤝', mood: 'Friendly' },
    { emoji: '😌', mood: 'Peaceful' },
    { emoji: '😍', mood: 'In Love' },
    { emoji: '🌧️', mood: 'Rainy Day' },
    { emoji: '💪', mood: 'Workout' },
    { emoji: '🙏', mood: 'Devotional' },
  ];

  useEffect(() => {
    if (isCameraOpen && stream && videoRef.current) {
        videoRef.current.srcObject = stream;
    }
  }, [isCameraOpen, stream]);
  
  const checkVideoValidity = (videoId: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!videoId || typeof videoId !== 'string' || videoId.length < 11) {
        resolve(false);
        return;
      }
      
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = `https://img.youtube.com/vi/${videoId}/sddefault.jpg`;
    });
  };

  const getSongRecommendation = async (mood: string, emoji: string) => {
    setIsLoading(true);
    setError(null);
    setSongInfo(null);
    setSelectedEmoji(emoji);

    const MAX_ATTEMPTS = 3;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `You are an expert Kannada music recommender. Find one popular Kannada song for the mood: '${mood}'. Use Google Search to find its official or most popular music video on YouTube. You MUST respond with ONLY a valid JSON object with the format {"songTitle": "...", "artist": "...", "videoId": "..."}. The videoId must correspond to a publicly available YouTube video. Do not include any other text or markdown.`;
            
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    tools: [{googleSearch: {}}],
                }
            });

            const textResponse = response.text.trim();
            const jsonMatch = textResponse.match(/\{[\s\S]*\}/);

            if (!jsonMatch) {
                console.error(`Attempt ${attempt}: Model did not return valid JSON.`);
                continue;
            }
            
            const jsonString = jsonMatch[0];
            const parsed = JSON.parse(jsonString);

            if (parsed && parsed.videoId && parsed.songTitle && parsed.artist) {
                const isValid = await checkVideoValidity(parsed.videoId);
                if (isValid) {
                    setSongInfo(parsed);
                    setIsLoading(false);
                    return;
                } else {
                    console.warn(`Attempt ${attempt}: Video ID ${parsed.videoId} is invalid.`);
                }
            } else {
                console.error(`Attempt ${attempt}: JSON response is missing required fields.`);
            }

        } catch (e) {
            console.error(`An error occurred on attempt ${attempt}:`, e);
        }
    }

    setError('Sorry, I couldn\'t find a song right now. Please try another mood!');
    setIsLoading(false);
  };

  const getSongRecommendationFromImage = async (base64Image: string) => {
    setIsLoading(true);
    setError(null);
    setSongInfo(null);
    setSelectedEmoji('📸');

    stream?.getTracks().forEach(track => track.stop());
    setStream(null);
    setIsCameraOpen(false);

    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const imagePart = {
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: base64Image,
                },
            };
            const textPart = {
                text: `Analyze the dominant emotion of the person in this image and recommend one popular Kannada song that matches their mood. If no person is visible or the emotion is unclear, recommend a random popular upbeat Kannada song. You MUST respond with ONLY a valid JSON object with the format {"songTitle": "...", "artist": "...", "videoId": "..."}. The videoId must correspond to a publicly available YouTube video. Do not include any other text or markdown.`
            };

            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: { parts: [imagePart, textPart] },
            });

            const textResponse = response.text.trim();
            const jsonMatch = textResponse.match(/\{[\s\S]*\}/);

            if (!jsonMatch) {
                console.error(`Attempt ${attempt}: Model did not return valid JSON.`);
                continue;
            }
            
            const jsonString = jsonMatch[0];
            const parsed = JSON.parse(jsonString);

            if (parsed && parsed.videoId && parsed.songTitle && parsed.artist) {
                const isValid = await checkVideoValidity(parsed.videoId);
                if (isValid) {
                    setSongInfo(parsed);
                    setIsLoading(false);
                    return;
                } else {
                    console.warn(`Attempt ${attempt}: Video ID ${parsed.videoId} is invalid.`);
                }
            } else {
                console.error(`Attempt ${attempt}: JSON response is missing required fields.`);
            }

        } catch (e) {
            console.error(`An error occurred on attempt ${attempt}:`, e);
        }
    }
    setError('Sorry, I couldn\'t find a song based on the image. Please try again!');
    setIsLoading(false);
  };

  const handleCameraClick = async () => {
    if (isCameraOpen) {
        stream?.getTracks().forEach(track => track.stop());
        setStream(null);
        setIsCameraOpen(false);
        return;
    }
    setError(null);
    try {
        const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
        setStream(cameraStream);
        setIsCameraOpen(true);
    } catch (err) {
        setError('Camera access is required. Please allow access in your browser settings and try again.');
        console.error("Camera access denied:", err);
    }
  };

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        if (context) {
            context.save();
            // Flip the canvas horizontally to match the mirrored video
            context.scale(-1, 1);
            context.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
            context.restore();
            const dataUrl = canvas.toDataURL('image/jpeg');
            const base64Data = dataUrl.split(',')[1];
            getSongRecommendationFromImage(base64Data);
        }
    }
  };

  const CameraView = () => (
    <div style={styles.cameraOverlay}>
        <video ref={videoRef} autoPlay playsInline style={styles.videoPreview}></video>
        <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
        <div style={styles.cameraControls}>
             <button onClick={handleCameraClick} style={styles.cameraCloseButton} aria-label="Close camera">✕</button>
             <button onClick={handleCapture} style={styles.cameraCaptureButton} aria-label="Capture photo and get recommendation">
                <div style={styles.captureInnerCircle}></div>
             </button>
        </div>
    </div>
  );

  return (
    <div style={styles.container}>
      {isCameraOpen && <CameraView />}
      <div style={styles.topSection}>
        <h1 style={styles.title}>Mood Melody</h1>
        <div style={styles.emojiGrid}>
          {emotions.map(({ emoji, mood }) => (
            <button 
              key={mood} 
              style={{...styles.emojiButton, ...(selectedEmoji === emoji ? styles.selectedEmoji : {})}} 
              onClick={() => getSongRecommendation(mood, emoji)}
              aria-label={`Get a ${mood} song`}
            >
              {emoji}
            </button>
          ))}
           <button 
              style={{...styles.emojiButton, ...(selectedEmoji === '📸' ? styles.selectedEmoji : {})}} 
              onClick={handleCameraClick}
              aria-label="Get a song recommendation from your camera"
            >
              📸
            </button>
        </div>
      </div>

      <div style={styles.bottomSheet}>
        <div style={styles.handle}></div>
        <div style={styles.resultContainer}>
          {isLoading && <div style={styles.loader}></div>}
          {error && <p style={styles.errorText}>{error}</p>}
          {!isLoading && !error && !songInfo && !isCameraOpen && (
             <p style={styles.promptText}>Select a mood to start</p>
          )}
          {songInfo && !isLoading && (
            <>
              <div style={styles.songInfoContainer}>
                <h2 style={styles.songTitle}>{songInfo.songTitle}</h2>
                <p style={styles.songArtist}>{songInfo.artist}</p>
              </div>
              <div style={styles.videoWrapper}>
                <iframe
                  src={`https://www.youtube.com/embed/${songInfo.videoId}?autoplay=1`}
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={styles.iframe}
                ></iframe>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    fontFamily: "'Poppins', sans-serif",
    backgroundColor: '#1a1a1a',
    color: '#FFFFFF',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  } as React.CSSProperties,
  topSection: {
    padding: '2rem 1rem 0',
    flexShrink: 0,
  } as React.CSSProperties,
  title: {
    fontSize: '2rem',
    fontWeight: 600,
    color: '#e0e0e0',
    textAlign: 'center',
    margin: '0 0 2rem 0',
  } as React.CSSProperties,
  emojiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(60px, 1fr))',
    gap: '1rem',
    padding: '0 1rem',
    maxHeight: 'calc(100vh - 400px)',
    overflowY: 'auto',
  } as React.CSSProperties,
  emojiButton: {
    fontSize: '2.5rem',
    padding: '0.8rem',
    cursor: 'pointer',
    border: '2px solid #333',
    borderRadius: '50%',
    backgroundColor: '#282828',
    color: '#FFFFFF',
    transition: 'transform 0.2s ease, border-color 0.2s ease',
    aspectRatio: '1 / 1',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    lineHeight: 1,
  } as React.CSSProperties,
  selectedEmoji: {
    borderColor: '#FF8A00',
    transform: 'scale(1.1)',
  } as React.CSSProperties,
  bottomSheet: {
    backgroundColor: '#282828',
    borderTopLeftRadius: '24px',
    borderTopRightRadius: '24px',
    padding: '0.5rem 1rem 1rem',
    boxShadow: '0 -4px 30px rgba(0, 0, 0, 0.5)',
    marginTop: 'auto',
    width: '100%',
    minHeight: '350px',
    display: 'flex',
    flexDirection: 'column',
  } as React.CSSProperties,
  handle: {
    width: '40px',
    height: '4px',
    backgroundColor: '#555',
    borderRadius: '2px',
    margin: '0 auto 0.5rem',
  } as React.CSSProperties,
  resultContainer: {
    flex: 1,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  } as React.CSSProperties,
  loader: {
    border: '6px solid #444',
    borderTop: '6px solid #FF8A00',
    borderRadius: '50%',
    width: '50px',
    height: '50px',
    animation: 'spin 1s linear infinite',
  } as React.CSSProperties,
   promptText: {
    color: '#888',
    fontSize: '1.2rem',
  } as React.CSSProperties,
  errorText: {
    color: '#FF8A00',
    fontSize: '1.25rem',
    textAlign: 'center',
    padding: '0 1rem',
  } as React.CSSProperties,
  songInfoContainer: {
    textAlign: 'center',
    marginBottom: '1rem',
    width: '100%',
    padding: '0 1rem',
  } as React.CSSProperties,
  songTitle: {
    fontSize: '1.2rem',
    fontWeight: 600,
    color: '#ffffff',
    margin: '0 0 0.25rem 0',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  } as React.CSSProperties,
  songArtist: {
    fontSize: '1rem',
    fontWeight: 400,
    color: '#b3b3b3',
    margin: 0,
  } as React.CSSProperties,
  videoWrapper: {
    position: 'relative',
    paddingBottom: '56.25%',
    height: 0,
    width: '100%',
    maxWidth: '560px',
    overflow: 'hidden',
    borderRadius: '12px',
    backgroundColor: '#000',
  } as React.CSSProperties,
  iframe: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  } as React.CSSProperties,
  cameraOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    animation: 'fadeIn 0.3s ease',
  } as React.CSSProperties,
  videoPreview: {
    width: '100%',
    maxHeight: 'calc(100% - 150px)',
    objectFit: 'contain',
    transform: 'scaleX(-1)',
  } as React.CSSProperties,
  cameraControls: {
    position: 'absolute',
    bottom: '0',
    height: '120px',
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  } as React.CSSProperties,
  cameraCaptureButton: {
    width: '70px',
    height: '70px',
    borderRadius: '50%',
    backgroundColor: 'transparent',
    border: '5px solid white',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '2px',
    transition: 'background-color 0.2s',
  } as React.CSSProperties,
  captureInnerCircle: {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    backgroundColor: 'white',
    transition: 'transform 0.2s',
  } as React.CSSProperties,
  cameraCloseButton: {
      position: 'absolute',
      left: '30px',
      fontSize: '1.8rem',
      color: 'white',
      backgroundColor: 'rgba(40,40,40,0.7)',
      border: 'none',
      borderRadius: '50%',
      width: '50px',
      height: '50px',
      cursor: 'pointer',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      lineHeight: '50px',
  } as React.CSSProperties,
};

const keyframes = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = keyframes;
document.head.appendChild(styleSheet);


const root = createRoot(document.getElementById('root')!);
root.render(<App />);