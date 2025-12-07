import { App, Modal, Setting, Notice, setIcon, normalizePath } from 'obsidian';
import { ProjectSnapshotSettings } from '../settings';
import { GitHubAPI, RepoData } from '../github/api';
import { formatDistanceToNow } from 'date-fns';

export class CompareReposCommand {
    constructor(
        private app: App,
        private settings: ProjectSnapshotSettings,
        private githubAPI: GitHubAPI
    ) { }

    async execute() {
        new CompareModal(this.app, this.settings, this.githubAPI, async (repos) => {
            await this.generateComparison(repos);
        }).open();
    }

    async generateComparison(repos: RepoData[]) {
        if (repos.length < 2) {
            new Notice('Need at least 2 repositories to compare.');
            return;
        }

        const content = this.generateComparisonNote(repos);

        // Sanitize filename
        const names = repos.map(r => r.repo).join(' vs ');
        const safeNames = names.replace(/[\/\\:*?"<>|]/g, '-'); // Windows invalid chars
        const fileName = `Compare ${safeNames}.md`;

        const folder = this.settings.defaultFolder;
        const filePath = normalizePath(folder ? `${folder}/${fileName}` : fileName);

        try {
            // Ensure folder exists
            if (folder) {
                const folderPath = normalizePath(folder);
                if (!this.app.vault.getAbstractFileByPath(folderPath)) {
                    await this.app.vault.createFolder(folderPath);
                }
            }

            const existing = this.app.vault.getAbstractFileByPath(filePath);
            if (existing) {
                await this.app.vault.modify(existing as any, content);
                new Notice(`Updated: ${fileName}`);
            } else {
                await this.app.vault.create(filePath, content);
                new Notice(`Created: ${fileName}`);
            }

            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file) {
                await this.app.workspace.getLeaf().openFile(file as any);
            }
        } catch (e: any) {
            console.error(e);
            new Notice(`Error creating comparison note: ${e.message}`);
        }
    }

    generateComparisonNote(repos: RepoData[]): string {
        const maxStars = Math.max(...repos.map(r => r.stars));
        const maxForks = Math.max(...repos.map(r => r.forks));
        const maxIssues = Math.max(...repos.map(r => r.openIssues));

        return `---
tags:
  - project-comparison
  - github
date: ${new Date().toISOString()}
---

# ⚔️ Repository Comparison

<div style="text-align: center; margin: 20px 0;">
    <span style="font-size: 1.5em; font-weight: bold;">${repos.map(r => r.repo).join(' vs ')}</span>
</div>

## 📊 Side by Side

<div style="display: grid; grid-template-columns: repeat(${repos.length}, 1fr); gap: 16px; margin: 20px 0;">
${repos.map(r => `<div style="background: var(--background-secondary); border-radius: 12px; padding: 20px; text-align: center;">
    <div style="font-size: 1.3em; font-weight: bold; margin-bottom: 12px; border-bottom: 2px solid var(--interactive-accent); padding-bottom: 12px;">
        <a href="${r.url}" style="color: var(--text-normal);">${r.repo}</a>
    </div>
    <div style="color: var(--text-muted); font-size: 0.9em; margin-bottom: 16px; min-height: 40px;">${r.description || 'No description'}</div>
    <div style="display: flex; flex-direction: column; gap: 12px;">
        <div style="background: var(--background-primary); padding: 12px; border-radius: 8px;">
            <div style="font-size: 1.8em; font-weight: bold; color: #f59e0b;">⭐ ${r.stars.toLocaleString()}</div>
            <div style="color: var(--text-muted); font-size: 0.8em;">Stars</div>
        </div>
        <div style="background: var(--background-primary); padding: 12px; border-radius: 8px;">
            <div style="font-size: 1.8em; font-weight: bold; color: #8b5cf6;">🍴 ${r.forks.toLocaleString()}</div>
            <div style="color: var(--text-muted); font-size: 0.8em;">Forks</div>
        </div>
        <div style="background: var(--background-primary); padding: 12px; border-radius: 8px;">
            <div style="font-size: 1.8em; font-weight: bold; color: ${r.openIssues > 20 ? '#ef4444' : '#22c55e'};">🐛 ${r.openIssues}</div>
            <div style="color: var(--text-muted); font-size: 0.8em;">Open Issues</div>
        </div>
    </div>
    <div style="margin-top: 16px; padding: 8px; background: var(--background-primary); border-radius: 6px; font-size: 0.9em;">
        💻 ${r.language || 'Unknown'}
    </div>
</div>`).join('\n')}
</div>

## 📈 Visual Comparison

### ⭐ Stars
<div style="margin: 12px 0;">
${repos.map(r => {
    const percentage = maxStars > 0 ? (r.stars / maxStars) * 100 : 0;
    return `<div style="display: flex; align-items: center; gap: 12px; margin: 8px 0;">
    <span style="min-width: 120px; font-weight: 500;">${r.repo}</span>
    <div style="flex: 1; background: var(--background-modifier-border); border-radius: 4px; height: 24px; overflow: hidden;">
        <div style="width: ${percentage}%; height: 100%; background: linear-gradient(90deg, #f59e0b, #fbbf24); border-radius: 4px; display: flex; align-items: center; justify-content: flex-end; padding-right: 8px; color: white; font-weight: bold; font-size: 0.85em;">${r.stars.toLocaleString()}</div>
    </div>
</div>`;
}).join('\n')}
</div>

### 🍴 Forks
<div style="margin: 12px 0;">
${repos.map(r => {
    const percentage = maxForks > 0 ? (r.forks / maxForks) * 100 : 0;
    return `<div style="display: flex; align-items: center; gap: 12px; margin: 8px 0;">
    <span style="min-width: 120px; font-weight: 500;">${r.repo}</span>
    <div style="flex: 1; background: var(--background-modifier-border); border-radius: 4px; height: 24px; overflow: hidden;">
        <div style="width: ${percentage}%; height: 100%; background: linear-gradient(90deg, #8b5cf6, #a78bfa); border-radius: 4px; display: flex; align-items: center; justify-content: flex-end; padding-right: 8px; color: white; font-weight: bold; font-size: 0.85em;">${r.forks.toLocaleString()}</div>
    </div>
</div>`;
}).join('\n')}
</div>

### 🐛 Open Issues
<div style="margin: 12px 0;">
${repos.map(r => {
    const percentage = maxIssues > 0 ? (r.openIssues / maxIssues) * 100 : 0;
    const barColor = r.openIssues > 20 ? '#ef4444, #f87171' : '#22c55e, #4ade80';
    return `<div style="display: flex; align-items: center; gap: 12px; margin: 8px 0;">
    <span style="min-width: 120px; font-weight: 500;">${r.repo}</span>
    <div style="flex: 1; background: var(--background-modifier-border); border-radius: 4px; height: 24px; overflow: hidden;">
        <div style="width: ${percentage}%; height: 100%; background: linear-gradient(90deg, ${barColor}); border-radius: 4px; display: flex; align-items: center; justify-content: flex-end; padding-right: 8px; color: white; font-weight: bold; font-size: 0.85em;">${r.openIssues}</div>
    </div>
</div>`;
}).join('\n')}
</div>

## 📋 Detailed Comparison

| Metric | ${repos.map(r => `**${r.repo}**`).join(' | ')} |
| :--- | ${repos.map(() => ':---:').join(' | ')} |
| ⭐ Stars | ${repos.map(r => r.stars.toLocaleString()).join(' | ')} |
| 🍴 Forks | ${repos.map(r => r.forks.toLocaleString()).join(' | ')} |
| 🐛 Issues | ${repos.map(r => r.openIssues).join(' | ')} |
| 💻 Language | ${repos.map(r => r.language || 'N/A').join(' | ')} |
| 📅 Last Commit | ${repos.map(r => r.lastCommit.date.split('T')[0]).join(' | ')} |
| 🎂 Created | ${repos.map(r => formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })).join(' | ')} |

## 🏆 Winner Analysis

${this.calculateWinner(repos)}

---

<div style="display: flex; justify-content: space-between; color: var(--text-muted); font-size: 0.85em; padding-top: 12px;">
    <span>📦 Project Snapshot Comparison</span>
    <span>Generated: ${new Date().toLocaleString()}</span>
</div>
`;
    }

    calculateWinner(repos: RepoData[]): string {
        const metrics = [
            { name: 'Most Popular', emoji: '⭐', winner: [...repos].sort((a, b) => b.stars - a.stars)[0], field: 'stars' },
            { name: 'Most Forked', emoji: '🍴', winner: [...repos].sort((a, b) => b.forks - a.forks)[0], field: 'forks' },
            { name: 'Most Active', emoji: '🔥', winner: [...repos].sort((a, b) => new Date(b.lastCommit.date).getTime() - new Date(a.lastCommit.date).getTime())[0], field: 'lastCommit' },
            { name: 'Best Maintained', emoji: '✨', winner: [...repos].sort((a, b) => a.openIssues - b.openIssues)[0], field: 'openIssues' }
        ];

        return `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
${metrics.map(m => `<div style="background: var(--background-secondary); padding: 16px; border-radius: 10px; text-align: center;">
    <div style="font-size: 1.5em; margin-bottom: 8px;">${m.emoji}</div>
    <div style="font-weight: bold; color: var(--text-muted); font-size: 0.85em; margin-bottom: 4px;">${m.name}</div>
    <div style="font-size: 1.1em; font-weight: 600;">${m.winner.repo}</div>
</div>`).join('\n')}
</div>`;
    }
}

class CompareModal extends Modal {
    private addedRepos: RepoData[] = [];
    private repoContainer: HTMLElement;

