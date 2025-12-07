import { Octokit } from '@octokit/rest';
import { Notice } from 'obsidian';

export interface RepoData {
    owner: string;
    repo: string;
    fullName: string;
    description: string;
    stars: number;
    language: string;
    lastCommit: {
        message: string;
        date: string;
        author: string;
        sha: string;
    };
    openIssues: number;
    url: string;
    homepage: string;
    topics: string[];
}

export class GitHubAPI {
    private octokit: Octokit;

    constructor(token?: string) {
        this.octokit = new Octokit({
            auth: token || undefined
        });
    }

    setToken(token: string) {
        this.octokit = new Octokit({
            auth: token || undefined
        });
    }

    parseGitHubUrl(url: string): { owner: string; repo: string } | null {
        const patterns = [
            /github\.com\/([^\/]+)\/([^\/]+)/,
            /github\.com\/([^\/]+)\/([^\/]+)\.git/
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                return {
                    owner: match[1],
                    repo: match[2].replace('.git', '')
                };
            }
        }
        return null;
    }

    async fetchRepoData(owner: string, repo: string): Promise<RepoData | null> {
        try {
            // Fetch repository info
            const repoResponse = await this.octokit.rest.repos.get({
                owner,
                repo
            });

            // Fetch latest commit
            const commitsResponse = await this.octokit.rest.repos.listCommits({
                owner,
                repo,
                per_page: 1
            });

            const latestCommit = commitsResponse.data[0];

            return {
                owner,
                repo,
                fullName: repoResponse.data.full_name,
                description: repoResponse.data.description || 'No description',
                stars: repoResponse.data.stargazers_count,
                language: repoResponse.data.language || 'Unknown',
                lastCommit: {
                    message: latestCommit.commit.message.split('\n')[0],
                    date: latestCommit.commit.author?.date || '',
                    author: latestCommit.commit.author?.name || 'Unknown',
                    sha: latestCommit.sha.substring(0, 7)
                },
                openIssues: repoResponse.data.open_issues_count,
                url: repoResponse.data.html_url,
                homepage: repoResponse.data.homepage || '',
                topics: repoResponse.data.topics || []
            };
        } catch (error: any) {
            console.error('Error fetching repo data:', error);

            if (error.status === 404) {
                new Notice('Repository not found. Check the URL.');
            } else if (error.status === 403) {
                new Notice('Rate limit exceeded. Add a GitHub token in settings.');
            } else {
                new Notice(`Error: ${error.message}`);
            }

            return null;
        }
    }
}
