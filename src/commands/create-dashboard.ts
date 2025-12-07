import { App, Notice, TFile } from 'obsidian';
import { ProjectSnapshotSettings } from '../settings';
// We'll need access to githubAPI which is on the main plugin class instance usually,
// or passed in. The current signature only has app/settings.
// But in main.ts, we see: new CreateDashboardCommand(this.app, this.settings)
// We need to change main.ts to pass githubAPI.
// For now, let's assume we will change main.ts or pass it.
// Actually, looking at main.ts it wasn't passed. I'll need to update main.ts first or congruently.
// I'll update this file to accept it.
import { GitHubAPI } from '../github/api';

export class CreateDashboardCommand {
    constructor(
        private app: App,
        private settings: ProjectSnapshotSettings,
        private githubAPI?: GitHubAPI // Optional for smooth refactor, but we need it.
    ) { }

    async execute() {
        if (!this.githubAPI) {
            new Notice('GitHub API not initialized');
            return;
        }

        new Notice('Generating Project Dashboard...');

        const user = await this.githubAPI.getAuthenticatedUser();
        const repos = await this.githubAPI.getAuthenticatedUserRepos();

        if (!user) {
            new Notice('Could not fetch user profile. Check token.');
            return;
        }

        const content = this.generateDashboard(user, repos);

        const fileName = 'Project Dashboard.md';
        const folder = this.settings.defaultFolder;
        const filePath = folder ? `${folder}/${fileName}` : fileName;

        try {
            if (folder && !this.app.vault.getAbstractFileByPath(folder)) {
                await this.app.vault.createFolder(folder);
            }

            const existing = this.app.vault.getAbstractFileByPath(filePath);
            if (existing) {
                await this.app.vault.modify(existing as any, content);
                new Notice('Dashboard updated!');
            } else {
                await this.app.vault.create(filePath, content);
                new Notice('Dashboard created!');
            }

            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file) {
                await this.app.workspace.getLeaf().openFile(file as any);
            }
        } catch (e) {
            console.error(e);
            new Notice('Error creating dashboard');
        }
    }

    generateDashboard(user: any, repos: any[]): string {
        const totalStars = repos.reduce((acc, r) => acc + r.stars, 0);
        const totalOpenIssues = repos.reduce((acc, r) => acc + r.openIssues, 0);
        // Top 5 repos by stars
        const topRepos = [...repos].sort((a, b) => b.stars - a.stars).slice(0, 5);

        return `---
tags:
  - project-dashboard
updated: ${new Date().toISOString()}
---

# 📊 Project Dashboard: ${user.name || user.login}

<div style="display: flex; gap: 20px; align-items: center; margin-bottom: 20px;">
    <img src="${user.avatar_url}" style="width: 60px; height: 60px; border-radius: 50%;" />
    <div>
        <h3>${user.login}</h3>
        <p>${user.bio || 'No bio'}</p>
    </div>
</div>

## 🔥 Activity Heatmap
![Contribution Graph](https://grass-graph.moshimo.works/images/${user.login}.png)

## 📊 GitHub Stats
![GitHub Stats](https://github-readme-stats.vercel.app/api?username=${user.login}&show_icons=true&hide_border=true&count_private=true)

## 📈 Overview
| Total Repos | Total Stars | Open Issues |
| :---: | :---: | :---: |
| **${repos.length}** | **${totalStars}** | **${totalOpenIssues}** |

## ⭐ Top Repositories
${topRepos.map(r => `- [${r.repo}](${r.url}) - ⭐ ${r.stars}`).join('\n')}

## 🧹 Quick Actions
- \`Create Project Snapshot\`
- \`Bulk Import User Repositories\`
- \`Refresh Project Data\`
`;
    }
}
