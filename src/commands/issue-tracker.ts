import { App, Modal, Notice, MarkdownRenderer, Component, setIcon } from 'obsidian';
import { ProjectSnapshotSettings } from '../settings';
import { GitHubAPI, GitHubIssue } from '../github/api';
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
        private issues: GitHubIssue[],
        private repoInfo: { owner: string; repo: string },
        private githubAPI: GitHubAPI
    ) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('ps-content-no-padding');

        // Header
        const header = contentEl.createDiv({ cls: 'ps-modal-header' });
        const headerRow = header.createDiv({ cls: 'ps-header-between' });

        const titleSection = headerRow.createDiv({ cls: 'ps-title-section' });

        const iconEl = titleSection.createSpan({ cls: 'ps-icon-accent' });
        setIcon(iconEl, 'alert-circle');

        titleSection.createEl('h2', { text: 'Issue tracker', cls: 'ps-modal-title' });

        const createBtn = headerRow.createEl('button', { text: '+ New issue', cls: 'mod-cta ps-btn-with-icon' });
        createBtn.onclick = () => {
            this.close();
            new CreateIssueModal(this.app, this.repoInfo, this.githubAPI).open();
        };

        header.createDiv({ text: `${this.repoInfo.owner}/${this.repoInfo.repo}`, cls: 'ps-modal-subtitle' });

        // Stats bar
        const statsBar = contentEl.createDiv({ cls: 'ps-stats-bar' });
        const openCount = this.issues.filter(i => i.state === 'open').length;
        statsBar.createSpan({ text: `🟢 ${openCount} open` });

        // List container
        const listContainer = contentEl.createDiv({ cls: 'ps-list-container' });

        if (this.issues.length === 0) {
            const emptyState = listContainer.createDiv({ cls: 'ps-empty-state' });
            emptyState.createEl('div', { text: '✨', cls: 'ps-empty-state-icon' });
            emptyState.createEl('p', { text: 'No open issues found!', cls: 'ps-empty-state-text' });
            emptyState.createEl('p', { text: 'Create a new issue to get started', cls: 'ps-text-muted ps-text-sm' });
        } else {
            this.issues.forEach(issue => {
                const item = listContainer.createDiv({ cls: 'ps-item-card' });

                // Issue icon
                const issueIcon = item.createDiv({ cls: 'ps-item-icon' });
                const iconSpan = issueIcon.createSpan();
                setIcon(iconSpan, 'circle-dot');
                iconSpan.addClass(issue.state === 'open' ? 'ps-icon-green' : 'ps-icon-purple');

                // Content
                const content = item.createDiv({ cls: 'ps-item-content' });
                content.createDiv({ text: issue.title, cls: 'ps-item-title' });

                // Metadata row
                const metaEl = content.createDiv({ cls: 'ps-item-meta' });

                metaEl.createSpan({ text: `#${issue.number}`, cls: 'ps-mono' });
                
                const timeAgo = formatDistanceToNow(new Date(issue.created_at), { addSuffix: true });
                metaEl.createSpan({ text: `opened ${timeAgo} by ${issue.user?.login || 'unknown'}` });

                // Comments count
                if (issue.comments > 0) {
                    metaEl.createSpan({ text: `💬 ${issue.comments}`, cls: 'ps-comments-badge' });
                }

                // Labels
                if (issue.labels && issue.labels.length > 0) {
                    const labelsRow = content.createDiv({ cls: 'ps-labels-row' });
                    
                    issue.labels.forEach((label) => {
                        const lbl = labelsRow.createSpan({ text: label.name, cls: 'ps-label' });
                        lbl.setCssStyles({
                            background: `#${label.color}`,
                            color: this.getContrastColor(label.color)
                        });
                    });
                }

                // Avatar
                const avatar = item.createEl('img', { cls: 'ps-item-avatar' });
                if (issue.user?.avatar_url) {
                    avatar.src = issue.user.avatar_url;
                }

                item.addEventListener('click', () => {
                    new IssueDetailModal(this.app, issue).open();
                });
            });
        }
    }

    getContrastColor(hexColor: string): string {
        const r = parseInt(hexColor.substring(0, 2), 16);
        const g = parseInt(hexColor.substring(2, 4), 16);
        const b = parseInt(hexColor.substring(4, 6), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return yiq >= 128 ? '#000' : '#fff';
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

class IssueDetailModal extends Modal {
    constructor(app: App, private issue: GitHubIssue) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('markdown-preview-view');
        contentEl.addClass('ps-content-no-padding');
        contentEl.addClass('ps-modal-medium');

        // Header
        const header = contentEl.createDiv({ cls: 'ps-modal-header' });
        const titleRow = header.createDiv({ cls: 'ps-modal-title-row' });

        // Status badge
        const badge = titleRow.createSpan({ text: this.issue.state.toUpperCase(), cls: 'ps-issue-badge' });
        badge.addClass(this.issue.state === 'open' ? 'ps-issue-badge-open' : 'ps-issue-badge-closed');

        titleRow.createEl('h2', { text: this.issue.title, cls: 'ps-issue-title' });

        // Meta info
        const meta = header.createDiv({ cls: 'ps-issue-meta' });

        const avatar = meta.createEl('img', { cls: 'ps-small-avatar' });
        if (this.issue.user?.avatar_url) {
            avatar.src = this.issue.user.avatar_url;
        }

        meta.createSpan({ text: `#${this.issue.number}`, cls: 'ps-mono' });
        meta.createSpan({ text: `opened by ${this.issue.user?.login || 'unknown'}` });
        
        const timeAgo = formatDistanceToNow(new Date(this.issue.created_at), { addSuffix: true });
        meta.createSpan({ text: timeAgo });

        // Labels
        if (this.issue.labels && this.issue.labels.length > 0) {
            const labelsRow = header.createDiv({ cls: 'ps-labels-row ps-mt-md' });
            
            this.issue.labels.forEach((label) => {
                const lbl = labelsRow.createSpan({ text: label.name, cls: 'ps-label' });
                lbl.setCssStyles({
                    background: `#${label.color}`,
                    color: this.getContrastColor(label.color)
                });
            });
        }

        // Body
        const bodyContainer = contentEl.createDiv({ cls: 'ps-body-container' });

        if (this.issue.body) {
            void MarkdownRenderer.render(this.app, this.issue.body, bodyContainer, '', new Component());
        } else {
            bodyContainer.createEl('em', { text: 'No description provided.', cls: 'ps-empty-body' });
        }

        // Footer
        const footer = contentEl.createDiv({ cls: 'ps-modal-footer' });

        const statsEl = footer.createDiv({ cls: 'ps-footer-stats' });
        statsEl.createSpan({ text: `💬 ${this.issue.comments} comments` });

        const actionsEl = footer.createDiv({ cls: 'ps-flex ps-gap-md' });

        const browserBtn = actionsEl.createEl('button', { text: '🔗 View on GitHub' });
        browserBtn.onclick = () => window.open(this.issue.html_url);

        const closeBtn = actionsEl.createEl('button', { text: 'Close', cls: 'mod-cta' });
        closeBtn.onclick = () => this.close();
    }

    getContrastColor(hexColor: string): string {
        const r = parseInt(hexColor.substring(0, 2), 16);
        const g = parseInt(hexColor.substring(2, 4), 16);
        const b = parseInt(hexColor.substring(4, 6), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return yiq >= 128 ? '#000' : '#fff';
    }

    onClose() {
        this.contentEl.empty();
    }
}
