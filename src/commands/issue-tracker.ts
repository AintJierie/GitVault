import { App, Modal, Notice, Setting, MarkdownRenderer, Component } from 'obsidian';
import { ProjectSnapshotSettings } from '../settings';
import { GitHubAPI } from '../github/api';
import { CreateIssueModal } from './create-issue';

export class IssueTrackerCommand {
    constructor(
        private app: App,
        private settings: ProjectSnapshotSettings,
        private githubAPI: GitHubAPI
    ) { }

    async execute() {
        // Must be in a snapshot file to know which repo
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

        new Notice('Fetching issues...');
        const issues = await this.githubAPI.getIssues(parsed.owner, parsed.repo);

        new IssueTrackerModal(this.app, issues, parsed, this.githubAPI).open();
    }
}

export class IssueTrackerModal extends Modal {
    constructor(
        app: App,
        private issues: any[],
        private repoInfo: { owner: string; repo: string },
        private githubAPI: GitHubAPI
    ) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h2', { text: `Issues: ${this.repoInfo.repo}` });

        const btnContainer = contentEl.createDiv();
        btnContainer.style.display = 'flex';
        btnContainer.style.gap = '10px';
        btnContainer.style.marginBottom = '20px';

        const createBtn = btnContainer.createEl('button', { text: 'Create New Issue', cls: 'mod-cta' });
        createBtn.onclick = () => {
            this.close();
            new CreateIssueModal(this.app, this.repoInfo, this.githubAPI).open();
        };

        const listContainer = contentEl.createDiv();
        listContainer.style.maxHeight = '60vh';
        listContainer.style.overflowY = 'auto';

        if (this.issues.length === 0) {
            listContainer.createEl('p', { text: 'No open issues found.' });
        } else {
            this.issues.forEach(issue => {
                const item = listContainer.createDiv({ cls: 'tree-item-self' });
                item.style.display = 'flex';
                item.style.alignItems = 'flex-start'; // Align top
                item.style.padding = '12px';
                item.style.borderBottom = '1px solid var(--background-modifier-border)';
                item.style.cursor = 'pointer';
                item.style.gap = '10px';

                // Avatar
                const avatar = item.createEl('img');
                avatar.src = issue.user.avatar_url;
                avatar.style.width = '24px';
                avatar.style.height = '24px';
                avatar.style.borderRadius = '50%';

                // Content
                const content = item.createDiv();
                content.style.flex = '1';

                const titleEl = content.createDiv({ text: issue.title });
                titleEl.style.fontWeight = 'bold';
                titleEl.style.marginBottom = '4px';
                titleEl.style.fontSize = '1.1em';

                // Metadata row
                const metaEl = content.createDiv();
                metaEl.style.display = 'flex';
                metaEl.style.gap = '8px';
                metaEl.style.fontSize = '0.85em';
                metaEl.style.color = 'var(--text-muted)';
                metaEl.style.flexWrap = 'wrap';
                metaEl.style.alignItems = 'center';

                metaEl.createSpan({ text: `#${issue.number}` });
                metaEl.createSpan({ text: `opened by ${issue.user.login}` });

                // Labels
                if (issue.labels && issue.labels.length > 0) {
                    issue.labels.forEach((label: any) => {
                        const lbl = metaEl.createSpan({ text: label.name });
                        lbl.style.backgroundColor = `#${label.color}`;
                        lbl.style.color = this.isDarkColor(label.color) ? '#fff' : '#000';
                        lbl.style.padding = '2px 6px';
                        lbl.style.borderRadius = '10px';
                        lbl.style.fontSize = '0.9em';
                    });
                }

                item.addEventListener('click', () => {
                    new IssueDetailModal(this.app, issue).open();
                });
            });
        }
    }

    // Helper to determine text color based on background hex
    isDarkColor(hex: string): boolean {
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        // YIQ equation
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return yiq < 128;
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class IssueDetailModal extends Modal {
    constructor(app: App, private issue: any) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('markdown-preview-view'); // Use Obsidian preview styles
        contentEl.style.padding = '20px';

        // Header
        const header = contentEl.createDiv();
        header.style.marginBottom = '20px';
        header.style.borderBottom = '1px solid var(--background-modifier-border)';
        header.style.paddingBottom = '10px';

        const title = header.createEl('h1', { text: this.issue.title });
        title.style.marginTop = '0';

        const meta = header.createDiv();
        meta.style.display = 'flex';
        meta.style.gap = '10px';
        meta.style.alignItems = 'center';
        meta.style.color = 'var(--text-muted)';

        const badge = meta.createSpan({ text: this.issue.state.toUpperCase() });
        badge.style.backgroundColor = this.issue.state === 'open' ? 'var(--interactive-accent)' : 'var(--text-muted)';
        badge.style.color = '#fff';
        badge.style.padding = '4px 8px';
        badge.style.borderRadius = '4px';
        badge.style.fontSize = '0.8em';
        badge.style.fontWeight = 'bold';

        meta.createSpan({ text: `#${this.issue.number}` });
        meta.createSpan({ text: `by ${this.issue.user.login}` });

        // Body (Markdown)
        const bodyContainer = contentEl.createDiv();
        bodyContainer.style.padding = '10px 0';

        if (this.issue.body) {
            MarkdownRenderer.render(this.app, this.issue.body, bodyContainer, '', new Component());
        } else {
            bodyContainer.createEl('em', { text: 'No description provided.' });
        }

        // Footer Actions
        const footer = contentEl.createDiv();
        footer.style.marginTop = '30px';
        footer.style.display = 'flex';
        footer.style.justifyContent = 'flex-end';
        footer.style.gap = '10px';

        const browserBtn = footer.createEl('button', { text: 'Open on GitHub' });
        browserBtn.onclick = () => window.open(this.issue.html_url);

        const closeBtn = footer.createEl('button', { text: 'Close', cls: 'mod-cta' });
        closeBtn.onclick = () => this.close();
    }

    onClose() {
        this.contentEl.empty();
    }
}
