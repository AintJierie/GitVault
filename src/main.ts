import { Plugin, TFile, Notice } from 'obsidian';
import { ProjectSnapshotSettings, DEFAULT_SETTINGS, ProjectSnapshotSettingTab } from './settings';
import { GitHubAPI } from './github/api';
import { CreateSnapshotCommand } from './commands/create-snapshot';
import { RefreshDataCommand } from './commands/refresh-data';
import { CreateDashboardCommand } from './commands/create-dashboard';

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
                const command = new CreateDashboardCommand(this.app, this.settings);
                await command.execute();
            }
        });

        // Add settings tab
        this.addSettingTab(new ProjectSnapshotSettingTab(this.app, this));

        // Status bar
        const statusBarItem = this.addStatusBarItem();
        statusBarItem.setText('📦 Project Snapshot');
    }

    async onunload() {
        console.log('Unloading Project Snapshot plugin');
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}
