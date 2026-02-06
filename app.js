const { useState, useEffect, useRef } = React;

// ============================================================================
// DATA STORAGE & AUTH
// ============================================================================

class DataStore {
  constructor() {
    this.currentUser = null;
    this.init();
  }

  init() {
    const user = localStorage.getItem('currentUser');
    if (user) {
      this.currentUser = JSON.parse(user);
    }
  }

  // Auth methods
  signup(email, password) {
    const users = JSON.parse(localStorage.getItem('users') || '{}');
    if (users[email]) {
      throw new Error('User already exists');
    }
    
    const user = {
      id: Date.now().toString(),
      email,
      password, // In production, hash this!
      created_at: new Date().toISOString()
    };
    
    users[email] = user;
    localStorage.setItem('users', JSON.stringify(users));
    return this.login(email, password);
  }

  login(email, password) {
    const users = JSON.parse(localStorage.getItem('users') || '{}');
    const user = users[email];
    
    if (!user || user.password !== password) {
      throw new Error('Invalid credentials');
    }
    
    this.currentUser = user;
    localStorage.setItem('currentUser', JSON.stringify(user));
    return user;
  }

  logout() {
    this.currentUser = null;
    localStorage.removeItem('currentUser');
  }

  getCurrentUser() {
    return this.currentUser;
  }

  // Phrase methods
  getPhrases() {
    if (!this.currentUser) return [];
    const key = `phrases_${this.currentUser.id}`;
    return JSON.parse(localStorage.getItem(key) || '[]');
  }

  addPhrase(phrase) {
    const phrases = this.getPhrases();
    const newPhrase = {
      id: Date.now().toString(),
      user_id: this.currentUser.id,
      target_language: 'da-DK',
      danish_text: phrase.danish_text,
      meaning_text: phrase.meaning_text,
      category: phrase.category || 'Other',
      status: 'Learning',
      practice_attempts_count: 0,
      correct_count: 0,
      incorrect_count: 0,
      last_practiced_at: null,
      created_at: new Date().toISOString()
    };
    
    phrases.push(newPhrase);
    const key = `phrases_${this.currentUser.id}`;
    localStorage.setItem(key, JSON.stringify(phrases));
    this.trackEvent('phrase_added');
    return newPhrase;
  }

  updatePhrase(id, updates) {
    const phrases = this.getPhrases();
    const index = phrases.findIndex(p => p.id === id);
    if (index !== -1) {
      phrases[index] = { ...phrases[index], ...updates };
      const key = `phrases_${this.currentUser.id}`;
      localStorage.setItem(key, JSON.stringify(phrases));
    }
  }

  deletePhrase(id) {
    const phrases = this.getPhrases().filter(p => p.id !== id);
    const key = `phrases_${this.currentUser.id}`;
    localStorage.setItem(key, JSON.stringify(phrases));
  }

  recordPractice(phraseId, correct) {
    const phrases = this.getPhrases();
    const phrase = phrases.find(p => p.id === phraseId);
    if (phrase) {
      phrase.practice_attempts_count++;
      if (correct) {
        phrase.correct_count++;
        // Mark as known after 3 correct answers
        if (phrase.correct_count >= 3) {
          phrase.status = 'Known';
        }
      } else {
        phrase.incorrect_count++;
      }
      phrase.last_practiced_at = new Date().toISOString();
      this.updatePhrase(phraseId, phrase);
    }
  }

  // Session tracking
  getSessions() {
    if (!this.currentUser) return [];
    const key = `sessions_${this.currentUser.id}`;
    return JSON.parse(localStorage.getItem(key) || '[]');
  }

  addSession(session) {
    const sessions = this.getSessions();
    const newSession = {
      id: Date.now().toString(),
      user_id: this.currentUser.id,
      mode: session.mode,
      items_reviewed_count: session.items_reviewed_count,
      correct_count: session.correct_count,
      incorrect_count: session.incorrect_count,
      created_at: new Date().toISOString()
    };
    
    sessions.push(newSession);
    const key = `sessions_${this.currentUser.id}`;
    localStorage.setItem(key, JSON.stringify(sessions));
    this.trackEvent('practice_completed');
    return newSession;
  }

