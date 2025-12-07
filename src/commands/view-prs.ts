import { App, Modal, Notice, setIcon } from 'obsidian';
import { ProjectSnapshotSettings } from '../settings';
import { GitHubAPI } from '../github/api';

export class ViewPRsCommand {
    constructor(
        private app: App,
        private settings: ProjectSnapshotSettings,
        private githubAPI: GitHubAPI
    ) { }

    async execute() {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('No active file.');
            return;
        }

        const cache = this.app.metadataCache.getFileCache(activeFile);
        let repoUrl = cache?.frontmatter?.repo_url;

        if (!repoUrl) {
            // Fallback: Try to parse content
            const content = await this.app.vault.read(activeFile);
            const match = content.match(/\*\*Repository:\*\* \[.*\]\((.*)\)/);
            if (match && match[1]) {
                repoUrl = match[1];
            } else {
                new Notice('Not a Project Snapshot (missing repo_url).');
                return;
            }
        }

        const parsed = this.githubAPI.parseGitHubUrl(repoUrl);
        if (!parsed) {
            new Notice('Invalid repo URL.');
            return;
        }

        new Notice('Fetching Pull Requests...');
        const prs = await this.githubAPI.getPullRequests(parsed.owner, parsed.repo);

        new PRListModal(this.app, prs, parsed, this.githubAPI).open();
    }
}

export class PRListModal extends Modal {
    constructor(
        app: App,
        private prs: any[],
        private repoInfo: { owner: string; repo: string },
        private githubAPI: GitHubAPI
    ) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.style.padding = '0';

        // Header
        const header = contentEl.createDiv();
        header.style.cssText = 'background: var(--background-secondary); padding: 20px; border-bottom: 1px solid var(--background-modifier-border);';
        
        const headerContent = header.createDiv();
        headerContent.style.cssText = 'display: flex; align-items: center; gap: 12px;';
        
        const iconEl = headerContent.createSpan();
        setIcon(iconEl, 'git-pull-request');
        iconEl.style.cssText = 'color: var(--interactive-accent); font-size: 1.5em;';
        
        const titleEl = headerContent.createEl('h2', { text: `Pull Requests` });
        titleEl.style.cssText = 'margin: 0; font-size: 1.3em;';
        
        const repoName = header.createDiv({ text: `${this.repoInfo.owner}/${this.repoInfo.repo}` });
        repoName.style.cssText = 'color: var(--text-muted); font-size: 0.9em; margin-top: 4px;';

        // Stats bar
        const statsBar = contentEl.createDiv();
        statsBar.style.cssText = 'display: flex; gap: 16px; padding: 12px 20px; background: var(--background-primary); border-bottom: 1px solid var(--background-modifier-border);';
        
        const openCount = statsBar.createSpan({ text: `🟢 ${this.prs.length} Open` });
        openCount.style.cssText = 'font-size: 0.9em; font-weight: 500;';

        // List container
        const listContainer = contentEl.createDiv();
        listContainer.style.cssText = 'max-height: 60vh; overflow-y: auto; padding: 0;';

        if (this.prs.length === 0) {
            const emptyState = listContainer.createDiv();
            emptyState.style.cssText = 'text-align: center; padding: 40px 20px; color: var(--text-muted);';
            emptyState.createEl('div', { text: '🎉' }).style.fontSize = '3em';
            emptyState.createEl('p', { text: 'No open pull requests!' }).style.marginTop = '12px';
        } else {
            this.prs.forEach((pr, index) => {
                const item = listContainer.createDiv();
                item.style.cssText = `
                    display: flex; 
                    align-items: flex-start; 
                    gap: 12px; 
                    padding: 16px 20px; 
                    cursor: pointer;
                    border-bottom: 1px solid var(--background-modifier-border);
                    transition: background 0.15s;
                `;

                item.addEventListener('mouseenter', () => item.style.background = 'var(--background-secondary)');
                item.addEventListener('mouseleave', () => item.style.background = 'transparent');

                // PR icon
                const prIcon = item.createDiv();
                prIcon.style.cssText = 'color: #22c55e; margin-top: 2px;';
                setIcon(prIcon, 'git-pull-request');

                // Content
                const content = item.createDiv();
                content.style.flex = '1';

                const title = content.createDiv({ text: pr.title });
                title.style.cssText = 'font-weight: 600; margin-bottom: 6px; color: var(--text-normal);';

                const meta = content.createDiv();
                meta.style.cssText = 'display: flex; gap: 12px; font-size: 0.85em; color: var(--text-muted); flex-wrap: wrap; align-items: center;';
                
                meta.createSpan({ text: `#${pr.number}` }).style.fontFamily = 'var(--font-monospace)';
                meta.createSpan({ text: `opened by ${pr.user.login}` });
                
                if (pr.draft) {
                    const draftBadge = meta.createSpan({ text: 'Draft' });
                    draftBadge.style.cssText = 'background: var(--background-modifier-border); padding: 2px 8px; border-radius: 10px; font-size: 0.85em;';
                }

                // Labels
                if (pr.labels && pr.labels.length > 0) {
                    pr.labels.slice(0, 3).forEach((label: any) => {
                        const lbl = meta.createSpan({ text: label.name });
                        lbl.style.cssText = `
                            background: #${label.color}; 
                            color: ${this.getContrastColor(label.color)}; 
                            padding: 2px 8px; 
                            border-radius: 10px; 
                            font-size: 0.8em;
                        `;
                    });
                }

                // Avatar
                const avatar = item.createEl('img');
                avatar.src = pr.user.avatar_url;
                avatar.style.cssText = 'width: 32px; height: 32px; border-radius: 50%;';

                item.addEventListener('click', async () => {
                    new Notice('Loading diff...');
                    const diff = await this.githubAPI.getPullRequestDiff(this.repoInfo.owner, this.repoInfo.repo, pr.number);
                    if (diff) {
                        new PRDiffModal(this.app, pr, diff).open();
                    } else {
                        new Notice('Could not load diff.');
                    }
                });
            });
        }
    }

    getContrastColor(hexColor: string): string {
        const r = parseInt(hexColor.substr(0, 2), 16);
        const g = parseInt(hexColor.substr(2, 2), 16);
        const b = parseInt(hexColor.substr(4, 2), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return yiq >= 128 ? '#000' : '#fff';
    }

    onClose() {
        this.contentEl.empty();
    }
}

