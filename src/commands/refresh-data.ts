import { App, Notice, TFile } from 'obsidian';
import { ProjectSnapshotSettings } from '../settings';
import { GitHubAPI } from '../github/api';
import { CreateDashboardCommand } from './create-dashboard';
import { ProjectNoteTemplate } from '../templates/project-note';

export class RefreshDataCommand {
    constructor(
        private app: App,
        private settings: ProjectSnapshotSettings,
        private githubAPI: GitHubAPI
    ) { }

    async execute() {
        // 1. Get current active file
        const activeFile = this.app.workspace.getActiveFile();

        if (!activeFile) {
            new Notice('No active file to refresh');
            return;
        }

        // 2. Read frontmatter
        const cache = this.app.metadataCache.getFileCache(activeFile);
        const frontmatter = cache?.frontmatter;

        if (!frontmatter) {
            new Notice('No metadata found in this file');
            return;
        }

        // 3. Case 1: Dashboard
        // Check for specific tag or filename
        const tags = frontmatter.tags || [];
        const isDashboard = tags.includes('project-dashboard') || activeFile.name === 'Project Dashboard.md';

        if (isDashboard) {
            new Notice('Refreshing Dashboard...');
            const dashboardCommand = new CreateDashboardCommand(this.app, this.settings, this.githubAPI);
            await dashboardCommand.execute();
            return;
        }

        // 4. Case 2: Project Snapshot
        const repoUrl = frontmatter.repo_url;
        if (repoUrl) {
            new Notice(`Refreshing snapshot for ${repoUrl}...`);
            await this.refreshSnapshot(activeFile, repoUrl);
            return;
        }

        new Notice('Current file is not a Project Snapshot or Dashboard');
    }

    async refreshSnapshot(file: TFile, repoUrl: string) {
        const parsed = this.githubAPI.parseGitHubUrl(repoUrl);
        if (!parsed) {
            new Notice('Invalid GitHub URL in frontmatter');
            return;
        }

        const data = await this.githubAPI.fetchRepoData(parsed.owner, parsed.repo);
        if (!data) {
            // Notification already handled by githubAPI
            return;
        }

        const newContent = ProjectNoteTemplate.generate(data, this.settings);

        try {
            await this.app.vault.modify(file, newContent);
            new Notice(`Updated snapshot: ${data.fullName}`);
        } catch (error) {
            console.error(error);
            new Notice('Failed to update file');
        }
    }
}