  getWeekStats() {
    const sessions = this.getSessions();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    return sessions.filter(s => new Date(s.created_at) > oneWeekAgo).length;
  }

  trackEvent(eventName, data = {}) {
    // Simple event tracking
    const events = JSON.parse(localStorage.getItem('events') || '[]');
    events.push({
      event: eventName,
      user_id: this.currentUser?.id,
      data,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem('events', JSON.stringify(events.slice(-1000))); // Keep last 1000 events
  }
}

const db = new DataStore();

// ============================================================================
// TRANSLATION API (Mock for MVP)
// ============================================================================

async function translateToEnglish(danishText) {
  // In production, use Google Translate API or similar
  // For MVP, using a simple mock with common phrases
  const mockTranslations = {
    'hej': 'hello',
    'farvel': 'goodbye',
    'tak': 'thank you',
    'ja': 'yes',
    'nej': 'no',
    'god morgen': 'good morning',
    'god aften': 'good evening',
    'hvordan har du det': 'how are you',
    'jeg hedder': 'my name is',
    'undskyld': 'excuse me',
    'hvor er': 'where is',
    'toilettet': 'the toilet',
    'toget': 'the train',
    'bussen': 'the bus',
    'jeg forstår ikke': 'i don\'t understand',
    'taler du engelsk': 'do you speak english',
    'hvor meget koster det': 'how much does it cost',
    'jeg vil gerne have': 'i would like',
    'en kaffe': 'a coffee',
    'en øl': 'a beer',
    'vand': 'water',
    'regningen': 'the bill'
  };

  const text = danishText.toLowerCase().trim();
  if (mockTranslations[text]) {
    return mockTranslations[text];
  }
  
  // Fallback: return indication that manual translation needed
  return `[Translation for: ${danishText}]`;
}

// ============================================================================
// AI CHAT (Gemini API Integration)
// ============================================================================

async function chatWithAI(message, userPhrases, conversationHistory) {
  // Build context from user's saved phrases
  const phraseContext = userPhrases.map(p => 
    `${p.danish_text} (${p.meaning_text})`
  ).join(', ');

  const systemPrompt = `Du er en dansk sprogpartner. Svar KUN på dansk. Brug disse ord og sætninger i din samtale når det er muligt: ${phraseContext}. Hold dine svar korte (1-3 sætninger). Stil ofte spørgsmål for at holde samtalen i gang. Vær venlig og opmuntrende.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: systemPrompt,
        messages: [
          ...conversationHistory,
          { role: "user", content: message }
        ],
      })
    });

    const data = await response.json();
    const reply = data.content.find(c => c.type === 'text')?.text || 'Undskyld, jeg forstår ikke.';
    return reply;
  } catch (error) {
    console.error('AI Error:', error);
    // Fallback responses in Danish
    const fallbacks = [
      'Det lyder interessant! Fortæl mig mere.',
      'Hvad synes du om det?',
      'Hvordan har du det i dag?',
      'Hvad laver du?',
      'Det er godt! Fortsæt.'
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}

// ============================================================================
// COMPONENTS
// ============================================================================

function AuthScreen({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    
    try {
      if (isLogin) {
        db.login(email, password);
      } else {
        db.signup(email, password);
      }
      onLogin();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">🇩🇰 Danish Deck</h1>
          <p className="text-gray-600">Learn Danish your way</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors"
          >
            {isLogin ? 'Log In' : 'Sign Up'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ onNavigate, phrases }) {
  const learningCount = phrases.filter(p => p.status === 'Learning').length;
  const knownCount = phrases.filter(p => p.status === 'Known').length;
  const weekSessions = db.getWeekStats();
  const recentPhrases = phrases.slice(-5).reverse();
  const weeklyGoal = 3;

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-b-3xl">
        <h1 className="text-2xl font-bold mb-1">Danish Deck</h1>
        <p className="text-blue-100">Your personal learning journey</p>
      </div>

      {/* Primary CTAs */}
      <div className="px-4 space-y-3">
        <button
          onClick={() => onNavigate('add')}
          className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold text-lg shadow-lg hover:bg-blue-700 active:scale-98 transition-all"
        >
          ➕ Add New Phrase
        </button>
        
        <button
          onClick={() => onNavigate('practice')}
          className="w-full bg-purple-600 text-white py-4 rounded-xl font-semibold text-lg shadow-lg hover:bg-purple-700 active:scale-98 transition-all"
          disabled={phrases.length === 0}
        >
          🎯 Practice Now
        </button>
      </div>

      {/* Stats */}
      <div className="px-4">
        <h2 className="text-lg font-bold text-gray-800 mb-3">Your Progress</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white p-4 rounded-xl shadow text-center">
            <div className="text-3xl font-bold text-blue-600">{phrases.length}</div>
            <div className="text-xs text-gray-600 mt-1">Total Phrases</div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow text-center">
            <div className="text-3xl font-bold text-yellow-600">{learningCount}</div>
            <div className="text-xs text-gray-600 mt-1">Learning</div>
          </div>
          <div className="bg-white p-4 rounded-xl shadow text-center">
            <div className="text-3xl font-bold text-green-600">{knownCount}</div>
            <div className="text-xs text-gray-600 mt-1">Known</div>
          </div>
        </div>
      </div>

      {/* Weekly Goal */}
      <div className="px-4">
        <div className="bg-white p-5 rounded-xl shadow">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold text-gray-800">Weekly Goal</h3>
            <span className="text-sm text-gray-600">{weekSessions}/{weeklyGoal} sessions</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all"
              style={{ width: `${Math.min((weekSessions / weeklyGoal) * 100, 100)}%` }}
            ></div>
          </div>
          {weekSessions >= weeklyGoal && (
            <p className="text-sm text-green-600 mt-2 font-medium">🎉 Goal achieved!</p>
          )}
        </div>
      </div>

      {/* Recent Phrases */}
      {recentPhrases.length > 0 && (
        <div className="px-4">
          <h2 className="text-lg font-bold text-gray-800 mb-3">Recently Added</h2>
          <div className="space-y-2">
            {recentPhrases.map(phrase => (
              <div key={phrase.id} className="bg-white p-4 rounded-xl shadow">
                <div className="font-semibold text-gray-800">{phrase.danish_text}</div>
                <div className="text-sm text-gray-600">{phrase.meaning_text}</div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                    {phrase.category}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    phrase.status === 'Known' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {phrase.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {phrases.length === 0 && (
        <div className="px-4 py-8 text-center">
          <div className="text-6xl mb-4">📚</div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Start Your Journey</h3>
          <p className="text-gray-600">Add your first Danish phrase to begin learning!</p>
        </div>
      )}
    </div>
  );
}

function AddPhrase({ onNavigate, onPhraseAdded }) {
  const [danishText, setDanishText] = useState('');
  const [meaningText, setMeaningText] = useState('');
  const [category, setCategory] = useState('Other');
  const [isTranslating, setIsTranslating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const categories = ['Travel', 'Work', 'Food', 'Social', 'Daily Life', 'Other'];

  const handleTranslate = async () => {
    if (!danishText.trim()) return;
    
    setIsTranslating(true);
    try {
      const translation = await translateToEnglish(danishText);
      setMeaningText(translation);
    } catch (error) {
      alert('Translation failed. Please enter meaning manually.');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSave = () => {
    if (!danishText.trim() || !meaningText.trim()) {
      alert('Please fill in both Danish text and meaning');
      return;
    }

    db.addPhrase({
      danish_text: danishText.trim(),
      meaning_text: meaningText.trim(),
      category
    });

    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
    
    onPhraseAdded();
  };

  const handleAddAnother = () => {
    setDanishText('');
    setMeaningText('');
    setCategory('Other');
  };

  return (
    <div className="p-4 pb-24 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Add New Phrase</h1>
        <button
          onClick={() => onNavigate('dashboard')}
          className="text-gray-600 hover:text-gray-800"
        >
          ✕
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Danish Phrase *
          </label>
          <textarea
            value={danishText}
            onChange={(e) => setDanishText(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows="3"
            placeholder="Enter Danish text..."
          />
        </div>

        <button
          onClick={handleTranslate}
          disabled={!danishText.trim() || isTranslating}
          className="w-full bg-gray-100 text-gray-800 py-3 rounded-xl font-medium hover:bg-gray-200 active:bg-gray-300 disabled:opacity-50 transition-colors"
        >
          {isTranslating ? '🔄 Translating...' : '🌐 Translate'}
        </button>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Meaning *
          </label>
          <textarea
            value={meaningText}
            onChange={(e) => setMeaningText(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows="3"
            placeholder="Enter meaning in your language..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleSave}
          className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold text-lg shadow-lg hover:bg-blue-700 active:bg-blue-800 transition-colors"
        >
          💾 Save Phrase
        </button>
      </div>

      {showSuccess && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-2xl p-8 max-w-sm mx-4 text-center">
            <div className="text-6xl mb-4">✅</div>
            <h3 className="text-xl font-bold text-gray-800 mb-4">Phrase Saved!</h3>
            <div className="space-y-2">
              <button
                onClick={handleAddAnother}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700"
              >
                Add Another
              </button>
              <button
                onClick={() => onNavigate('practice')}
                className="w-full bg-purple-600 text-white py-3 rounded-xl font-semibold hover:bg-purple-700"
              >
                Practice Now
              </button>
              <button
                onClick={() => onNavigate('dashboard')}
                className="w-full bg-gray-200 text-gray-800 py-3 rounded-xl font-semibold hover:bg-gray-300"
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PhraseLibrary({ onNavigate, phrases }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [editingPhrase, setEditingPhrase] = useState(null);

  const categories = ['All', 'Travel', 'Work', 'Food', 'Social', 'Daily Life', 'Other'];
  const statuses = ['All', 'Learning', 'Known'];

  const filteredPhrases = phrases.filter(phrase => {
    const matchesSearch = phrase.danish_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         phrase.meaning_text.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'All' || phrase.category === filterCategory;
    const matchesStatus = filterStatus === 'All' || phrase.status === filterStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this phrase?')) {
      db.deletePhrase(id);
      onNavigate('library');
    }
  };

  return (
    <div className="pb-24">
      <div className="sticky top-0 bg-white z-10 p-4 border-b space-y-3">
        <h1 className="text-2xl font-bold text-gray-800">Phrase Library</h1>
        
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search phrases..."
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
        />

        <div className="flex gap-2">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            {statuses.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {filteredPhrases.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-3">🔍</div>
            <p className="text-gray-600">No phrases found</p>
          </div>
        ) : (
          filteredPhrases.map(phrase => (
            <div key={phrase.id} className="bg-white p-4 rounded-xl shadow">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="font-semibold text-gray-800 text-lg">{phrase.danish_text}</div>
                  <div className="text-gray-600 mt-1">{phrase.meaning_text}</div>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                      {phrase.category}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      phrase.status === 'Known' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {phrase.status}
                    </span>
                  </div>
                  {phrase.practice_attempts_count > 0 && (
                    <div className="text-xs text-gray-500 mt-2">
                      Practiced {phrase.practice_attempts_count} times • 
                      {phrase.correct_count > 0 && ` ✓ ${phrase.correct_count}`}
                      {phrase.incorrect_count > 0 && ` ✗ ${phrase.incorrect_count}`}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(phrase.id)}
                  className="text-red-500 hover:text-red-700 ml-2"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function PracticeMenu({ onNavigate, phrases }) {
  return (
    <div className="p-4 pb-24 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Choose Practice Mode</h1>

      <div className="space-y-3">
        <button
          onClick={() => onNavigate('flashcards')}
          className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-xl shadow-lg active:scale-98 transition-all"
          disabled={phrases.length === 0}
        >
          <div className="text-4xl mb-2">🎴</div>
          <div className="text-xl font-bold">Flashcards</div>
          <div className="text-blue-100 text-sm mt-1">Swipe through your phrases</div>
        </button>

        <button
          onClick={() => onNavigate('quiz')}
          className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white p-6 rounded-xl shadow-lg active:scale-98 transition-all"
          disabled={phrases.length === 0}
        >
          <div className="text-4xl mb-2">✍️</div>
          <div className="text-xl font-bold">Quiz</div>
          <div className="text-purple-100 text-sm mt-1">Test your knowledge</div>
        </button>

        <button
          onClick={() => onNavigate('chat')}
          className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-xl shadow-lg active:scale-98 transition-all"
          disabled={phrases.length < 10}
        >
          <div className="text-4xl mb-2">💬</div>
          <div className="text-xl font-bold">AI Chat</div>
          <div className="text-green-100 text-sm mt-1">
            {phrases.length < 10 
              ? `Add ${10 - phrases.length} more phrases to unlock` 
              : 'Practice conversations in Danish'}
          </div>
        </button>
      </div>

      {phrases.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-600 mb-4">Add some phrases first to start practicing!</p>
          <button
            onClick={() => onNavigate('add')}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold"
          >
            Add Phrases
          </button>
        </div>
      )}
    </div>
  );
}

function Flashcards({ onNavigate, phrases }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionStats, setSessionStats] = useState({
    correct: 0,
    learning: 0,
    reviewed: 0
  });
  const [showSummary, setShowSummary] = useState(false);

  const currentPhrase = phrases[currentIndex];

  const handleAnswer = (knew) => {
    db.recordPractice(currentPhrase.id, knew);
    
    setSessionStats(prev => ({
      correct: prev.correct + (knew ? 1 : 0),
      learning: prev.learning + (knew ? 0 : 1),
      reviewed: prev.reviewed + 1
    }));

    if (currentIndex < phrases.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    } else {
      db.addSession({
        mode: 'flashcard',
        items_reviewed_count: phrases.length,
        correct_count: sessionStats.correct + (knew ? 1 : 0),
        incorrect_count: sessionStats.learning + (knew ? 0 : 1)
      });
      setShowSummary(true);
    }
  };

  if (showSummary) {
    const accuracy = sessionStats.reviewed > 0 
      ? Math.round((sessionStats.correct / sessionStats.reviewed) * 100) 
      : 0;

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Session Complete!</h2>
          
          <div className="space-y-3 mb-6">
            <div className="bg-blue-50 p-4 rounded-xl">
              <div className="text-3xl font-bold text-blue-600">{sessionStats.reviewed}</div>
              <div className="text-sm text-gray-600">Cards Reviewed</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 p-3 rounded-xl">
                <div className="text-2xl font-bold text-green-600">{sessionStats.correct}</div>
                <div className="text-xs text-gray-600">Known</div>
              </div>
              <div className="bg-yellow-50 p-3 rounded-xl">
                <div className="text-2xl font-bold text-yellow-600">{sessionStats.learning}</div>
                <div className="text-xs text-gray-600">Learning</div>
              </div>
            </div>
            <div className="bg-purple-50 p-4 rounded-xl">
              <div className="text-3xl font-bold text-purple-600">{accuracy}%</div>
              <div className="text-sm text-gray-600">Accuracy</div>
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => {
                setCurrentIndex(0);
                setIsFlipped(false);
                setSessionStats({ correct: 0, learning: 0, reviewed: 0 });
                setShowSummary(false);
              }}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold"
            >
              Practice Again
            </button>
            <button
              onClick={() => onNavigate('dashboard')}
              className="w-full bg-gray-200 text-gray-800 py-3 rounded-xl font-semibold"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4 flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => onNavigate('practice')}
          className="text-gray-600 hover:text-gray-800"
        >
          ← Back
        </button>
        <div className="text-sm text-gray-600">
          {currentIndex + 1} / {phrases.length}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div
          className="w-full max-w-md h-96 cursor-pointer"
          onClick={() => setIsFlipped(!isFlipped)}
        >
          <div className={`relative w-full h-full card-flip ${isFlipped ? 'flipped' : ''}`}>
            <div className="absolute inset-0 card-front">
              <div className="w-full h-full bg-white rounded-3xl shadow-2xl p-8 flex flex-col items-center justify-center">
                <div className="text-sm text-gray-500 mb-4">Danish</div>
                <div className="text-3xl font-bold text-gray-800 text-center mb-8">
                  {currentPhrase.danish_text}
                </div>
                <div className="text-sm text-gray-400">Tap to reveal</div>
              </div>
            </div>
            <div className="absolute inset-0 card-back">
              <div className="w-full h-full bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl shadow-2xl p-8 flex flex-col items-center justify-center">
                <div className="text-sm text-blue-100 mb-4">Meaning</div>
                <div className="text-3xl font-bold text-white text-center">
                  {currentPhrase.meaning_text}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isFlipped && (
        <div className="space-y-3 mt-6">
          <button
            onClick={() => handleAnswer(true)}
            className="w-full bg-green-600 text-white py-4 rounded-xl font-semibold text-lg shadow-lg active:bg-green-700"
          >
            ✓ I knew it
          </button>
          <button
            onClick={() => handleAnswer(false)}
            className="w-full bg-yellow-600 text-white py-4 rounded-xl font-semibold text-lg shadow-lg active:bg-yellow-700"
          >
            📚 Still learning
          </button>
        </div>
      )}
    </div>
  );
}

function Quiz({ onNavigate, phrases }) {
  const [mode, setMode] = useState(null); // 'danish-to-meaning' or 'meaning-to-danish'
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [sessionStats, setSessionStats] = useState({
    correct: 0,
    incorrect: 0,
    reviewed: 0
  });
  const [showSummary, setShowSummary] = useState(false);

  const currentPhrase = phrases[currentIndex];

  const checkAnswer = () => {
    const correct = mode === 'danish-to-meaning'
      ? userAnswer.toLowerCase().trim() === currentPhrase.meaning_text.toLowerCase().trim()
      : userAnswer.toLowerCase().trim() === currentPhrase.danish_text.toLowerCase().trim();
    
    setIsCorrect(correct);
    setShowFeedback(true);
    
    db.recordPractice(currentPhrase.id, correct);
    
    setSessionStats(prev => ({
      correct: prev.correct + (correct ? 1 : 0),
      incorrect: prev.incorrect + (correct ? 0 : 1),
      reviewed: prev.reviewed + 1
    }));
  };

  const nextQuestion = () => {
    if (currentIndex < phrases.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setUserAnswer('');
      setShowFeedback(false);
    } else {
      db.addSession({
        mode: 'quiz',
        items_reviewed_count: phrases.length,
        correct_count: sessionStats.correct,
        incorrect_count: sessionStats.incorrect
      });
      setShowSummary(true);
    }
  };

  if (!mode) {
    return (
      <div className="p-4 pb-24 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">Quiz Mode</h1>
          <button
            onClick={() => onNavigate('practice')}
            className="text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => setMode('danish-to-meaning')}
            className="w-full bg-blue-600 text-white p-6 rounded-xl shadow-lg"
          >
            <div className="text-xl font-bold mb-2">Danish → Meaning</div>
            <div className="text-blue-100 text-sm">Type the meaning in English</div>
          </button>

          <button
            onClick={() => setMode('meaning-to-danish')}
            className="w-full bg-purple-600 text-white p-6 rounded-xl shadow-lg"
          >
            <div className="text-xl font-bold mb-2">Meaning → Danish</div>
            <div className="text-purple-100 text-sm">Type the Danish phrase</div>
          </button>
        </div>
      </div>
    );
  }

  if (showSummary) {
    const accuracy = sessionStats.reviewed > 0 
      ? Math.round((sessionStats.correct / sessionStats.reviewed) * 100) 
      : 0;

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">🏆</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Quiz Complete!</h2>
          
          <div className="space-y-3 mb-6">
            <div className="bg-blue-50 p-4 rounded-xl">
              <div className="text-3xl font-bold text-blue-600">{sessionStats.reviewed}</div>
              <div className="text-sm text-gray-600">Questions</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 p-3 rounded-xl">
                <div className="text-2xl font-bold text-green-600">{sessionStats.correct}</div>
                <div className="text-xs text-gray-600">Correct</div>
              </div>
              <div className="bg-red-50 p-3 rounded-xl">
                <div className="text-2xl font-bold text-red-600">{sessionStats.incorrect}</div>
                <div className="text-xs text-gray-600">Missed</div>
              </div>
            </div>
            <div className="bg-purple-50 p-4 rounded-xl">
              <div className="text-3xl font-bold text-purple-600">{accuracy}%</div>
              <div className="text-sm text-gray-600">Score</div>
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => {
                setMode(null);
                setCurrentIndex(0);
                setUserAnswer('');
                setShowFeedback(false);
                setSessionStats({ correct: 0, incorrect: 0, reviewed: 0 });
                setShowSummary(false);
              }}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold"
            >
              Try Again
            </button>
            <button
              onClick={() => onNavigate('dashboard')}
              className="w-full bg-gray-200 text-gray-800 py-3 rounded-xl font-semibold"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  const question = mode === 'danish-to-meaning' 
    ? currentPhrase.danish_text 
    : currentPhrase.meaning_text;
  
  const correctAnswer = mode === 'danish-to-meaning'
    ? currentPhrase.meaning_text
    : currentPhrase.danish_text;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4 flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={() => setMode(null)}
          className="text-gray-600"
        >
          ← Back
        </button>
        <div className="text-sm text-gray-600">
          {currentIndex + 1} / {phrases.length}
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="text-sm text-gray-500 mb-3">
            {mode === 'danish-to-meaning' ? 'What does this mean?' : 'How do you say this in Danish?'}
          </div>
          <div className="text-3xl font-bold text-gray-800 mb-6">
            {question}
          </div>

          <input
            type="text"
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !showFeedback && userAnswer && checkAnswer()}
            placeholder="Type your answer..."
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={showFeedback}
            autoFocus
          />
        </div>

        {showFeedback ? (
          <div className="space-y-4">
            <div className={`p-6 rounded-2xl ${isCorrect ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="text-4xl mb-2">{isCorrect ? '✓' : '✗'}</div>
              <div className={`font-bold text-lg mb-2 ${isCorrect ? 'text-green-800' : 'text-red-800'}`}>
                {isCorrect ? 'Correct!' : 'Not quite'}
              </div>
              {!isCorrect && (
                <div className="text-gray-700">
                  Correct answer: <span className="font-semibold">{correctAnswer}</span>
                </div>
              )}
            </div>
            
            <button
              onClick={nextQuestion}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold text-lg"
            >
              {currentIndex < phrases.length - 1 ? 'Next Question' : 'Finish Quiz'}
            </button>
          </div>
        ) : (
          <button
            onClick={checkAnswer}
            disabled={!userAnswer.trim()}
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold text-lg disabled:opacity-50"
          >
            Check Answer
          </button>
        )}
      </div>
    </div>
  );
}

