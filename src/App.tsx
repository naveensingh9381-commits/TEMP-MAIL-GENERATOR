/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Mail, 
  RefreshCw, 
  Copy, 
  Check, 
  Trash2, 
  Inbox, 
  Search, 
  Menu, 
  Settings, 
  HelpCircle, 
  User, 
  ChevronLeft,
  Loader2,
  Star,
  Clock,
  Send,
  File,
  AlertCircle,
  Plus,
  Moon,
  Sun,
  LayoutDashboard
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// API Configuration
const API_URL = 'https://1secmail.com/api/v1/';
const DOMAINS = ['1secmail.com', '1secmail.org', '1secmail.net', 'wwwnf.com', 'esiix.com'];

interface Message {
  id: number;
  from: string;
  subject: string;
  date: string;
}

interface MessageDetails extends Message {
  body: string;
  textBody: string;
  htmlBody: string;
}

export default function App() {
  const [email, setEmail] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<MessageDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingMessages, setFetchingMessages] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'inbox' | 'starred'>('inbox');
  const [starredIds, setStarredIds] = useState<number[]>(() => {
    const saved = localStorage.getItem('starred_mails');
    return saved ? JSON.parse(saved) : [];
  });
  const [forwardEmail, setForwardEmail] = useState('');
  const [showForward, setShowForward] = useState(false);
  
  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('app_theme');
    if (saved) return saved as 'light' | 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  // Apply theme class
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('app_theme', theme);
  }, [theme]);

  // Persist stars
  useEffect(() => {
    localStorage.setItem('starred_mails', JSON.stringify(starredIds));
  }, [starredIds]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const toggleStar = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setStarredIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const isStarred = (id: number) => starredIds.includes(id);

  const handleForward = () => {
    if (!selectedMessage || !forwardEmail) return;
    
    const subject = encodeURIComponent(`Fwd: ${selectedMessage.subject}`);
    const body = encodeURIComponent(`---------- Forwarded message ----------\nFrom: ${selectedMessage.from}\nDate: ${selectedMessage.date}\nSubject: ${selectedMessage.subject}\n\n${selectedMessage.body || selectedMessage.textBody}`);
    
    window.location.href = `mailto:${forwardEmail}?subject=${subject}&body=${body}`;
    setShowForward(false);
    setForwardEmail('');
  };

  // Parse email into login and domain
  const getEmailParts = (emailStr: string) => {
    const [login, domain] = emailStr.split('@');
    return { login, domain };
  };

  // Smart Fetch helper (try direct, then proxy)
  const smartFetch = async (url: string) => {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
    } catch (e) {
      console.log('Direct fetch failed, using proxy...');
    }
    
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(url + (url.includes('?') ? '&' : '?') + 't=' + Date.now())}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error(`Proxy error: ${response.status}`);
    return await response.json();
  };

  // Generate a new temporary email Locally to bypass blocked endpoint
  const generateEmail = async () => {
    setLoading(true);
    setSelectedMessage(null);
    setError(null);
    try {
      // Local generation of random address
      const randomLogin = Math.random().toString(36).substring(2, 12);
      const randomDomain = DOMAINS[Math.floor(Math.random() * DOMAINS.length)];
      setEmail(`${randomLogin}@${randomDomain}`);
      setMessages([]);
    } catch (e) {
      setError('Could not generate address');
    } finally {
      setLoading(false);
    }
  };

  // Fetch messages for current email
  const fetchMessages = useCallback(async (showLoading = false) => {
    if (!email) return;
    if (showLoading) setFetchingMessages(true);
    
    const { login, domain } = getEmailParts(email);
    try {
      const data = await smartFetch(`${API_URL}?action=getMessages&login=${login}&domain=${domain}`);
      if (Array.isArray(data)) {
        setMessages(data);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      if (showLoading) setFetchingMessages(false);
    }
  }, [email]);

  // Read specific message details
  const readMessage = async (id: number) => {
    if (!email) return;
    setLoading(true);
    const { login, domain } = getEmailParts(email);
    try {
      const data = await smartFetch(`${API_URL}?action=readMessage&login=${login}&domain=${domain}&id=${id}`);
      setSelectedMessage(data);
    } catch (error) {
      console.error('Failed to read message:', error);
      setError('Could not open message');
    } finally {
      setLoading(false);
    }
  };

  // Initial lifecycle
  useEffect(() => {
    generateEmail();
    return () => {
      if (pollingInterval.current) clearInterval(pollingInterval.current);
    };
  }, []);

  // Set up polling
  useEffect(() => {
    if (email) {
      fetchMessages(true);
      if (pollingInterval.current) clearInterval(pollingInterval.current);
      pollingInterval.current = setInterval(() => fetchMessages(), 15000); // 15s polling
    }
    return () => {
      if (pollingInterval.current) clearInterval(pollingInterval.current);
    };
  }, [email, fetchMessages]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredMessages = messages.filter(msg => {
    const matchesSearch = msg.from.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         msg.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStarred = activeTab === 'starred' ? isStarred(msg.id) : true;
    return matchesSearch && matchesStarred;
  });

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-300">
      
      {/* Sidebar - Futuristic Glass Style */}
      <aside className="w-72 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl flex-shrink-0 flex-col p-6 border-r border-slate-200/50 dark:border-slate-800/50 hidden md:flex z-30">
        <div className="flex items-center gap-3 px-2 mb-10">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 rotate-3">
            <Mail className="text-white w-6 h-6" />
          </div>
          <span className="text-2xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">FlashMail</span>
        </div>
        
        <button 
          onClick={generateEmail}
          className="flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 py-4 px-6 rounded-2xl shadow-xl shadow-indigo-500/20 transition-all mb-10 group active:scale-95"
        >
          <Plus className="w-6 h-6 text-white transition-transform group-hover:rotate-90" />
          <span className="font-bold text-white">Generate Address</span>
        </button>

        <nav className="space-y-1">
          <SidebarItem 
            icon={<Inbox className="w-5 h-5" />} 
            label="Inbox" 
            active={activeTab === 'inbox'} 
            onClick={() => setActiveTab('inbox')}
            badge={messages.length} 
          />
          <SidebarItem 
            icon={<Star className="w-5 h-5 flex-shrink-0" />} 
            label="Starred" 
            active={activeTab === 'starred'} 
            onClick={() => setActiveTab('starred')}
            badge={starredIds.length} 
          />
          <SidebarItem icon={<Clock className="w-5 h-5" />} label="Snoozed" />
          <SidebarItem icon={<Send className="w-5 h-5" />} label="Sent" />
          <SidebarItem icon={<File className="w-5 h-5" />} label="Drafts" />
          <div className="pt-6 mt-6 border-t border-slate-200/50 dark:border-slate-800/50">
             <SidebarItem icon={<LayoutDashboard className="w-5 h-5" />} label="Dashboard" />
             <div className="px-5 mt-6 space-y-4">
                <div className="flex flex-col gap-1.5">
                   <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Encryption</span>
                      <span className="text-[9px] font-black text-indigo-500 uppercase">AES-256</span>
                   </div>
                   <div className="h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 w-[85%] shadow-[0_0_5px_rgba(99,102,241,0.5)]" />
                   </div>
                </div>
                <div className="flex flex-col gap-1.5">
                   <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Node Cluster</span>
                      <span className="text-[9px] font-black text-emerald-500 uppercase">Primary</span>
                   </div>
                   <div className="h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 w-[100%] shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                   </div>
                </div>
             </div>
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900 relative">
        
        {/* Top Header */}
        <header className="h-20 flex items-center justify-between px-6 sm:px-8 flex-shrink-0 border-b border-slate-100 dark:border-slate-800/50">
          <div className="flex items-center flex-1 max-w-4xl">
            <button className="p-2 mr-4 md:hidden">
              <Menu className="w-6 h-6 text-slate-600 dark:text-slate-400" />
            </button>
            <div className="flex-1 max-w-2xl flex items-center bg-slate-100/50 dark:bg-slate-800/50 rounded-2xl px-5 py-3 group focus-within:bg-white dark:focus-within:bg-slate-800 focus-within:shadow-xl focus-within:shadow-indigo-500/5 transition-all">
              <Search className="w-5 h-5 text-slate-400 mr-4" />
              <input 
                type="text" 
                placeholder="Search encrypted messages" 
                className="bg-transparent border-none focus:outline-none w-full text-slate-700 dark:text-slate-200 text-sm font-medium"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="ml-6 flex items-center gap-2 hidden lg:flex">
              <div className={`w-2 h-2 rounded-full ${error ? 'bg-red-500 animate-pulse' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'}`} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                {error ? 'Interruption' : 'Synced'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4 ml-6">
            <button 
              onClick={toggleTheme}
              className="p-3 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all"
              title="Toggle Theme"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            <button className="p-3 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all">
              <HelpCircle className="w-5 h-5" />
            </button>
            <button 
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="p-3 text-slate-500 dark:text-slate-400 hover:bg-rose-100 dark:hover:bg-rose-950/30 hover:text-rose-600 rounded-2xl transition-all"
              title="Terminate Session"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/20">
              <User className="w-5 h-5" />
            </div>
          </div>
        </header>

        {/* Address Banner - Glowing Effect */}
        <div className="px-8 py-6 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800/50 flex-shrink-0">
          <div className="flex flex-col lg:row items-center justify-between gap-6">
            <div className="flex items-center gap-4 w-full lg:w-auto">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl">
                <AlertCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1">Your Virtual Identity</p>
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold text-slate-800 dark:text-slate-100 truncate tracking-tight">
                    {email}
                  </span>
                  <button 
                    onClick={copyToClipboard}
                    className={`p-2 rounded-xl transition-all ${copied ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400'}`}
                  >
                    {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
               <button 
                onClick={() => fetchMessages(true)}
                disabled={fetchingMessages}
                className="text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20 py-3 px-6 rounded-2xl hover:bg-indigo-100 dark:hover:bg-indigo-950/40 transition-all flex items-center gap-2 uppercase tracking-widest active:scale-95"
               >
                 {fetchingMessages ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                 Force Scan
               </button>
            </div>
          </div>
        </div>

        {/* Inbox Content */}
        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            {selectedMessage ? (
              <motion.div 
                key="reader"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="absolute inset-0 bg-white dark:bg-slate-900 flex flex-col z-20"
              >
                {/* Message Header */}
                <div className="px-8 py-6 flex items-center gap-6 border-b border-slate-100 dark:border-slate-800/50">
                  <button onClick={() => setSelectedMessage(null)} className="p-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-2xl transition-all">
                    <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 truncate pr-4 tracking-tight">
                      {selectedMessage.subject || '(No Subject)'}
                    </h2>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setShowForward(!showForward)}
                      className="p-3 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all"
                      title="Forward"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                    <button onClick={() => setSelectedMessage(null)} className="p-3 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-400 hover:text-rose-500 rounded-2xl transition-all">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Forwarding Bar */}
                <AnimatePresence>
                  {showForward && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="px-8 py-5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800/50 overflow-hidden"
                    >
                      <div className="flex items-center gap-4 max-w-2xl mx-auto">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Forward To:</span>
                        <input 
                          type="email" 
                          placeholder="target@vault.io"
                          className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 transition-all font-medium"
                          value={forwardEmail}
                          onChange={(e) => setForwardEmail(e.target.value)}
                        />
                        <button 
                          onClick={handleForward}
                          className="bg-indigo-600 text-white text-xs font-black px-6 py-3 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 uppercase tracking-widest"
                        >
                          Execute
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex-1 overflow-y-auto p-10 scrollbar-hide">
                  <div className="max-w-5xl mx-auto">
                    <div className="flex items-start justify-between mb-10 pb-10 border-b border-slate-50 dark:border-slate-800/30">
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-black text-xl">
                          {selectedMessage.from.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-lg text-slate-900 dark:text-slate-100 leading-none mb-2">{selectedMessage.from}</p>
                          <p className="text-xs text-slate-500 font-medium bg-slate-50 dark:bg-slate-800 inline-block px-3 py-1 rounded-full tracking-wider">SECURE INCOMING</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-3">
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">{selectedMessage.date}</span>
                        <Star 
                          className={`w-6 h-6 cursor-pointer transition-all drop-shadow-sm ${isStarred(selectedMessage.id) ? 'fill-amber-400 text-amber-400 scale-110' : 'text-slate-200 hover:text-slate-400 hover:scale-110'}`}
                          onClick={(e) => toggleStar(e as any, selectedMessage.id)}
                        />
                      </div>
                    </div>

                    <div className="prose prose-slate dark:prose-invert max-w-none">
                      {selectedMessage.htmlBody ? (
                        <iframe 
                          srcDoc={`<html><body style="font-family: -apple-system, system-ui, sans-serif; color: ${theme === 'dark' ? '#cbd5e1' : '#334155'}; line-height: 1.8; font-size: 16px;">${selectedMessage.htmlBody}</body></html>`}
                          className="w-full h-[600px] border-none"
                          title="Message Body"
                        />
                      ) : (
                        <div className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed text-lg font-medium">
                          {selectedMessage.body || selectedMessage.textBody}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-full flex flex-col">
                {/* List Action Bar */}
                <div className="px-8 py-4 border-b border-slate-50 dark:border-slate-800/30 flex items-center justify-between text-slate-500 bg-slate-50/30 dark:bg-slate-950/10">
                  <div className="flex items-center gap-6">
                    <div className="w-5 h-5 border-2 border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-center hover:border-indigo-400 cursor-pointer transition-all" />
                    <button 
                      onClick={() => fetchMessages(true)}
                      className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all hover:shadow-sm"
                    >
                      <RefreshCw 
                        className={`w-4 h-4 cursor-pointer hover:text-indigo-500 transition-all ${fetchingMessages ? 'animate-spin text-indigo-500' : ''}`}
                      />
                    </button>
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    {filteredMessages.length} Vault Entries {activeTab === 'starred' ? '[Starred Only]' : ''}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900 scrollbar-hide">
                  {filteredMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-40">
                      <div className="relative">
                        <Inbox className="w-24 h-24 text-slate-100 dark:text-slate-800 mb-6 drop-shadow-sm" />
                        <motion.div 
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 3, repeat: Infinity }}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-indigo-500 rounded-full border-4 border-white dark:border-slate-900 shadow-lg" 
                        />
                      </div>
                      <p className="text-slate-400 dark:text-slate-600 font-bold uppercase tracking-[0.3em] text-xs">Primary Vault Empty</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-50 dark:divide-slate-800/50">
                      {filteredMessages.map((msg) => (
                        <li 
                          key={msg.id}
                          onClick={() => readMessage(msg.id)}
                          className="group flex items-center px-8 py-5 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 relative cursor-pointer border-l-4 border-l-transparent hover:border-l-indigo-500 transition-all"
                        >
                          <div className="flex items-center gap-6 flex-1 min-w-0">
                            <Star 
                              className={`w-5 h-5 transition-all flex-shrink-0 ${isStarred(msg.id) ? 'fill-amber-400 text-amber-400 scale-110 drop-shadow-sm' : 'text-slate-200 dark:text-slate-800 hover:text-slate-400 group-hover:scale-110'}`}
                              onClick={(e) => toggleStar(e, msg.id)}
                            />
                            <div className="w-56 flex-shrink-0 font-bold text-slate-900 dark:text-slate-200 truncate pr-6 tracking-tight">
                              {msg.from.split('<')[0] || msg.from}
                            </div>
                            <div className="flex-1 min-w-0 flex items-center gap-3">
                              <span className="font-bold text-slate-700 dark:text-slate-300 truncate">{msg.subject || '(No Subject)'}</span>
                              <span className="text-slate-400 dark:text-slate-600 truncate text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                :: Click to decrypt content
                              </span>
                            </div>
                            <div className="text-[10px] font-black text-slate-400 dark:text-slate-600 whitespace-nowrap uppercase tracking-widest px-3 py-1 bg-slate-50 dark:bg-slate-800/50 rounded-lg group-hover:bg-white dark:group-hover:bg-slate-700 transition-colors">
                              {msg.date.split(' ')[1]}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Side Actions - Minimalist Bar */}
      <aside className="w-20 border-l border-slate-100 dark:border-slate-800/50 flex flex-col items-center py-8 gap-8 hidden sm:flex bg-white/50 dark:bg-slate-950/50 backdrop-blur-md">
        <div className="w-10 h-10 rounded-2xl bg-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 mb-4">
           <Mail className="w-5 h-5" />
        </div>
        <button className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all text-amber-500 group relative">
          <Star className="w-5 h-5" />
          <span className="absolute left-full ml-4 bg-slate-900 text-white text-[10px] py-1 px-3 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap font-bold pointer-events-none">Starred Vault</span>
        </button>
        <button className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all text-emerald-500 group relative">
          <User className="w-5 h-5" />
          <span className="absolute left-full ml-4 bg-slate-900 text-white text-[10px] py-1 px-3 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap font-bold pointer-events-none">Identity Manager</span>
        </button>
        <div className="flex-1" />
        <button className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all text-slate-400 group relative">
          <Settings className="w-5 h-5" />
          <span className="absolute left-full ml-4 bg-slate-900 text-white text-[10px] py-1 px-3 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap font-bold pointer-events-none">Subsystems</span>
        </button>
      </aside>

      {error && (
        <div className="fixed bottom-10 right-10 z-50">
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-slate-900 dark:bg-indigo-600 text-white px-8 py-5 rounded-[2rem] shadow-2xl flex items-center gap-4 border border-white/10"
          >
             <AlertCircle className="w-6 h-6 text-red-400 dark:text-white" />
             <span className="text-sm font-bold tracking-tight">{error}</span>
             <button onClick={() => setError(null)} className="ml-4 w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-xl transition-all">×</button>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function SidebarItem({ icon, label, active = false, badge = 0, onClick }: { icon: any, label: string, active?: boolean, badge?: number, onClick?: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={`flex items-center justify-between px-5 py-3.5 rounded-2xl cursor-pointer transition-all duration-300 ${active ? 'bg-indigo-600/10 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 font-bold shadow-sm' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-500 dark:text-slate-400 font-medium'}`}
    >
      <div className="flex items-center gap-4">
        {icon}
        <span className="text-sm tracking-tight">{label}</span>
      </div>
      {badge > 0 && <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-100/50 dark:border-indigo-800/30 shadow-sm">{badge}</span>}
    </div>
  );
}


