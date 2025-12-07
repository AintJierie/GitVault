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
import { SwitchBranchCommand } from './commands/switch-branch';

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
            name: 'Project Snapshot: Create from URL',
            callback: async () => {
                const command = new CreateSnapshotCommand(this.app, this.settings, this.githubAPI);
                await command.execute();
            }
        });

        this.addCommand({
            id: 'refresh-project-data',
            name: 'Project Snapshot: Refresh Data',
            callback: async () => {
                const command = new RefreshDataCommand(this.app, this.settings, this.githubAPI);
                await command.execute();
            }
        });

        this.addCommand({
            id: 'create-project-dashboard',
            name: 'Project Snapshot: Create Dashboard',
            callback: async () => {
                const command = new CreateDashboardCommand(this.app, this.settings, this.githubAPI);
                await command.execute();
            }
        });

        this.addCommand({
            id: 'bulk-import-repos',
            name: 'Project Snapshot: Bulk Import Repositories',
            callback: async () => {
                const command = new BulkImportCommand(this.app, this.settings, this.githubAPI);
                await command.execute();
            }
        });

        this.addCommand({
            id: 'compare-repos',
            name: 'Project Snapshot: Compare Repositories',
            callback: async () => {
                const command = new CompareReposCommand(this.app, this.settings, this.githubAPI);
                await command.execute();
            }
        });

        this.addCommand({
            id: 'issue-tracker',
            name: 'Project Snapshot: Open Issue Tracker',
            callback: async () => {
                const command = new IssueTrackerCommand(this.app, this.settings, this.githubAPI);
                await command.execute();
            }
        });

        this.addCommand({
            id: 'view-prs',
            name: 'Project Snapshot: View Pull Requests',
            callback: async () => {
                const command = new ViewPRsCommand(this.app, this.settings, this.githubAPI);
                await command.execute();
            }
        });

        this.addCommand({
            id: 'switch-branch',
            name: 'Project Snapshot: Switch Branch',
            callback: async () => {
                const command = new SwitchBranchCommand(this.app, this.settings, this.githubAPI);
                await command.execute();
            }
        });

        // Add settings tab
        this.addSettingTab(new ProjectSnapshotSettingTab(this.app, this));

        // Status bar
        const statusBarItem = this.addStatusBarItem();
        statusBarItem.setText('📦 Project Snapshot');

        // Subscribe to rate limit updates
        this.githubAPI.onRateLimitChange = (remaining) => {
            statusBarItem.setText(`📦 Project Snapshot | API: ${remaining}`);
        };

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
        // ... existing onload ...

        // Auto Refresh Loop
        this.registerAutoRefresh();
    }

    registerAutoRefresh() {
        // Clear existing interval if any (handled by registerInterval automatically? No, we need to clear if we reset)
        // Obsidian's registerInterval cleans up on unload, but if we change settings, we need to restart it.
        // Simplest way: Check in onload. If setting changes, we might need a method to restart.
        // But for now, let's just register it.

        if (this.settings.autoRefreshInterval > 0) {
            const minutes = this.settings.autoRefreshInterval;
            this.registerInterval(window.setInterval(async () => {
                console.log('Auto-refreshing project snapshots...');
                await new RefreshDataCommand(this.app, this.settings, this.githubAPI).execute(true);
            }, minutes * 60 * 1000));
        }
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
        // Ideally we should restart the interval here if it changed.
        // For now user might need to reload. 
        // Let's implement a restart logic? 
        // We can't easily clear the *specific* interval registered with registerInterval API from here without tracking the ID.
        // But users usually set this once. Reloading plugin is acceptable for setting change.
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
            { label: 'Switch Branch', id: 'switch-branch', icon: '🌿', description: 'Switch branch and refresh data' },
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
            case 'switch-branch':
                new SwitchBranchCommand(this.app, this.plugin.settings, this.plugin.githubAPI).execute();
                break;
        }
    }
}