function AIChat({ onNavigate, phrases }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hej! Jeg er klar til at øve dansk med dig. Hvad vil du tale om?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    db.trackEvent('chat_started');
  }, []);

  const sendMessage = async (text) => {
    if (!text.trim() || isLoading) return;

    const userMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const conversationHistory = messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }));

      const reply = await chatWithAI(text, phrases, conversationHistory);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      db.trackEvent('messages_in_chat');
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Undskyld, jeg kan ikke svare lige nu. Prøv igen senere.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickActions = [
    { label: '❓ Quiz me', text: 'Kan du teste mig?' },
    { label: '💬 Small talk', text: 'Lad os snakke om vejret' },
    { label: '✈️ Travel', text: 'Jeg skal rejse til Danmark' },
    { label: '📝 5 questions', text: 'Stil mig 5 spørgsmål' }
  ];

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">AI Practice Chat</h1>
            <p className="text-green-100 text-sm">Øv din dansk 🇩🇰</p>
          </div>
          <button
            onClick={() => onNavigate('practice')}
            className="text-white"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] p-4 rounded-2xl ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-800 p-4 rounded-2xl">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      {messages.length <= 2 && (
        <div className="px-4 pb-2">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {quickActions.map((action, idx) => (
              <button
                key={idx}
                onClick={() => sendMessage(action.text)}
                className="bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap hover:bg-green-200"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t bg-white p-4 fixed bottom-0 left-0 right-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage(input)}
            placeholder="Skriv på dansk..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-green-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="bg-green-600 text-white px-6 py-3 rounded-full font-semibold hover:bg-green-700 disabled:opacity-50"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}

function BottomNav({ currentView, onNavigate }) {
  const navItems = [
    { id: 'dashboard', icon: '🏠', label: 'Home' },
    { id: 'add', icon: '➕', label: 'Add' },
    { id: 'practice', icon: '🎯', label: 'Practice' },
    { id: 'library', icon: '📚', label: 'Library' }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-bottom">
      <div className="flex justify-around py-2">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex flex-col items-center px-4 py-2 rounded-lg transition-colors ${
              currentView === item.id
                ? 'text-blue-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <div className="text-2xl mb-1">{item.icon}</div>
            <div className="text-xs font-medium">{item.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN APP
// ============================================================================

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const user = db.getCurrentUser();
    setIsAuthenticated(!!user);
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    db.logout();
    setIsAuthenticated(false);
    setCurrentView('dashboard');
  };

  const handleNavigate = (view) => {
    setCurrentView(view);
    setRefreshKey(prev => prev + 1);
  };

  const handlePhraseAdded = () => {
    setRefreshKey(prev => prev + 1);
  };

  if (!isAuthenticated) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  const phrases = db.getPhrases();

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard onNavigate={handleNavigate} phrases={phrases} />;
      case 'add':
        return <AddPhrase onNavigate={handleNavigate} onPhraseAdded={handlePhraseAdded} />;
      case 'library':
        return <PhraseLibrary key={refreshKey} onNavigate={handleNavigate} phrases={phrases} />;
      case 'practice':
        return <PracticeMenu onNavigate={handleNavigate} phrases={phrases} />;
      case 'flashcards':
        return phrases.length > 0 ? (
          <Flashcards onNavigate={handleNavigate} phrases={phrases} />
        ) : (
          <PracticeMenu onNavigate={handleNavigate} phrases={phrases} />
        );
      case 'quiz':
        return phrases.length > 0 ? (
          <Quiz onNavigate={handleNavigate} phrases={phrases} />
        ) : (
          <PracticeMenu onNavigate={handleNavigate} phrases={phrases} />
        );
      case 'chat':
        return phrases.length >= 10 ? (
          <AIChat onNavigate={handleNavigate} phrases={phrases} />
        ) : (
          <PracticeMenu onNavigate={handleNavigate} phrases={phrases} />
        );
      default:
        return <Dashboard onNavigate={handleNavigate} phrases={phrases} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {renderView()}
      {!['flashcards', 'quiz', 'chat'].includes(currentView) && (
        <BottomNav currentView={currentView} onNavigate={handleNavigate} />
      )}
      
      {/* Logout button (top right on dashboard) */}
      {currentView === 'dashboard' && (
        <button
          onClick={handleLogout}
          className="fixed top-4 right-4 text-gray-600 hover:text-gray-800 text-sm"
        >
          Logout
        </button>
      )}
    </div>
  );
}

// Render the app
ReactDOM.render(<App />, document.getElementById('root'));
