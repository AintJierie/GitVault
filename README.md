# 📦 GitVault (v0.0.1)

**GitVault** is a powerful plugin for [Obsidian](https://obsidian.md) that integrates your GitHub projects directly into your vault. Keep track of repositories, branches, issues, and pull requests without ever leaving the app.

## 🚀 Features

### 📊 Project Management
- **Create Snapshots**: Import any public or private GitHub repository as a markdown note.
- **Project Dashboard**: Visualize all your tracked projects with a native **Contribution Heatmap** and status cards.
- **Smart Sync**: Updates statistics (Stars, Forks, Issues) while preserving your personal notes.
- **Branch Support**: Switch branches on the fly and track stats/README for specific branches.

### 🛠️ Developer Tools
- **Issue Tracker**: View and manage open issues directly in your vault.
- **Pull Request Viewer**: Browse PRs, view commit history, and inspect file diffs in a large, responsive modal.
- **View Commits**: Scroll through the commit history of your current branch and see exactly what changed.
- **Compare Repositories**: Side-by-side comparison of two repositories ("Battle Mode").

### ⚡ Automation & Polish
- **Auto-Refresh**: Background sync keeps your data up-to-date automatically.
- **Rate Limit Indicator**: Live status bar shows your remaining GitHub API quota.
- **Bulk Import**: Quickly import all your repositories at once.
- **Ribbon Menu**: Quick access to all commands via the Sidebar Icon.

---

## ⚙️ Setup

1.  **Configure GitHub Token**:
    - Go to **Settings > GitVault**.
    - Enter your **GitHub Personal Access Token** (Classic or Fine-grained).
    - *Note: A token is required to avoid strict API rate limits and to access private repos.*

---

## 📖 Usage

### Commands
Access these via the Command Palette (`Ctrl/Cmd + P`) or the Ribbon Menu:

- **`GitVault: Create from URL`**: Paste a GitHub URL to generate a note.
- **`GitVault: Create Dashboard`**: generate a comprehensive dashboard note.
- **`GitVault: Switch Branch`**: Change the tracked branch for the active note.
- **`GitVault: View Commits`**: View commit history for the current branch.
- **`GitVault: View Pull Requests`**: Browse PRs and review code.
- **`GitVault: Compare Repositories`**: Compare two repos side-by-side.

### Auto-Refresh
Enable **Auto-Refresh** in settings to keep your project stats updated in the background. You can set the interval (in minutes) to suit your workflow.

---

## 🎨 Styling
The plugin uses native [Obsidian](https://obsidian.md) variables and is fully compatible with light and dark modes. Modals are designed to be responsive, using 90% of the screen width for optimal code viewing.

---

## 📜 License
MIT License.
