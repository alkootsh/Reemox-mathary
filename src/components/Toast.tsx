import { useEffect } from 'react';
import { playSuccessSound, playWarningSound } from '../lib/sound';

interface ToastProps {
  message: string;
  type?: 'success' | 'warning' | 'error';
  onClose: () => void;
}

export default function Toast({ message, type = 'success', onClose }: ToastProps) {
  useEffect(() => {
    if (type === 'success') {
      playSuccessSound();
    } else {
      playWarningSound();
    }
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [onClose, type]);

  const bgColor = type === 'success' 
    ? 'bg-green-600 text-white border-green-500' 
    : type === 'warning'
    ? 'bg-amber-600 text-white border-amber-500'
    : 'bg-red-600 text-white border-red-500';

  const icon = type === 'success' ? '✅' : type === 'warning' ? '⚠️' : '❌';

  return (
    <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-2xl shadow-2xl z-[100] flex items-center gap-3 border font-bold text-sm transition-all animate-bounce ${bgColor}`}>
      <span className="text-lg">{icon}</span>
      <span>{message}</span>
    </div>
  );
}
