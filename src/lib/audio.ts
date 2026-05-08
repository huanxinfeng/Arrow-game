export const audioAssets = {
  bgm: new Audio('/bgm.mp3'),
  click: new Audio('/click.mp3'),
  error: new Audio('/error.mp3'),
  win: new Audio('/win.mp3')
};

audioAssets.bgm.loop = true;

let isSoundEnabled = true;

export const playSound = (sound: 'click' | 'error' | 'win') => {
  if (!isSoundEnabled) return;
  // Clone node for overlapping sounds like clicks
  const audio = audioAssets[sound].cloneNode() as HTMLAudioElement;
  audio.volume = sound === 'win' ? 0.8 : 1.0;
  audio.play().catch(e => console.warn('Audio play failed:', e));
};

export const setMusicEnabled = (enabled: boolean) => {
  if (enabled) {
    audioAssets.bgm.play().catch(e => {
      // Ignore autoplay prevention errors before user interaction
      if (e.name !== 'NotAllowedError') {
        console.warn('BGM play failed:', e);
      }
    });
  } else {
    audioAssets.bgm.pause();
  }
};

export const setSoundEnabled = (enabled: boolean) => {
  isSoundEnabled = enabled;
};
