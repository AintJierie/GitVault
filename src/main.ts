import { Plugin, TFile, Notice } from 'obsidian';
import { ProjectSnapshotSettings, DEFAULT_SETTINGS, ProjectSnapshotSettingTab } from './settings';
import { GitHubAPI } from './github/api';
import { CreateSnapshotCommand } from './commands/create-snapshot';
import { RefreshDataCommand } from './commands/refresh-data';
import { CreateDashboardCommand } from './commands/create-dashboard';
import { BulkImportCommand } from './commands/bulk-import';
import { CompareReposCommand } from './commands/compare-repos';
import { IssueTrackerCommand } from './commands/issue-tracker';
import { ViewPRsCommand } from './commands/view-prs';

export default class ProjectSnapshotPlugin extends Plugin {
    settings: ProjectSnapshotSettings;
    githubAPI: GitHubAPI;

    async onload() {
        console.log('Loading Project Snapshot plugin');

        // Load settings
        await this.loadSettings();

        // Initialize GitHub API
        this.githubAPI = new GitHubAPI(this.settings.githubToken);

        // Add ribbon icon
        this.addRibbonIcon('github', 'Create Project Snapshot', async () => {
            const command = new CreateSnapshotCommand(this.app, this.settings, this.githubAPI);
            await command.execute();
        });

        // Add commands
        this.addCommand({
            id: 'create-project-snapshot',
            name: 'Create Project Snapshot from GitHub URL',
            callback: async () => {
                const command = new CreateSnapshotCommand(this.app, this.settings, this.githubAPI);
                await command.execute();
            }
        });

        this.addCommand({
            id: 'refresh-project-data',
            name: 'Refresh Project Data',
            callback: async () => {
                const command = new RefreshDataCommand(this.app, this.settings, this.githubAPI);
                await command.execute();
            }
        });

        this.addCommand({
            id: 'create-project-dashboard',
            name: 'Create Project Dashboard',
            callback: async () => {
                const command = new CreateDashboardCommand(this.app, this.settings, this.githubAPI);
                await command.execute();
            }
        });

        this.addCommand({
            id: 'bulk-import-repos',
            name: 'Bulk Import User Repositories',
            callback: async () => {
                const command = new BulkImportCommand(this.app, this.settings, this.githubAPI);
                await command.execute();
            }
        });

        this.addCommand({
            id: 'compare-repos',
            name: 'Compare Two Repositories',
            callback: async () => {
                const command = new CompareReposCommand(this.app, this.settings, this.githubAPI);
                await command.execute();
            }
        });

        this.addCommand({
            id: 'issue-tracker',
            name: 'Open Issue Tracker',
            callback: async () => {
                const command = new IssueTrackerCommand(this.app, this.settings, this.githubAPI);
                await command.execute();
            }
        });

        this.addCommand({
            id: 'view-prs',
            name: 'View Pull Requests',
            callback: async () => {
                const command = new ViewPRsCommand(this.app, this.settings, this.githubAPI);
                await command.execute();
            }
        });

        // Add settings tab
        this.addSettingTab(new ProjectSnapshotSettingTab(this.app, this));

        // Status bar
        const statusBarItem = this.addStatusBarItem();
        statusBarItem.setText('📦 Project Snapshot');

        // Hover Stats
        this.registerMarkdownPostProcessor((element, context) => {
            const links = element.findAll('a.external-link') as unknown as HTMLAnchorElement[];
            for (const link of links) {
                if (link.href && link.href.includes('github.com')) {
                    link.addEventListener('mouseenter', async (e) => {
                        const parsed = this.githubAPI.parseGitHubUrl(link.href);
                        if (parsed) {
                            // Use aria-label for Obsidian-style tooltip
                            if (!link.getAttribute('aria-label')) {
                                link.setAttribute('aria-label', 'Loading stats...');
                                const data = await this.githubAPI.fetchRepoData(parsed.owner, parsed.repo);
                                if (data) {
                                    link.setAttribute('aria-label', `⭐ ${data.stars} | 🐛 ${data.openIssues} | 🕒 ${data.lastCommit.date.split('T')[0]}`);
                                } else {
                                    link.setAttribute('aria-label', 'Repo not found');
                                }
                            }
                        }
                    });
                }
            }
        });
    }

    async onunload() {
        console.log('Unloading Project Snapshot plugin');
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
        if (this.githubAPI) {
            this.githubAPI.setToken(this.settings.githubToken);
        }
    }
}
