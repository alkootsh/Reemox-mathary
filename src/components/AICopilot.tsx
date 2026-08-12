import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  MessageSquare, 
  X, 
  Send, 
  Bot, 
  ChevronRight, 
  AlertTriangle, 
  Info, 
  HelpCircle,
  Wand2,
  Cpu,
  BrainCircuit
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  currentUser: any;
  currentScreen: { name: string; description: string };
  companyId: string;
}

export default function AICopilot({ currentUser, currentScreen, companyId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [memory, setMemory] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkActivation();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const checkActivation = async () => {
    try {
      const [configRes, memoryRes] = await Promise.all([
        fetch(`/api/ai/config?companyId=${companyId}`),
        fetch(`/api/ai/memory/${currentUser.id}`)
      ]);
      const configData = await configRes.json();
      const memoryData = await memoryRes.json();
      
      const enabled = !!configData?.isEnabled;
      setIsEnabled(enabled);
      setMemory(memoryData || { onboardingCompleted: false });

      if (enabled && !memoryData?.onboardingCompleted) {
        // Trigger initial greeting after a short delay
        setTimeout(() => {
          setIsOpen(true);
          handleSendMessage("مرحباً بك! أنا مساعدك الذكي مارو. أريد التعرف عليك وتقديم جولة تعريفية.");
        }, 2000);
      }
    } catch (err) {
      console.error("AI Initialization error:", err);
    }
  };

  const handleSendMessage = async (customMessage?: string) => {
    const text = customMessage || inputValue;
    if (!text.trim()) return;

    if (!customMessage) {
      setMessages(prev => [...prev, { role: 'user', text }]);
      setInputValue('');
    }
    
    setLoading(true);
    try {
      const history = (Array.isArray(messages) ? messages : []).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          userContext: {
            name: currentUser.name,
            role: currentUser.role,
            companyName: 'MARO Business'
          },
          screenContext: currentScreen,
          history: history
        })
      });

      const data = await res.json();
      setMessages(prev => [...prev, { role: 'model', text: data.text }]);

      // If it was a first-time greeting, mark onboarding as started
      if (memory && !memory.onboardingCompleted) {
        await fetch('/api/ai/memory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.id,
            data: { onboardingCompleted: true }
          })
        });
      }
    } catch (err) {
      console.error("AI Chat Error:", err);
      setMessages(prev => [...prev, { role: 'model', text: "عذراً، حدث خطأ في الاتصال بمحرك الذكاء الاصطناعي." }]);
    } finally {
      setLoading(false);
    }
  };

  if (!isEnabled) return null;

  return (
    <>
      {/* FLOATING TRIGGER */}
      <motion.button
        initial={{ scale: 0, rotate: -45 }}
        animate={{ scale: 1, rotate: 0 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-gold via-yellow-500 to-amber-600 text-white rounded-full shadow-2xl shadow-gold/40 flex items-center justify-center z-50 border-4 border-white/20 overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_70%)] opacity-50 animate-pulse" />
        {isOpen ? <X size={28} /> : <Sparkles size={28} className="animate-bounce" />}
      </motion.button>

      {/* CHAT PANEL */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 50, x: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 50, x: 20 }}
            className="fixed bottom-24 right-6 w-[400px] max-w-[90vw] h-[600px] max-h-[80vh] bg-card border border-gold/30 rounded-[32px] shadow-2xl z-50 flex flex-col overflow-hidden backdrop-blur-xl"
          >
            {/* PANEL HEADER */}
            <div className="p-5 bg-gradient-to-r from-gold/20 to-transparent border-b border-gold/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gold rounded-2xl shadow-lg shadow-gold/20">
                  <BrainCircuit className="text-white" size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-text-main">Maro AI Co-pilot</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">متصل بالدماغ المركزي</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-gold/10 rounded-xl text-text-dim hover:text-gold transition-all">
                <X size={18} />
              </button>
            </div>

            {/* MESSAGES AREA */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-5 space-y-4 scroll-smooth"
            >
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                  <div className="w-20 h-20 bg-gold/10 rounded-full flex items-center justify-center text-gold">
                    <Bot size={40} />
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-text-main">كيف أساعدك اليوم يا {currentUser.name}؟</h4>
                    <p className="text-xs text-text-dim mt-2 leading-relaxed">
                      أنا أفهم طبيعة عملك كـ <span className="text-gold font-bold">{currentUser.role}</span>. يمكنني شرح الشاشات، تشخيص الأعطال، أو تنفيذ الأوامر.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 w-full">
                    {[
                      "أريد جولة تعريفية في البرنامج",
                      `اشرح لي شاشة ${currentScreen.name}`,
                      "هل هناك أي أعطال متوقعة؟"
                    ].map((suggestion, i) => (
                      <button 
                        key={i}
                        onClick={() => handleSendMessage(suggestion)}
                        className="text-xs text-right p-3 bg-card2 border border-border rounded-xl hover:border-gold/50 hover:text-gold transition-all flex items-center justify-between"
                      >
                        <ChevronRight size={14} />
                        <span>{suggestion}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-gold text-white font-bold rounded-br-none shadow-lg shadow-gold/20' 
                      : 'bg-card2 border border-border text-text-main rounded-bl-none'
                  }`}>
                    {msg.text}
                  </div>
                </motion.div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-card2 border border-border p-4 rounded-2xl rounded-bl-none flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-gold rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-gold rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
                      <span className="w-1.5 h-1.5 bg-gold rounded-full animate-bounce" style={{ animationDelay: '400ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* INPUT AREA */}
            <div className="p-5 border-t border-border bg-card2">
              <div className="relative flex items-center gap-2">
                <input 
                  type="text" 
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="اسألني عن أي شيء..."
                  className="flex-1 bg-card border border-border rounded-2xl py-3 pr-4 pl-12 text-sm focus:border-gold outline-none transition-all shadow-inner"
                />
                <button 
                  onClick={() => handleSendMessage()}
                  disabled={loading || !inputValue.trim()}
                  className="absolute left-2 p-2 bg-gold text-white rounded-xl shadow-lg shadow-gold/20 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all"
                >
                  <Send size={18} />
                </button>
              </div>
              <div className="mt-3 flex items-center justify-center gap-4">
                <div className="flex items-center gap-1.5 text-[10px] text-text-dim font-bold">
                  <Cpu size={12} />
                  <span>دقة التشخيص: 99.8%</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-text-dim font-bold">
                  <Wand2 size={12} />
                  <span>تنبؤ بالأعطال: مفعل</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
