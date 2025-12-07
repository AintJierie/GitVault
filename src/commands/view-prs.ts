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
        contentEl.style.cssText = 'padding: 0; width: 600px; max-width: 90vw;';

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
                    new Notice('Loading commits...');
                    const commits = await this.githubAPI.getPullRequestCommits(this.repoInfo.owner, this.repoInfo.repo, pr.number);
                    if (commits) {
                        new PRCommitsModal(this.app, pr, commits, this.repoInfo, this.githubAPI).open();
                    } else {
                        new Notice('Could not load commits.');
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

export class PRCommitsModal extends Modal {
    constructor(
        app: App,
        private pr: any,
        private commits: any[],
        private repoInfo: { owner: string; repo: string },
        private githubAPI: GitHubAPI
    ) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.style.cssText = 'padding: 0; width: 700px; max-width: 90vw;';

        // Header
        const header = contentEl.createDiv();
        header.style.cssText = 'background: var(--background-secondary); padding: 20px; border-bottom: 1px solid var(--background-modifier-border);';

        const titleRow = header.createDiv();
        titleRow.style.cssText = 'display: flex; align-items: center; gap: 12px;';

        const icon = titleRow.createSpan();
        setIcon(icon, 'git-commit');
        icon.style.cssText = 'color: var(--interactive-accent); font-size: 1.3em;';

        const title = titleRow.createEl('h2', { text: `Commits in #${this.pr.number}` });
        title.style.cssText = 'margin: 0; font-size: 1.2em;';

        const subTitle = header.createDiv({ text: this.pr.title });
        subTitle.style.cssText = 'color: var(--text-muted); font-size: 0.9em; margin-top: 4px;';

        // Actions
        const actionBar = contentEl.createDiv();
        actionBar.style.cssText = 'display: flex; gap: 10px; padding: 12px 20px; background: var(--background-primary); border-bottom: 1px solid var(--background-modifier-border);';

        const viewAllChangesBtn = actionBar.createEl('button', { text: 'View All Changes (Full Diff)' });
        viewAllChangesBtn.onclick = async () => {
            new Notice('Loading full diff...');
            const diff = await this.githubAPI.getPullRequestDiff(this.repoInfo.owner, this.repoInfo.repo, this.pr.number);
            if (diff) {
                new ViewDiffModal(this.app, `Diff: #${this.pr.number} ${this.pr.title}`, diff, this.pr.html_url).open();
            } else {
                new Notice('Could not load diff.');
            }
        };

        // List container
        const listContainer = contentEl.createDiv();
        listContainer.style.cssText = 'max-height: 60vh; overflow-y: auto; padding: 0;';

        this.commits.forEach((commit) => {
            const item = listContainer.createDiv();
            item.style.cssText = `
                display: flex; 
                flex-direction: column;
                gap: 4px; 
                padding: 12px 20px; 
                cursor: pointer;
                border-bottom: 1px solid var(--background-modifier-border);
                transition: background 0.1s;
            `;

            item.addEventListener('mouseenter', () => item.style.background = 'var(--background-secondary)');
            item.addEventListener('mouseleave', () => item.style.background = 'transparent');

            const msg = item.createDiv({ text: commit.commit.message.split('\n')[0] });
            msg.style.fontWeight = '500';

            const meta = item.createDiv();
            meta.style.cssText = 'display: flex; gap: 10px; font-size: 0.8em; color: var(--text-muted);';
            const author = commit.author ? commit.author.login : commit.commit.author.name;
            meta.createSpan({ text: `👤 ${author}` });
            meta.createSpan({ text: `🕒 ${new Date(commit.commit.author.date).toLocaleDateString()}` });
            meta.createSpan({ text: `🔗 ${commit.sha.substring(0, 7)}` }).style.fontFamily = 'var(--font-monospace)';

            item.addEventListener('click', async () => {
                new Notice(`Loading details for ${commit.sha.substring(0, 7)}...`);
                const details = await this.githubAPI.getCommitDetails(this.repoInfo.owner, this.repoInfo.repo, commit.sha);
                if (details) {
                    new CommitFilesModal(this.app, details, this.repoInfo, this.githubAPI).open();
                } else {
                    new Notice('Could not load commit details.');
                }
            });
        });
    }

    onClose() {
        this.contentEl.empty();
    }
}

export class CommitFilesModal extends Modal {
    constructor(
        app: App,
        private commit: any,
        private repoInfo: { owner: string; repo: string },
        private githubAPI: GitHubAPI
    ) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.style.cssText = 'padding: 0; width: 800px; max-width: 90vw; max-height: 85vh;';

        // Header
        const header = contentEl.createDiv();
        header.style.cssText = 'background: var(--background-secondary); padding: 20px; border-bottom: 1px solid var(--background-modifier-border);';

