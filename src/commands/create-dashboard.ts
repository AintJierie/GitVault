import { App, Notice, TFile } from 'obsidian';
import { ProjectSnapshotSettings } from '../settings';
import { GitHubAPI, RepoData, GitHubUser, ContributionData } from '../github/api';

export class CreateDashboardCommand {
    constructor(
        private app: App,
        private settings: ProjectSnapshotSettings,
        private githubAPI?: GitHubAPI
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

        const contribData = await this.githubAPI.getContributionData(user.login);

        const content = this.generateDashboard(user, repos, contribData);

        const fileName = 'Project Dashboard.md';
        const folder = this.settings.defaultFolder;
        const filePath = folder ? `${folder}/${fileName}` : fileName;

        try {
            if (folder && !this.app.vault.getAbstractFileByPath(folder)) {
                await this.app.vault.createFolder(folder);
            }

            const existing = this.app.vault.getAbstractFileByPath(filePath);
            if (existing) {
                await this.app.vault.modify(existing as TFile, content);
                new Notice('Dashboard updated!');
            } else {
                await this.app.vault.create(filePath, content);
                new Notice('Dashboard created!');
            }

            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file) {
                await this.app.workspace.getLeaf().openFile(file as TFile);
            }
        } catch {
            new Notice('Error creating dashboard');
        }
    }

    generateDashboard(user: GitHubUser | null, repos: RepoData[], contribData?: ContributionData | null): string {
        const totalStars = repos.reduce((acc, r) => acc + r.stars, 0);
        const totalForks = repos.reduce((acc, r) => acc + (r.forks || 0), 0);
        const totalOpenIssues = repos.reduce((acc, r) => acc + r.openIssues, 0);
        
        // Top repos by stars
        const topRepos = [...repos].sort((a, b) => b.stars - a.stars).slice(0, 5);
        
        // Recently active repos
        const recentlyActive = [...repos]
            .filter(r => r.lastCommit?.date)
            .sort((a, b) => new Date(b.lastCommit?.date || 0).getTime() - new Date(a.lastCommit?.date || 0).getTime())
            .slice(0, 5);

        // Language breakdown
        const languages: Record<string, number> = {};
        repos.forEach(r => {
            if (r.language) {
                languages[r.language] = (languages[r.language] || 0) + 1;
            }
        });
        const topLanguages = Object.entries(languages)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        let heatmapSection = '';
        if (contribData && contribData.contributions) {
            const contributions = contribData.contributions;
            heatmapSection = this.renderHeatmapHTML(contributions);
        } else {
            heatmapSection = '_Could not load contribution data_';
        }

        return `---
tags:
  - project-dashboard
  - github
updated: ${new Date().toISOString()}
---

# 🚀 GitHub Dashboard

<div style="display: flex; gap: 20px; align-items: center; padding: 20px; background: linear-gradient(135deg, var(--background-secondary) 0%, var(--background-primary) 100%); border-radius: 16px; margin-bottom: 24px;">
    <img src="${user?.avatar_url || ''}" style="width: 80px; height: 80px; border-radius: 50%; border: 3px solid var(--interactive-accent); box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />
    <div>
        <h2 style="margin: 0 0 4px 0; font-size: 1.5em;">@${user?.login || 'user'}</h2>
        <p style="margin: 0; color: var(--text-muted);">${user?.bio || 'GitHub Developer'}</p>
        <div style="display: flex; gap: 16px; margin-top: 8px; font-size: 0.9em;">
            <span>📍 ${user?.location || 'Earth'}</span>
            <span>👥 ${user?.followers || 0} followers</span>
            <span>📦 ${repos.length} repos</span>
        </div>
    </div>
</div>

## 📊 Overview Stats

<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px; margin: 20px 0;">
    <div style="background: var(--background-secondary); border-radius: 12px; padding: 20px; text-align: center; border-left: 4px solid #f59e0b;">
        <div style="font-size: 2em; font-weight: bold;">📦 ${repos.length}</div>
        <div style="color: var(--text-muted); margin-top: 4px;">Repositories</div>
    </div>
    <div style="background: var(--background-secondary); border-radius: 12px; padding: 20px; text-align: center; border-left: 4px solid #fbbf24;">
        <div style="font-size: 2em; font-weight: bold;">⭐ ${totalStars.toLocaleString()}</div>
        <div style="color: var(--text-muted); margin-top: 4px;">Total Stars</div>
    </div>
    <div style="background: var(--background-secondary); border-radius: 12px; padding: 20px; text-align: center; border-left: 4px solid #8b5cf6;">
        <div style="font-size: 2em; font-weight: bold;">🍴 ${totalForks.toLocaleString()}</div>
        <div style="color: var(--text-muted); margin-top: 4px;">Total Forks</div>
    </div>
    <div style="background: var(--background-secondary); border-radius: 12px; padding: 20px; text-align: center; border-left: 4px solid ${totalOpenIssues > 20 ? '#ef4444' : '#22c55e'};">
        <div style="font-size: 2em; font-weight: bold;">🐛 ${totalOpenIssues}</div>
        <div style="color: var(--text-muted); margin-top: 4px;">Open Issues</div>
    </div>
</div>

## 📈 Contribution Activity

${heatmapSection}

## 🏆 Top Repositories

<div style="display: grid; gap: 12px; margin: 16px 0;">
${topRepos.map((r, i) => `<div style="display: flex; align-items: center; gap: 16px; padding: 16px; background: var(--background-secondary); border-radius: 10px; border-left: 4px solid ${this.getMedalColor(i)};">
    <span style="font-size: 1.5em; min-width: 40px; text-align: center;">${this.getMedal(i)}</span>
    <div style="flex: 1;">
        <a href="${r.url}" style="font-weight: 600; font-size: 1.1em; color: var(--text-normal);">${r.repo}</a>
        <div style="color: var(--text-muted); font-size: 0.85em; margin-top: 4px;">${r.description || 'No description'}</div>
    </div>
    <div style="display: flex; gap: 12px; font-size: 0.9em;">
        <span>⭐ ${r.stars}</span>
        <span>🍴 ${r.forks || 0}</span>
    </div>
</div>`).join('\n')}
</div>

## 🔥 Recently Active

| Repository | Last Commit | Language | Issues |
| :--- | :--- | :---: | :---: |
${recentlyActive.map(r => `| [${r.repo}](${r.url}) | ${r.lastCommit?.date?.split('T')[0] || 'N/A'} | ${r.language || '-'} | ${r.openIssues} |`).join('\n')}

## 💻 Languages

<div style="display: flex; gap: 10px; flex-wrap: wrap; margin: 16px 0;">
${topLanguages.map(([lang, count]) => `<span style="background: ${this.getLanguageColor(lang)}; color: white; padding: 6px 14px; border-radius: 20px; font-size: 0.9em; font-weight: 500;">${lang} (${count})</span>`).join('\n')}
</div>

## ⚡ Quick Actions

<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin: 20px 0;">
    <a href="https://github.com/${user?.login || ''}" style="display: flex; align-items: center; justify-content: center; gap: 8px; background: var(--interactive-accent); color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 500;">🔗 View Profile</a>
    <a href="https://github.com/${user?.login || ''}?tab=repositories" style="display: flex; align-items: center; justify-content: center; gap: 8px; background: var(--background-modifier-border); padding: 12px 20px; border-radius: 8px; text-decoration: none; color: var(--text-normal); font-weight: 500;">📦 All Repos</a>
    <a href="https://github.com/${user?.login || ''}?tab=stars" style="display: flex; align-items: center; justify-content: center; gap: 8px; background: var(--background-modifier-border); padding: 12px 20px; border-radius: 8px; text-decoration: none; color: var(--text-normal); font-weight: 500;">⭐ Starred</a>
</div>

---

<div style="display: flex; justify-content: space-between; color: var(--text-muted); font-size: 0.85em; padding-top: 12px;">
    <span>📦 Project Snapshot Dashboard</span>
    <span>Last synced: ${new Date().toLocaleString()}</span>
</div>
`;
    }

    getMedal(index: number): string {
        const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
        return medals[index] || '📦';
    }

    getMedalColor(index: number): string {
        const colors = ['#fbbf24', '#9ca3af', '#cd7f32', '#6366f1', '#8b5cf6'];
        return colors[index] || '#6366f1';
    }

    getLanguageColor(lang: string): string {
        const colors: Record<string, string> = {
            'TypeScript': '#3178c6',
            'JavaScript': '#f7df1e',
            'Python': '#3776ab',
            'Java': '#ed8b00',
            'C#': '#239120',
            'C++': '#00599c',
            'Go': '#00add8',
            'Rust': '#dea584',
            'Ruby': '#cc342d',
            'PHP': '#777bb4',
            'Swift': '#fa7343',
            'Kotlin': '#7f52ff',
            'HTML': '#e34c26',
            'CSS': '#563d7c',
            'Vue': '#4fc08d',
            'Shell': '#89e051'
        };
        return colors[lang] || '#6366f1';
    }

    renderHeatmapHTML(contributions: Array<{ date: string; count: number; level: number }>): string {
        // Map levels to colors (GitHub style)
        const colors = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];
        const totalContributions = contributions.reduce((acc, c) => acc + c.count, 0);

        const squares = contributions.map(c => {
            const color = colors[c.level] || colors[0];
            const title = `${c.count} contributions on ${c.date}`;
            return `<div title="${title}" style="width: 11px; height: 11px; background-color: ${color}; border-radius: 2px;"></div>`;
        }).join('');

        return `
<div style="
    display: flex; 
    flex-direction: column; 
    align-items: flex-start; 
    background: var(--background-secondary); 
    padding: 20px; 
    border-radius: 12px;
    overflow-x: auto;
">
    <div style="display: flex; gap: 3px; flex-wrap: wrap; width: max-content; max-width: 100%;">
        ${squares}
    </div>
    <div style="display: flex; justify-content: space-between; width: 100%; margin-top: 12px; color: var(--text-muted); font-size: 0.85em;">
        <span>🔥 ${totalContributions.toLocaleString()} contributions in the last year</span>
        <div style="display: flex; align-items: center; gap: 4px;">
            <span>Less</span>
            ${colors.map(c => `<div style="width: 11px; height: 11px; background-color: ${c}; border-radius: 2px;"></div>`).join('')}
            <span>More</span>
        </div>
    </div>
</div>
`;
    }
}
