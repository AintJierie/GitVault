import { App, Modal, Notice, Setting, MarkdownRenderer, Component, setIcon } from 'obsidian';
import { ProjectSnapshotSettings } from '../settings';
import { GitHubAPI } from '../github/api';
import { CreateIssueModal } from './create-issue';
import { formatDistanceToNow } from 'date-fns';

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
        contentEl.style.padding = '0';

        // Header
        const header = contentEl.createDiv();
        header.style.cssText = 'background: var(--background-secondary); padding: 20px; border-bottom: 1px solid var(--background-modifier-border);';

        const headerRow = header.createDiv();
        headerRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';

        const titleSection = headerRow.createDiv();
        titleSection.style.cssText = 'display: flex; align-items: center; gap: 12px;';

        const iconEl = titleSection.createSpan();
        setIcon(iconEl, 'alert-circle');
        iconEl.style.cssText = 'color: var(--interactive-accent); font-size: 1.3em;';

        const titleEl = titleSection.createEl('h2', { text: 'Issue Tracker' });
        titleEl.style.cssText = 'margin: 0; font-size: 1.3em;';

        const createBtn = headerRow.createEl('button', { text: '+ New Issue', cls: 'mod-cta' });
        createBtn.style.cssText = 'display: flex; align-items: center; gap: 6px;';
        createBtn.onclick = () => {
            this.close();
            new CreateIssueModal(this.app, this.repoInfo, this.githubAPI).open();
        };

        const repoName = header.createDiv({ text: `${this.repoInfo.owner}/${this.repoInfo.repo}` });
        repoName.style.cssText = 'color: var(--text-muted); font-size: 0.9em; margin-top: 4px;';

        // Stats bar
        const statsBar = contentEl.createDiv();
        statsBar.style.cssText = 'display: flex; gap: 20px; padding: 12px 20px; background: var(--background-primary); border-bottom: 1px solid var(--background-modifier-border);';

        const openCount = this.issues.filter(i => i.state === 'open').length;
        statsBar.createSpan({ text: `🟢 ${openCount} Open` }).style.cssText = 'font-size: 0.9em; font-weight: 500;';

        // List container
        const listContainer = contentEl.createDiv();
        listContainer.style.cssText = 'max-height: 60vh; overflow-y: auto;';

        if (this.issues.length === 0) {
            const emptyState = listContainer.createDiv();
            emptyState.style.cssText = 'text-align: center; padding: 40px 20px; color: var(--text-muted);';
            emptyState.createEl('div', { text: '✨' }).style.fontSize = '3em';
            emptyState.createEl('p', { text: 'No open issues found!' }).style.marginTop = '12px';
            emptyState.createEl('p', { text: 'Create a new issue to get started' }).style.cssText = 'font-size: 0.9em; opacity: 0.7;';
        } else {
            this.issues.forEach(issue => {
                const item = listContainer.createDiv();
                item.style.cssText = `
                    display: flex; 
                    align-items: flex-start;
                    gap: 12px;
                    padding: 16px 20px;
                    border-bottom: 1px solid var(--background-modifier-border);
                    cursor: pointer;
                    transition: background 0.15s;
                `;

                item.addEventListener('mouseenter', () => item.style.background = 'var(--background-secondary)');
                item.addEventListener('mouseleave', () => item.style.background = 'transparent');

                // Issue icon
                const issueIcon = item.createDiv();
                issueIcon.style.cssText = 'margin-top: 2px;';
                const iconSpan = issueIcon.createSpan();
                setIcon(iconSpan, 'circle-dot');
                iconSpan.style.color = issue.state === 'open' ? '#22c55e' : '#8b5cf6';

                // Content
                const content = item.createDiv();
                content.style.flex = '1';

                const titleEl = content.createDiv({ text: issue.title });
                titleEl.style.cssText = 'font-weight: 600; margin-bottom: 6px; color: var(--text-normal); font-size: 1.05em;';

                // Metadata row
                const metaEl = content.createDiv();
                metaEl.style.cssText = 'display: flex; gap: 10px; font-size: 0.85em; color: var(--text-muted); flex-wrap: wrap; align-items: center;';

                metaEl.createSpan({ text: `#${issue.number}` }).style.fontFamily = 'var(--font-monospace)';
                
                const timeAgo = formatDistanceToNow(new Date(issue.created_at), { addSuffix: true });
                metaEl.createSpan({ text: `opened ${timeAgo} by ${issue.user.login}` });

                // Comments count
                if (issue.comments > 0) {
                    const commentsEl = metaEl.createSpan({ text: `💬 ${issue.comments}` });
                    commentsEl.style.cssText = 'display: flex; align-items: center; gap: 4px;';
                }

                // Labels
                if (issue.labels && issue.labels.length > 0) {
                    const labelsRow = content.createDiv();
                    labelsRow.style.cssText = 'display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px;';
                    
                    issue.labels.forEach((label: any) => {
                        const lbl = labelsRow.createSpan({ text: label.name });
                        lbl.style.cssText = `
                            background: #${label.color};
                            color: ${this.getContrastColor(label.color)};
                            padding: 2px 10px;
                            border-radius: 12px;
                            font-size: 0.8em;
                            font-weight: 500;
                        `;
                    });
                }

                // Avatar
                const avatar = item.createEl('img');
                avatar.src = issue.user.avatar_url;
                avatar.style.cssText = 'width: 32px; height: 32px; border-radius: 50%;';

                item.addEventListener('click', () => {
                    new IssueDetailModal(this.app, issue).open();
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
        contentEl.addClass('markdown-preview-view');
        contentEl.style.cssText = 'padding: 0; width: 700px; max-width: 90vw;';

        // Header
        const header = contentEl.createDiv();
        header.style.cssText = 'background: var(--background-secondary); padding: 20px; border-bottom: 1px solid var(--background-modifier-border);';

        const titleRow = header.createDiv();
        titleRow.style.cssText = 'display: flex; align-items: flex-start; gap: 12px;';

        // Status badge
        const badge = titleRow.createSpan({ text: this.issue.state.toUpperCase() });
        badge.style.cssText = `
            background: ${this.issue.state === 'open' ? '#22c55e' : '#8b5cf6'};
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.75em;
            font-weight: 600;
            text-transform: uppercase;
        `;

        const titleEl = titleRow.createEl('h2', { text: this.issue.title });
        titleEl.style.cssText = 'margin: 0; flex: 1; font-size: 1.2em; line-height: 1.4;';

        // Meta info
        const meta = header.createDiv();
        meta.style.cssText = 'display: flex; align-items: center; gap: 12px; margin-top: 12px; color: var(--text-muted); font-size: 0.9em;';

        const avatar = meta.createEl('img');
        avatar.src = this.issue.user.avatar_url;
        avatar.style.cssText = 'width: 20px; height: 20px; border-radius: 50%;';

        meta.createSpan({ text: `#${this.issue.number}` }).style.fontFamily = 'var(--font-monospace)';
        meta.createSpan({ text: `opened by ${this.issue.user.login}` });
        
        const timeAgo = formatDistanceToNow(new Date(this.issue.created_at), { addSuffix: true });
        meta.createSpan({ text: timeAgo });

        // Labels
        if (this.issue.labels && this.issue.labels.length > 0) {
            const labelsRow = header.createDiv();
            labelsRow.style.cssText = 'display: flex; gap: 6px; flex-wrap: wrap; margin-top: 12px;';
            
            this.issue.labels.forEach((label: any) => {
                const lbl = labelsRow.createSpan({ text: label.name });
                lbl.style.cssText = `
                    background: #${label.color};
                    color: ${this.getContrastColor(label.color)};
                    padding: 3px 10px;
                    border-radius: 12px;
                    font-size: 0.8em;
                    font-weight: 500;
                `;
            });
        }

        // Body
        const bodyContainer = contentEl.createDiv();
        bodyContainer.style.cssText = 'padding: 20px; max-height: 50vh; overflow-y: auto;';

        if (this.issue.body) {
            MarkdownRenderer.render(this.app, this.issue.body, bodyContainer, '', new Component());
        } else {
            const emptyBody = bodyContainer.createEl('em', { text: 'No description provided.' });
            emptyBody.style.color = 'var(--text-muted)';
        }

        // Footer
        const footer = contentEl.createDiv();
        footer.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-top: 1px solid var(--background-modifier-border); background: var(--background-secondary);';

        const statsEl = footer.createDiv();
        statsEl.style.cssText = 'display: flex; gap: 16px; color: var(--text-muted); font-size: 0.9em;';
        statsEl.createSpan({ text: `💬 ${this.issue.comments} comments` });

        const actionsEl = footer.createDiv();
        actionsEl.style.cssText = 'display: flex; gap: 10px;';

        const browserBtn = actionsEl.createEl('button', { text: '🔗 View on GitHub' });
        browserBtn.onclick = () => window.open(this.issue.html_url);

        const closeBtn = actionsEl.createEl('button', { text: 'Close', cls: 'mod-cta' });
        closeBtn.onclick = () => this.close();
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
