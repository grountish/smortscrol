'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Music, Pause, Play } from 'lucide-react';

// Only one track audible at a time across the whole feed.
let currentAudio = null;

function stopOthers(audio) {
  if (currentAudio && currentAudio !== audio) {
    currentAudio.pause();
  }
  currentAudio = audio;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '--:--';
  }
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

// Deterministic pseudo-waveform so each track has a stable, unique cover.
function barsFromId(id, count = 44) {
  let seed = 0;
  for (let i = 0; i < id.length; i += 1) {
    seed = (seed * 31 + id.charCodeAt(i)) >>> 0;
  }
  const bars = [];
  for (let i = 0; i < count; i += 1) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    bars.push(16 + (seed % 84));
  }
  return bars;
}

function hueFromId(id) {
  let seed = 0;
  for (let i = 0; i < id.length; i += 1) {
    seed = (seed * 17 + id.charCodeAt(i)) >>> 0;
  }
  return seed % 360;
}

export function MusicCover({ id = '', playing = false }) {
  const bars = barsFromId(id);
  const hue = hueFromId(id);
  return (
    <div className={`musicCover${playing ? ' isPlaying' : ''}`} aria-hidden="true">
      <div className="musicCoverWash" style={{ filter: `hue-rotate(${hue}deg)` }} />
      <div className="musicCoverBadge">
        <Music size={13} strokeWidth={2.4} />
        <span>AUDIO</span>
      </div>
      <div className="musicWave">
        {bars.map((height, index) => (
          <span key={index} style={{ height: `${height}%` }} />
        ))}
      </div>
    </div>
  );
}

export function AudioPlayer({ src, onPlayingChange }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    onPlayingChange?.(playing);
  }, [playing, onPlayingChange]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    if (audio.paused) {
      stopOthers(audio);
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, []);

  const handleSeek = useCallback((event) => {
    const audio = audioRef.current;
    const next = Number(event.target.value);
    if (audio && Number.isFinite(next)) {
      audio.currentTime = next;
      setCurrent(next);
    }
  }, []);

  const pct = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div className="audioPlayer" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        className="audioPlayBtn"
        onClick={toggle}
        aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? <Pause size={18} strokeWidth={2.4} /> : <Play size={18} strokeWidth={2.4} />}
      </button>
      <span className="audioTime">{formatTime(current)}</span>
      <input
        className="audioSeek"
        type="range"
        min={0}
        max={duration || 0}
        step="0.1"
        value={Math.min(current, duration || 0)}
        onChange={handleSeek}
        aria-label="Seek"
        style={{ '--pct': `${pct}%` }}
      />
      <span className="audioTime audioDur">{formatTime(duration)}</span>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime || 0)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
        }}
      />
    </div>
  );
}
