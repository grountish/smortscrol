'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

export function AudioPlayer({ src, tracks, onPlayingChange }) {
  const audioRef = useRef(null);
  const autoPlayRef = useRef(false);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  // A single-track card and a full album share one transport; normalise both
  // into a list so the rest of the component doesn't care which it got.
  const list = useMemo(
    () =>
      Array.isArray(tracks) && tracks.length
        ? tracks
        : src
          ? [{ n: 1, name: '', audioUrl: src, seconds: 0 }]
          : [],
    [tracks, src],
  );

  const safeIndex = Math.min(index, Math.max(list.length - 1, 0));
  const activeTrack = list[safeIndex];
  const isAlbum = list.length > 1;

  useEffect(() => {
    onPlayingChange?.(playing);
  }, [playing, onPlayingChange]);

  // Reset when the card is recycled onto a different release.
  useEffect(() => {
    autoPlayRef.current = false;
    setIndex(0);
    setCurrent(0);
    setDuration(0);
  }, [list]);

  const playTrack = useCallback(
    (nextIndex) => {
      const audio = audioRef.current;
      if (!audio || !list[nextIndex]) {
        return;
      }

      if (nextIndex === safeIndex) {
        if (audio.paused) {
          stopOthers(audio);
          audio.play().catch(() => {});
        } else {
          audio.pause();
        }
        return;
      }

      // The src swap is driven by state, so flag the load to start playing
      // once the new track's metadata lands.
      autoPlayRef.current = true;
      stopOthers(audio);
      setCurrent(0);
      setDuration(0);
      setIndex(nextIndex);
    },
    [list, safeIndex],
  );

  const toggle = useCallback(() => {
    playTrack(safeIndex);
  }, [playTrack, safeIndex]);

  const handleSeek = useCallback((event) => {
    const audio = audioRef.current;
    const next = Number(event.target.value);
    if (audio && Number.isFinite(next)) {
      audio.currentTime = next;
      setCurrent(next);
    }
  }, []);

  const handleEnded = useCallback(() => {
    setCurrent(0);
    if (safeIndex < list.length - 1) {
      autoPlayRef.current = true;
      setDuration(0);
      setIndex(safeIndex + 1);
      return;
    }
    setPlaying(false);
  }, [list.length, safeIndex]);

  const handleLoadedMetadata = useCallback((event) => {
    const audio = event.currentTarget;
    setDuration(audio.duration || 0);
    if (autoPlayRef.current) {
      autoPlayRef.current = false;
      stopOthers(audio);
      audio.play().catch(() => {});
    }
  }, []);

  if (!activeTrack) {
    return null;
  }

  const pct = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div className="audioAlbum" onClick={(event) => event.stopPropagation()}>
      <div className="audioPlayer">
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
          src={activeTrack.audioUrl}
          preload="metadata"
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime || 0)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={handleEnded}
        />
      </div>

      {isAlbum ? (
        <>
          <p className="audioNowPlaying">
            <span>
              {safeIndex + 1} / {list.length}
            </span>
            {activeTrack.name}
          </p>
          <ol className="audioTracklist">
            {list.map((track, trackIndex) => {
              const isActive = trackIndex === safeIndex;
              return (
                <li key={`${track.audioUrl}-${trackIndex}`}>
                  <button
                    type="button"
                    className={`audioTrack${isActive ? ' isActive' : ''}`}
                    onClick={() => playTrack(trackIndex)}
                    aria-current={isActive ? 'true' : undefined}>
                    <span className="audioTrackNum">
                      {isActive && playing ? (
                        <Pause size={11} strokeWidth={2.8} />
                      ) : (
                        track.n || trackIndex + 1
                      )}
                    </span>
                    <span className="audioTrackName">{track.name}</span>
                    {track.seconds ? (
                      <span className="audioTrackLen">{formatTime(track.seconds)}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="audioAlbumNote">30s preview per track</p>
        </>
      ) : null}
    </div>
  );
}
