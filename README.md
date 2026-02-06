# 🇩🇰 Danish Deck - Mobile Language Learning App

A mobile-first web app for self-directed Danish learning. Build your personal phrase library, practice with flashcards and quizzes, and chat with AI using your saved content.

## 🚀 Quick Deploy to GitHub Pages (2 Minutes!)

### Step 1: Create a New Repository

1. Go to [GitHub.com](https://github.com) and log in
2. Click the **"+"** in the top right → **"New repository"**
3. Name it: `danish-deck` (or any name you like)
4. Make it **Public**
5. **DO NOT** check "Add a README file"
6. Click **"Create repository"**

### Step 2: Upload Files

You have two options:

#### **Option A: Upload via Web (Easiest)**

1. On your new repository page, click **"uploading an existing file"**
2. Drag and drop ALL these files:
   - `index.html`
   - `app.js`
   - `manifest.json`
   - `icon-192.png`
   - `icon-512.png`
   - `README.md` (this file)
3. Click **"Commit changes"**

#### **Option B: Use Git (If you're comfortable with command line)**

```bash
# Download all files to a folder called 'danish-deck'
cd danish-deck

# Initialize git
git init
git add .
git commit -m "Initial commit"

# Connect to your GitHub repo (replace YOUR-USERNAME)
git remote add origin https://github.com/YOUR-USERNAME/danish-deck.git
git branch -M main
git push -u origin main
```

### Step 3: Enable GitHub Pages

1. In your repository, go to **Settings** (top menu)
2. Scroll down to **Pages** (left sidebar)
3. Under **Source**, select **"main"** branch
4. Click **Save**
5. Wait 1-2 minutes for deployment

### Step 4: Get Your URL

Your app will be live at:
```
https://YOUR-USERNAME.github.io/danish-deck/
```

Example: If your username is `john-doe`, it'll be:
```
https://john-doe.github.io/danish-deck/
```

## 📱 Add to iPhone Home Screen

1. **Open Safari** on your iPhone
2. Go to your GitHub Pages URL
3. Tap the **Share button** (square with arrow)
4. Scroll down and tap **"Add to Home Screen"**
5. Tap **"Add"**
6. Now you have a Danish Deck app icon! 🎉

## ✨ Features

### Core Learning
- ✅ **Add Phrases** - Build your personal Danish library
- ✅ **Smart Translation** - Auto-translate or enter manually
- ✅ **Categories** - Organize by Travel, Work, Food, Social, Daily Life
- ✅ **Progress Tracking** - See Learning vs Known status

### Practice Modes
- 🎴 **Flashcards** - Mobile swipe-style cards with tap-to-flip
- ✍️ **Quiz Mode** - Type answers in both directions
- 💬 **AI Chat** - Practice conversations in Danish (unlocks at 10+ phrases)

### Progress & Stats
- 📊 Weekly goal tracking (3 sessions per week)
- 📈 Practice statistics per phrase
- 🎯 Mastery system (3 correct → Known)

## 💾 Data Storage

- All your data is stored in **browser localStorage**
- Data persists between sessions on the same device/browser
- **Important**: Your data is stored locally on YOUR device, not on GitHub
- To backup: Export your browser data or use the same device

## 🔧 Technical Details

- **Frontend**: React (via CDN)
- **Styling**: Tailwind CSS
- **Storage**: Browser localStorage
- **AI**: Anthropic Claude API (for chat feature)
- **Translation**: Mock API (ready for Google Translate integration)

## 📝 Future Enhancements

- Real translation API integration
- Backend database for cross-device sync
- Spaced repetition algorithm
- Audio pronunciation
- Export/import phrases
- Multiple language support

## 🆘 Troubleshooting

**App won't load?**
- Make sure all files are in the root directory
- Check that GitHub Pages is enabled in Settings
- Wait a few minutes for deployment

**Data not saving?**
- Don't use Private/Incognito mode
- Check browser storage isn't full
- Use the same browser each time

**AI Chat not working?**
- The AI feature requires the Anthropic API
- For production, you'd need to add API configuration
- Currently uses fallback Danish responses

## 📄 License

MIT License - Feel free to modify and use!

---

Made with ❤️ for Danish learners

Need help? Check the GitHub Issues tab or create a new issue.
