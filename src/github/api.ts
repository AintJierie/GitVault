import { Octokit } from '@octokit/rest';
import { Notice, requestUrl } from 'obsidian';

export interface RepoData {
    owner: string;
    repo: string;
    fullName: string;
    description: string;
    stars: number;
    forks: number;
    createdAt: string;
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
    readme?: string;
}

export class GitHubAPI {
    private octokit: Octokit;
    public rateLimitRemaining: number | null = null;
    public onRateLimitChange: ((remaining: number) => void) | null = null;

    constructor(token?: string) {
        this.octokit = new Octokit({
            auth: token || undefined
        });

        // Add hook to capture headers from every response
        this.octokit.hook.wrap('request', async (request, options) => {
            const response = await request(options);
            this.updateRateLimit(response);
            return response;
        });
    }

    setToken(token: string) {
        this.octokit = new Octokit({
            auth: token || undefined
        });

        // Re-add hook
        this.octokit.hook.wrap('request', async (request, options) => {
            const response = await request(options);
            this.updateRateLimit(response);
            return response;
        });
    }

    private updateRateLimit(response: any) {
        if (response.headers && response.headers['x-ratelimit-remaining']) {
            const remaining = parseInt(response.headers['x-ratelimit-remaining'], 10);
            if (!isNaN(remaining)) {
                this.rateLimitRemaining = remaining;
                if (this.onRateLimitChange) {
                    this.onRateLimitChange(remaining);
                }
            }
        }
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

    async getAuthenticatedUserRepos(): Promise<RepoData[]> {
        try {
            const response = await this.octokit.rest.repos.listForAuthenticatedUser({
                sort: 'updated',
                per_page: 100
            });

            return response.data.map((repo: any) => ({
                owner: repo.owner.login,
                repo: repo.name,
                fullName: repo.full_name,
                description: repo.description || 'No description',
                stars: repo.stargazers_count,
                forks: repo.forks_count,
                createdAt: repo.created_at,
                language: repo.language || 'Unknown',
                lastCommit: {
                    message: 'Fetch details for more info',
                    date: repo.updated_at,
                    author: repo.owner.login,
                    sha: ''
                },
                openIssues: repo.open_issues_count,
                url: repo.html_url,
                homepage: repo.homepage || '',
                topics: repo.topics || []
            }));
        } catch (error: any) {
            console.error('Error fetching user repos:', error);
            new Notice('Error fetching your repositories');
            return [];
        }
    }

    async getAuthenticatedUser(): Promise<any> {
        try {
            const { data } = await this.octokit.rest.users.getAuthenticated();
            return data;
        } catch (error) {
            console.error('Error fetching user:', error);
            return null;
        }
    }

    async getContributionData(username: string): Promise<any> {
        try {
            // Use requestUrl to avoid CORS issues within Obsidian
            const response = await requestUrl({
                url: `https://github-contributions-api.jogruber.de/v4/${username}?y=last`
            });

            if (response.status !== 200) return null;
            return response.json;
        } catch (error) {
            console.error('Error fetching contributions:', error);
            return null;
        }
    }

    async getIssues(owner: string, repo: string): Promise<any[]> {
        try {
            const response = await this.octokit.rest.issues.listForRepo({
                owner,
                repo,
                state: 'open',
                per_page: 50
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching issues:', error);
            return [];
        }
    }

    async createIssue(owner: string, repo: string, title: string, body: string): Promise<any> {
        try {
            const response = await this.octokit.rest.issues.create({
                owner,
                repo,
                title,
                body
            });
            return response.data;
        } catch (error) {
            console.error('Error creating issue:', error);
            throw error;
        }
    }

    async getPullRequests(owner: string, repo: string): Promise<any[]> {
        try {
            const response = await this.octokit.rest.pulls.list({
                owner,
                repo,
                state: 'open',
                per_page: 50
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching PRs:', error);
            return [];
        }
    }

    async getPullRequestDiff(owner: string, repo: string, pull_number: number): Promise<string | null> {
        try {
            const response = await this.octokit.rest.pulls.get({
                owner,
                repo,
                pull_number,
                mediaType: {
                    format: 'diff'
                }
            });
            return response.data as unknown as string;
        } catch (error) {
            console.error('Error fetching PR diff:', error);
            return null;
        }
    }

    async getPullRequestCommits(owner: string, repo: string, pull_number: number): Promise<any[]> {
        try {
            const response = await this.octokit.rest.pulls.listCommits({
                owner,
                repo,
                pull_number,
                per_page: 100
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching PR commits:', error);
            return [];
        }
    }

    async getCommitDetails(owner: string, repo: string, ref: string): Promise<any | null> {
        try {
            const response = await this.octokit.rest.repos.getCommit({
                owner,
                repo,
                ref
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching commit details:', error);
            return null;
        }
    }

    async getCommitDiff(owner: string, repo: string, ref: string): Promise<string | null> {
        try {
            const response = await this.octokit.rest.repos.getCommit({
                owner,
                repo,
                ref,
                mediaType: {
                    format: 'diff'
                }
            });
            return response.data as unknown as string;
        } catch (error) {
            console.error('Error fetching commit diff:', error);
            return null;
        }
    }

    async getBranches(owner: string, repo: string): Promise<string[]> {
        try {
            const response = await this.octokit.rest.repos.listBranches({
                owner,
                repo,
                per_page: 100
            });
            return response.data.map((branch: any) => branch.name);
        } catch (error) {
            console.error('Error fetching branches:', error);
            return [];
        }
    }

    async getCommits(owner: string, repo: string, sha?: string): Promise<any[]> {
        try {
            const response = await this.octokit.rest.repos.listCommits({
                owner,
                repo,
                sha,
                per_page: 50
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching commits:', error);
            return [];
        }
    }

    async fetchRepoData(owner: string, repo: string, ref?: string): Promise<RepoData | null> {
        try {
            // Fetch repository info
            const repoResponse = await this.octokit.rest.repos.get({
                owner,
                repo
            });

            // Fetch latest commit (respecting ref/branch)
            const commitsResponse = await this.octokit.rest.repos.listCommits({
                owner,
                repo,
                sha: ref, // 'sha' parameter can take branch name (ref)
                per_page: 1
            });

            const latestCommit = commitsResponse.data[0];

            // Fetch README (optional, but we fetch it always and template decides to show it or not)
            // Or we check settings? The API class doesn't see settings usually, but we can return it.
            let readmeContent = '';
            try {
                const readmeResponse = await this.octokit.rest.repos.getReadme({
                    owner,
                    repo,
                    ref,
                    mediaType: {
                        format: 'raw'
                    }
                });
                readmeContent = readmeResponse.data as unknown as string;
            } catch (ignored) {
                // No README or 404
            }

            return {
                owner,
                repo,
                fullName: repoResponse.data.full_name,
                description: repoResponse.data.description || 'No description',
                stars: repoResponse.data.stargazers_count,
                forks: repoResponse.data.forks_count,
                createdAt: repoResponse.data.created_at,
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
                topics: repoResponse.data.topics || [],
                readme: readmeContent
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
