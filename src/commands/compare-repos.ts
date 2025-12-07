import { App, Modal, Setting, MarkdownView, Notice } from 'obsidian';
import { ProjectSnapshotSettings } from '../settings';
import { GitHubAPI, RepoData } from '../github/api';

export class CompareReposCommand {
    constructor(
        private app: App,
        private settings: ProjectSnapshotSettings,
        private githubAPI: GitHubAPI
    ) { }

    async execute() {
        new CompareModal(this.app, async (url1, url2) => {
            await this.compareRepos(url1, url2);
        }).open();
    }

    async compareRepos(url1: string, url2: string) {
        const p1 = this.githubAPI.parseGitHubUrl(url1);
        const p2 = this.githubAPI.parseGitHubUrl(url2);

        if (!p1 || !p2) {
            new Notice('Invalid GitHub URL(s)');
            return;
        }

        new Notice('Fetching comparison data...');
        const [r1, r2] = await Promise.all([
            this.githubAPI.fetchRepoData(p1.owner, p1.repo),
            this.githubAPI.fetchRepoData(p2.owner, p2.repo)
        ]);

        if (!r1 || !r2) {
            // Error handling done in fetchRepoData
            return;
        }

        const content = this.generateComparisonNote(r1, r2);

        // Create comparison file
        const fileName = `Compare ${r1.repo} vs ${r2.repo}.md`;
        const folder = this.settings.defaultFolder;
        const filePath = folder ? `${folder}/${fileName}` : fileName;

        try {
            if (folder && !this.app.vault.getAbstractFileByPath(folder)) {
                await this.app.vault.createFolder(folder);
            }

            const existing = this.app.vault.getAbstractFileByPath(filePath);
            if (existing) {
                await this.app.vault.modify(existing as any, content);
            } else {
                await this.app.vault.create(filePath, content);
            }

            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file) {
                await this.app.workspace.getLeaf().openFile(file as any);
            }
        } catch (e) {
            console.error(e);
            new Notice('Error creating comparison note');
        }
    }

    generateComparisonNote(r1: RepoData, r2: RepoData): string {
        const winner = (v1: number, v2: number) => {
            if (v1 > v2) return 'Active'; // Just a marker, logic below
            return '';
        };

        const boldIfMore = (v1: number, v2: number) => v1 > v2 ? `**${v1}**` : `${v1}`;
        const formatParam = (label: string, v1: any, v2: any) => `| ${label} | ${v1} | ${v2} |`;

        return `---
tags:
  - project-comparison
date: ${new Date().toISOString()}
---

# Comparison: ${r1.fullName} vs ${r2.fullName}

| Metric | [${r1.repo}](${r1.url}) | [${r2.repo}](${r2.url}) |
| :--- | :--- | :--- |
| Stars | ${boldIfMore(r1.stars, r2.stars)} | ${boldIfMore(r2.stars, r1.stars)} |
| Issues | ${r1.openIssues} | ${r2.openIssues} |
| Language | ${r1.language} | ${r2.language} |
| Last Commit | ${r1.lastCommit.date.split('T')[0]} | ${r2.lastCommit.date.split('T')[0]} |
| Created By | ${r1.owner} | ${r2.owner} |
| Description | ${r1.description} | ${r2.description} |

## Recommendation
${r1.stars > r2.stars ? `**${r1.repo}** appears more popular.` : `**${r2.repo}** appears more popular.`}
${r1.lastCommit.date > r2.lastCommit.date ? `**${r1.repo}** is more recently active.` : `**${r2.repo}** is more recently active.`}
`;
    }
}

class CompareModal extends Modal {
    constructor(
        app: App,
        private onSubmit: (url1: string, url2: string) => void
    ) {
        super(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: 'Compare Repositories' });

        let url1 = '';
        let url2 = '';

        new Setting(contentEl)
            .setName('Repository 1 URL')
            .addText(text => text.setPlaceholder('https://github.com/...').onChange(v => url1 = v));

        new Setting(contentEl)
            .setName('Repository 2 URL')
            .addText(text => text.setPlaceholder('https://github.com/...').onChange(v => url2 = v));

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Compare')
                .setCta()
                .onClick(() => {
                    if (url1 && url2) {
                        this.onSubmit(url1, url2);
                        this.close();
                    } else {
                        new Notice('Please enter both URLs');
                    }
                }));
    }

    onClose() {
        this.contentEl.empty();
    }
}
