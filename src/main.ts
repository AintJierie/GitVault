import { Plugin, TFile, Notice, SuggestModal, App } from 'obsidian';
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

        // Add ribbon icon (Menu)
        this.addRibbonIcon('github', 'Project Snapshot Menu', (evt: MouseEvent) => {
            new ProjectSnapshotMenuModal(this.app, this).open();
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

interface CommandItem {
    label: string;
    id: string;
    icon: string;
    description: string;
}

class ProjectSnapshotMenuModal extends SuggestModal<CommandItem> {
    plugin: ProjectSnapshotPlugin;

    constructor(app: App, plugin: ProjectSnapshotPlugin) {
        super(app);
        this.plugin = plugin;
        this.setPlaceholder('🔍 Search commands...');
    }

    getSuggestions(query: string): CommandItem[] {
        const commands: CommandItem[] = [
            { label: 'Create Project Snapshot', id: 'create-snapshot', icon: '📸', description: 'Create a note from a GitHub URL' },
            { label: 'Bulk Import Repositories', id: 'bulk-import', icon: '📦', description: 'Import all your GitHub repos at once' },
            { label: 'Create Project Dashboard', id: 'create-dashboard', icon: '📊', description: 'Generate an overview of all projects' },
            { label: 'Compare Repositories', id: 'compare-repos', icon: '⚔️', description: 'Side-by-side repository comparison' },
            { label: 'Open Issue Tracker', id: 'issue-tracker', icon: '🐛', description: 'View and manage GitHub issues' },
            { label: 'View Pull Requests', id: 'view-prs', icon: '🔀', description: 'Browse open pull requests' },
            { label: 'Refresh Project Data', id: 'refresh-data', icon: '🔄', description: 'Update current project note' }
        ];

        return commands.filter(cmd => 
            cmd.label.toLowerCase().includes(query.toLowerCase()) ||
            cmd.description.toLowerCase().includes(query.toLowerCase())
        );
    }

    renderSuggestion(cmd: CommandItem, el: HTMLElement) {
        el.style.cssText = 'display: flex; align-items: center; gap: 12px; padding: 10px 12px;';
        
        const iconEl = el.createSpan({ text: cmd.icon });
        iconEl.style.cssText = 'font-size: 1.3em; min-width: 28px; text-align: center;';
        
        const textContainer = el.createDiv();
        textContainer.createDiv({ text: cmd.label }).style.fontWeight = '600';
        textContainer.createDiv({ text: cmd.description }).style.cssText = 'font-size: 0.85em; color: var(--text-muted);';
    }

    async onChooseSuggestion(cmd: CommandItem, evt: MouseEvent | KeyboardEvent) {
        switch (cmd.id) {
            case 'create-snapshot':
                new CreateSnapshotCommand(this.app, this.plugin.settings, this.plugin.githubAPI).execute();
                break;
            case 'issue-tracker':
                new IssueTrackerCommand(this.app, this.plugin.settings, this.plugin.githubAPI).execute();
                break;
            case 'view-prs':
                new ViewPRsCommand(this.app, this.plugin.settings, this.plugin.githubAPI).execute();
                break;
            case 'refresh-data':
                new RefreshDataCommand(this.app, this.plugin.settings, this.plugin.githubAPI).execute();
                break;
            case 'create-dashboard':
                new CreateDashboardCommand(this.app, this.plugin.settings, this.plugin.githubAPI).execute();
                break;
            case 'compare-repos':
                new CompareReposCommand(this.app, this.plugin.settings, this.plugin.githubAPI).execute();
                break;
            case 'bulk-import':
                new BulkImportCommand(this.app, this.plugin.settings, this.plugin.githubAPI).execute();
                break;
        }
    }
}