        const titleRow = header.createDiv();
        titleRow.style.cssText = 'display: flex; align-items: center; gap: 12px;';

        const icon = titleRow.createSpan();
        setIcon(icon, 'file-diff');
        icon.style.cssText = 'color: var(--interactive-accent); font-size: 1.3em;';

        const title = titleRow.createEl('h2', { text: `Changes in ${this.commit.sha.substring(0, 7)}` });
        title.style.cssText = 'margin: 0; font-size: 1.2em;';

        const subTitle = header.createDiv({ text: this.commit.commit.message.split('\n')[0] });
        subTitle.style.cssText = 'color: var(--text-muted); font-size: 0.9em; margin-top: 4px;';

        const stats = header.createDiv();
        stats.style.cssText = 'display: flex; gap: 12px; margin-top: 8px; font-size: 0.85em; color: var(--text-muted);';

        const statsData = this.commit.stats || { additions: 0, deletions: 0, total: 0 };
        stats.createSpan({ text: `📝 ${this.commit.files.length} files` });
        stats.createSpan({ text: `➕ ${statsData.additions}` }).style.color = '#22c55e';
        stats.createSpan({ text: `➖ ${statsData.deletions}` }).style.color = '#ef4444';

        // File List
        const listContainer = contentEl.createDiv();
        listContainer.style.cssText = 'max-height: 60vh; overflow-y: auto; padding: 0;';

        this.commit.files.forEach((file: any) => {
            const item = listContainer.createDiv();
            item.style.cssText = `
                display: flex; 
                align-items: center;
                gap: 12px; 
                padding: 12px 20px; 
                cursor: pointer;
                border-bottom: 1px solid var(--background-modifier-border);
                transition: background 0.1s;
            `;

            item.addEventListener('mouseenter', () => item.style.background = 'var(--background-secondary)');
            item.addEventListener('mouseleave', () => item.style.background = 'transparent');

            // Status Icon
            const statusIcon = item.createSpan();
            statusIcon.style.cssText = 'font-family: var(--font-monospace); font-weight: bold; width: 24px; text-align: center;';

            if (file.status === 'added') {
                statusIcon.innerText = 'A';
                statusIcon.style.color = '#22c55e';
            } else if (file.status === 'removed') {
                statusIcon.innerText = 'D';
                statusIcon.style.color = '#ef4444';
            } else if (file.status === 'modified') {
                statusIcon.innerText = 'M';
                statusIcon.style.color = '#f59e0b';
            } else if (file.status === 'renamed') {
                statusIcon.innerText = 'R';
                statusIcon.style.color = '#3b82f6';
            } else {
                statusIcon.innerText = '?';
                statusIcon.style.color = 'var(--text-muted)';
            }

            const filename = item.createDiv({ text: file.filename });
            filename.style.flex = '1';
            filename.style.fontWeight = '500';

            const changes = item.createDiv();
            changes.style.fontSize = '0.8em';
            changes.style.color = 'var(--text-muted)';
            if (file.patch) {
                changes.innerText = `+${file.additions} -${file.deletions}`;
            } else {
                changes.innerText = 'Binary / No diff';
            }

            item.addEventListener('click', () => {
                if (file.patch) {
                    new ViewDiffModal(this.app, file.filename, file.patch, file.blob_url).open();
                } else {
                    new Notice('No diff available for this file (binary or too large).');
                }
            });
        });
    }

    onClose() {
        this.contentEl.empty();
    }
}

export class ViewDiffModal extends Modal {
    constructor(
        app: App,
        private title: string,
        private diff: string,
        private url?: string
    ) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.style.cssText = 'padding: 0; width: 95vw; height: 85vh; max-width: 1400px;';

        // Header
        const header = contentEl.createDiv();
        header.style.cssText = 'background: var(--background-secondary); padding: 20px; border-bottom: 1px solid var(--background-modifier-border);';

        const titleRow = header.createDiv();
        titleRow.style.cssText = 'display: flex; align-items: center; gap: 12px;';

        const prIcon = titleRow.createSpan();
        setIcon(prIcon, 'file-diff');
        prIcon.style.color = 'var(--text-accent)';

        titleRow.createEl('h3', { text: this.title }).style.margin = '0';

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

        if (this.url) {
            const browserBtn = footer.createEl('button', { text: '🔗 View on GitHub' });
            browserBtn.onclick = () => window.open(this.url);
        }

        const closeBtn = footer.createEl('button', { text: 'Close', cls: 'mod-cta' });
        closeBtn.onclick = () => this.close();
    }

    onClose() {
        this.contentEl.empty();
    }
}