    constructor(
        app: App,
        private settings: ProjectSnapshotSettings,
        private githubAPI: GitHubAPI,
        private onSubmit: (repos: RepoData[]) => void
    ) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: 'Compare Repositories' });
        contentEl.style.width = '600px';
        contentEl.style.maxWidth = '90vw';

        // Input Area
        const inputDiv = contentEl.createDiv();
        inputDiv.style.display = 'flex';
        inputDiv.style.gap = '10px';
        inputDiv.style.marginBottom = '20px';

        let inputUrl = '';
        const input = inputDiv.createEl('input', { type: 'text', placeholder: 'https://github.com/owner/repo' });
        input.style.flex = '1';
        input.addEventListener('input', (e) => inputUrl = (e.target as HTMLInputElement).value);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') addBtn.click();
        });

        const addBtn = inputDiv.createEl('button', { text: 'Add Repo', cls: 'mod-cta' });
        addBtn.onclick = async () => {
            if (!inputUrl) return;
            addBtn.setAttr('disabled', 'true');
            addBtn.innerText = 'Loading...';
            await this.addRepo(inputUrl);
            input.value = '';
            inputUrl = '';
            addBtn.removeAttribute('disabled');
            addBtn.innerText = 'Add Repo';
        };

        // Repos Container
        this.repoContainer = contentEl.createDiv();
        this.repoContainer.style.display = 'grid';
        this.repoContainer.style.gridTemplateColumns = 'repeat(auto-fill, minmax(250px, 1fr))';
        this.repoContainer.style.gap = '15px';
        this.repoContainer.style.marginBottom = '30px';

        // Footer / Action
        const footer = contentEl.createDiv();
        footer.style.display = 'flex';
        footer.style.justifyContent = 'flex-end';
        footer.style.borderTop = '1px solid var(--background-modifier-border)';
        footer.style.paddingTop = '15px';

        const compareBtn = footer.createEl('button', { text: 'Compare All', cls: 'mod-cta' });
        compareBtn.onclick = () => {
            if (this.addedRepos.length < 2) {
                new Notice('Please add at least 2 repositories');
                return;
            }
            this.onSubmit(this.addedRepos);
            this.close();
        };

        this.renderRepos();
    }

    async addRepo(url: string) {
        const parsed = this.githubAPI.parseGitHubUrl(url);
        if (!parsed) {
            new Notice('Invalid URL');
            return;
        }
        // Check duplicate
        if (this.addedRepos.find(r => r.repo === parsed.repo && r.owner === parsed.owner)) {
            new Notice('Repository already added');
            return;
        }

        const data = await this.githubAPI.fetchRepoData(parsed.owner, parsed.repo);
        if (data) {
            this.addedRepos.push(data);
            this.renderRepos();
        }
    }

    renderRepos() {
        this.repoContainer.empty();
        this.addedRepos.forEach(repo => {
            const card = this.repoContainer.createDiv({ cls: 'repo-card' });
            card.style.backgroundColor = 'var(--background-secondary)';
            card.style.borderRadius = '8px';
            card.style.padding = '15px';
            card.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
            card.style.position = 'relative';

            // Title
            const title = card.createEl('div', { text: repo.fullName });
            title.style.fontWeight = 'bold';
            title.style.marginBottom = '12px';
            title.style.borderBottom = '1px solid var(--background-modifier-border)';
            title.style.paddingBottom = '8px';

            // Stats
            this.createStatRow(card, 'star', 'Stars', repo.stars);
            this.createStatRow(card, 'git-fork', 'Forks', repo.forks);
            this.createStatRow(card, 'alert-circle', 'Open issues', repo.openIssues);
            this.createStatRow(card, 'calendar', 'Age', formatDistanceToNow(new Date(repo.createdAt), { addSuffix: true }));
            this.createStatRow(card, 'plus-square', 'Last commit', formatDistanceToNow(new Date(repo.lastCommit.date), { addSuffix: true }));
            if (repo.language) this.createStatRow(card, 'code', 'Language', repo.language);

            // Remove Button
            const removeBtn = card.createDiv({ text: 'Remove repo' });
            removeBtn.style.color = 'var(--text-error)';
            removeBtn.style.marginTop = '15px';
            removeBtn.style.textAlign = 'center';
            removeBtn.style.cursor = 'pointer';
            removeBtn.style.fontSize = '0.9em';
            removeBtn.addEventListener('click', () => {
                this.addedRepos = this.addedRepos.filter(r => r !== repo);
                this.renderRepos();
            });

            // Hover effect
            removeBtn.addEventListener('mouseenter', () => removeBtn.style.textDecoration = 'underline');
            removeBtn.addEventListener('mouseleave', () => removeBtn.style.textDecoration = 'none');
        });
    }

    createStatRow(container: HTMLElement, iconName: string, label: string, value: any) {
        const row = container.createDiv();
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.fontSize = '0.9em';
        row.style.marginBottom = '6px';
        row.style.color = 'var(--text-normal)';

        const left = row.createDiv();
        left.style.display = 'flex';
        left.style.alignItems = 'center';
        left.style.gap = '8px';

        const icon = left.createSpan();
        setIcon(icon, iconName);
        icon.style.color = 'var(--text-muted)';

        left.createSpan({ text: label });

        const right = row.createDiv({ text: String(value) });
        right.style.fontWeight = 'bold';
    }

    onClose() {
        this.contentEl.empty();
    }
}
