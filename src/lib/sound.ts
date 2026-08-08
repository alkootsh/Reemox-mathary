export function playSuccessSound() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const now = audioCtx.currentTime;
    
    // Play a pleasant two-tone chime (C5 -> G5)
    [523.25, 783.99].forEach((freq, index) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + (index * 0.1));
      
      gain.gain.setValueAtTime(0.15, now + (index * 0.1));
      gain.gain.exponentialRampToValueAtTime(0.001, now + (index * 0.1) + 0.3);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start(now + (index * 0.1));
      osc.stop(now + (index * 0.1) + 0.3);
    });
  } catch (e) {
    console.error('Audio play error:', e);
  }
}

export function playWarningSound() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const now = audioCtx.currentTime;
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(329.63, now); // E4
    osc.frequency.setValueAtTime(246.94, now + 0.15); // B3
    
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start(now);
    osc.stop(now + 0.35);
  } catch (e) {
    console.error('Audio warning error:', e);
  }
}
