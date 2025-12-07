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
        const repoHeaders = repos.map(r => `[${r.repo}](${r.url})`).join(' | ');
        const separator = repos.map(() => ':---').join(' | ');

        // Helpers
        const getStars = () => repos.map(r => r.stars).join(' | ');
        const getForks = () => repos.map(r => r.forks).join(' | ');
        const getIssues = () => repos.map(r => r.openIssues).join(' | ');
        const getLang = () => repos.map(r => r.language || 'N/A').join(' | ');
        const getLastCommit = () => repos.map(r => r.lastCommit.date.split('T')[0]).join(' | ');
        const getAge = () => repos.map(r => formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })).join(' | ');

        return `---
tags:
  - project-comparison
date: ${new Date().toISOString()}
---

# Comparison: ${repos.map(r => r.fullName).join(' vs ')}

| Metric | ${repoHeaders} |
| :--- | ${separator} |
| **Stars** | ${getStars()} |
| **Forks** | ${getForks()} |
| **Issues** | ${getIssues()} |
| **Language** | ${getLang()} |
| **Last Commit** | ${getLastCommit()} |
| **Created** | ${getAge()} |
| **Description** | ${repos.map(r => r.description).join(' | ')} |

## Winner?
${this.calculateWinner(repos)}
`;
    }

    calculateWinner(repos: RepoData[]): string {
        const sortedByStars = [...repos].sort((a, b) => b.stars - a.stars);
        const winner = sortedByStars[0];
        return `**${winner.fullName}** is the most popular with **${winner.stars}** stars.`;
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
