
export const playAlertSound = (type: 'success' | 'warning' | 'error') => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  if (type === 'success') {
    oscillator.frequency.value = 600;
  } else if (type === 'warning') {
    oscillator.frequency.value = 400;
  } else {
    oscillator.frequency.value = 200;
  }

  gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.2);
};
