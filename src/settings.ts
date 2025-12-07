import { App, PluginSettingTab, Setting } from 'obsidian';
import type ProjectSnapshotPlugin from './main';
import { BulkImportCommand } from './commands/bulk-import';

export interface ProjectSnapshotSettings {
    githubToken: string;
    defaultFolder: string;
    autoRefreshInterval: number;
    showInStatusBar: boolean;
    templateCustomization: {
        includeDescription: boolean;
        includeLastCommit: boolean;
        includeIssues: boolean;
        includeStars: boolean;
    };
}

export const DEFAULT_SETTINGS: ProjectSnapshotSettings = {
    githubToken: '',
    defaultFolder: 'Projects',
    autoRefreshInterval: 60, // minutes
    showInStatusBar: true,
    templateCustomization: {
        includeDescription: true,
        includeLastCommit: true,
        includeIssues: true,
        includeStars: true,
    }
};

export class ProjectSnapshotSettingTab extends PluginSettingTab {
    plugin: ProjectSnapshotPlugin;

    constructor(app: App, plugin: ProjectSnapshotPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Project Snapshot Settings' });

        // GitHub Token
        new Setting(containerEl)
            .setName('GitHub Personal Access Token')
            .setDesc('Optional. Increases rate limit from 60 to 5000 requests/hour. Create at: github.com/settings/tokens')
            .addText(text => text
                .setPlaceholder('ghp_xxxxxxxxxxxx')
                .setValue(this.plugin.settings.githubToken)
                .onChange(async (value) => {
                    this.plugin.settings.githubToken = value;
                    await this.plugin.saveSettings();
                    this.plugin.githubAPI.setToken(value);
                }));

        // Default Folder
        new Setting(containerEl)
            .setName('Default Folder')
            .setDesc('Where to create project notes')
            .addText(text => text
                .setPlaceholder('Projects')
                .setValue(this.plugin.settings.defaultFolder)
                .onChange(async (value) => {
                    this.plugin.settings.defaultFolder = value;
                    await this.plugin.saveSettings();
                }));

        // Auto Refresh
        new Setting(containerEl)
            .setName('Auto-refresh Interval')
            .setDesc('How often to refresh project data (in minutes, 0 to disable)')
            .addText(text => text
                .setPlaceholder('60')
                .setValue(String(this.plugin.settings.autoRefreshInterval))
                .onChange(async (value) => {
                    this.plugin.settings.autoRefreshInterval = parseInt(value) || 0;
                    await this.plugin.saveSettings();
                }));

        // Template Customization
        containerEl.createEl('h3', { text: 'Template Options' });

        new Setting(containerEl)
            .setName('Include Description')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.templateCustomization.includeDescription)
                .onChange(async (value) => {
                    this.plugin.settings.templateCustomization.includeDescription = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Include Last Commit')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.templateCustomization.includeLastCommit)
                .onChange(async (value) => {
                    this.plugin.settings.templateCustomization.includeLastCommit = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Include Open Issues')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.templateCustomization.includeIssues)
                .onChange(async (value) => {
                    this.plugin.settings.templateCustomization.includeIssues = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Include Stars Count')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.templateCustomization.includeStars)
                .onChange(async (value) => {
                    this.plugin.settings.templateCustomization.includeStars = value;
                    await this.plugin.saveSettings();
                }));

        // Bulk Operations
        containerEl.createEl('h3', { text: 'Bulk Operations' });

        new Setting(containerEl)
            .setName('Import User Repositories')
            .setDesc('Import all repositories from a GitHub user.')
            .addButton(button => button
                .setButtonText('Import Now')
                .onClick(async () => {
                    new BulkImportCommand(this.app, this.plugin.settings, this.plugin.githubAPI).execute();
                }));
    }
}