export class PRDiffModal extends Modal {
    constructor(
        app: App,
        private pr: any,
        private diff: string
    ) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.style.cssText = 'padding: 0; width: 800px; max-width: 90vw;';

        // Header
        const header = contentEl.createDiv();
        header.style.cssText = 'background: var(--background-secondary); padding: 20px; border-bottom: 1px solid var(--background-modifier-border);';

        const titleRow = header.createDiv();
        titleRow.style.cssText = 'display: flex; align-items: center; gap: 12px;';
        
        const prIcon = titleRow.createSpan();
        setIcon(prIcon, 'git-pull-request');
        prIcon.style.color = '#22c55e';

        titleRow.createEl('span', { text: `#${this.pr.number}` }).style.cssText = 'font-family: var(--font-monospace); color: var(--text-muted);';
        titleRow.createEl('span', { text: this.pr.title }).style.fontWeight = '600';

        const meta = header.createDiv();
        meta.style.cssText = 'display: flex; gap: 12px; margin-top: 8px; font-size: 0.9em; color: var(--text-muted);';
        meta.createSpan({ text: `by ${this.pr.user.login}` });
        meta.createSpan({ text: `${this.pr.commits || '?'} commits` });
        meta.createSpan({ text: `${this.pr.changed_files || '?'} files changed` });

        // Diff viewer
        const diffContainer = contentEl.createDiv();
        diffContainer.style.cssText = 'max-height: 60vh; overflow: auto; padding: 0;';

        const pre = diffContainer.createEl('pre');
        pre.style.cssText = `
            margin: 0; 
            padding: 16px; 
            font-family: var(--font-monospace); 
            font-size: 0.85em; 
            line-height: 1.5;
            white-space: pre-wrap;
            background: var(--background-primary);
        `;

        // Syntax highlight diff
        const lines = this.diff.split('\n');
        lines.forEach(line => {
            const lineEl = pre.createEl('div');
            if (line.startsWith('+') && !line.startsWith('+++')) {
                lineEl.style.cssText = 'background: rgba(34, 197, 94, 0.15); color: #22c55e;';
            } else if (line.startsWith('-') && !line.startsWith('---')) {
                lineEl.style.cssText = 'background: rgba(239, 68, 68, 0.15); color: #ef4444;';
            } else if (line.startsWith('@@')) {
                lineEl.style.cssText = 'color: #8b5cf6; font-weight: 500;';
            } else if (line.startsWith('diff') || line.startsWith('index')) {
                lineEl.style.cssText = 'color: var(--text-muted); font-weight: 600;';
            }
            lineEl.textContent = line;
        });

        // Footer
        const footer = contentEl.createDiv();
        footer.style.cssText = 'display: flex; justify-content: flex-end; gap: 10px; padding: 16px 20px; border-top: 1px solid var(--background-modifier-border);';

        const browserBtn = footer.createEl('button', { text: '🔗 View on GitHub' });
        browserBtn.onclick = () => window.open(this.pr.html_url);

        const closeBtn = footer.createEl('button', { text: 'Close', cls: 'mod-cta' });
        closeBtn.onclick = () => this.close();
    }

    onClose() {
        this.contentEl.empty();
    }
}
